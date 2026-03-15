from flask import Flask, request, send_file, jsonify, make_response
import io

app = Flask(__name__)

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
            c.drawString(50, y, para.text)
            y -= 20
        c.save()
        buffer.seek(0)
        return send_file(buffer, mimetype='application/pdf',
            as_attachment=True, download_name='converted.pdf')

    elif filename.endswith('.pdf') and target_format == 'docx':
        from pdf2docx import Converter
        import tempfile, os
        tmp_in = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        tmp_out = tempfile.NamedTemporaryFile(delete=False, suffix='.docx')
        file.save(tmp_in.name)
        cv = Converter(tmp_in.name)
        cv.convert(tmp_out.name)
        cv.close()
        with open(tmp_out.name, 'rb') as f:
            data = f.read()
        os.unlink(tmp_in.name)
        os.unlink(tmp_out.name)
        return send_file(io.BytesIO(data),
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            as_attachment=True, download_name='converted.docx')

    else:
        return jsonify({'error': 'Unsupported conversion'}), 400

if __name__ == '__main__':
    app.run(debug=True)