from flask import Flask, request, send_file, jsonify, make_response
from flask_cors import CORS
import io
import os
import tempfile
import traceback

app = Flask(__name__)
CORS(app)

@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@app.before_request
def handle_options():
    if request.method == 'OPTIONS':
        r = make_response()
        r.headers['Access-Control-Allow-Origin'] = '*'
        r.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        r.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return r

@app.route('/')
def home():
    return jsonify({'status': 'FileShift backend is running!'})

@app.route('/convert', methods=['POST', 'OPTIONS'])
def convert():
    try:
        file = request.files['file']
        target_format = request.form['format']
        filename = file.filename.lower()

        if filename.endswith('.docx') and target_format == 'pdf':
            from docx import Document
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter
            doc = Document(file)
            buffer = io.BytesIO()
            c = canvas.Canvas(buffer, pagesize=letter)
            y = 750
            for para in doc.paragraphs:
                if y < 50:
                    c.showPage()
                    y = 750
                if para.text.strip():
                    c.drawString(50, y, para.text)
                y -= 20
            c.save()
            buffer.seek(0)
            return send_file(buffer, mimetype='application/pdf',
                as_attachment=True, download_name='converted.pdf')

        elif filename.endswith('.pdf') and target_format == 'docx':
            from pdf2docx import Converter
            tmp_in = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
            tmp_in.close()
            tmp_out = tempfile.NamedTemporaryFile(delete=False, suffix='.docx')
            tmp_out.close()
            file.save(tmp_in.name)
            cv = Converter(tmp_in.name)
            cv.convert(tmp_out.name)
            cv.close()
            with open(tmp_out.name, 'rb') as f:
                data = f.read()
            try:
                os.unlink(tmp_in.name)
                os.unlink(tmp_out.name)
            except:
                pass
            return send_file(io.BytesIO(data),
                mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                as_attachment=True, download_name='converted.docx')

        else:
            return jsonify({'error': 'Unsupported conversion'}), 400

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/csv-to-kml', methods=['POST', 'OPTIONS'])
def csv_to_kml():
    try:
        import pandas as pd
        import simplekml

        file = request.files['file']
        lat_col = request.form['lat']
        lng_col = request.form['lng']
        name_col = request.form['name']
        desc_col = request.form.get('desc', '')
        filename = file.filename.lower()

        if filename.endswith('.csv'):
            df = pd.read_csv(file)
        elif filename.endswith('.xlsx'):
            df = pd.read_excel(file)
        else:
            return jsonify({'error': 'Unsupported file type'}), 400

        kml = simplekml.Kml()
        for _, row in df.iterrows():
            try:
                lat = float(row[lat_col])
                lng = float(row[lng_col])
                name = str(row[name_col])
                desc = str(row[desc_col]) if desc_col and desc_col in df.columns else ''
                pnt = kml.newpoint(name=name)
                pnt.coords = [(lng, lat)]
                pnt.description = desc
            except Exception:
                continue

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.kml')
        tmp.close()
        kml.save(tmp.name)
        with open(tmp.name, 'rb') as f:
            data = f.read()
        try:
            os.unlink(tmp.name)
        except:
            pass

        return send_file(
            io.BytesIO(data),
            mimetype='application/vnd.google-earth.kml+xml',
            as_attachment=True,
            download_name='output.kml'
        )

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
