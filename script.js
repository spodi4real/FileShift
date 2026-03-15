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
    from flask import request
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
        from docx2pdf import convert
        import tempfile, os
        tmp_in = tempfile.NamedTemporaryFile(delete=False, suffix='.docx')
        tmp_out = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        file.save(tmp_in.name)
        convert(tmp_in.name, tmp_out.name)
        with open(tmp_out.name, 'rb') as f:
            data = f.read()
        os.unlink(tmp_in.name)
        os.unlink(tmp_out.name)
        return send_file(io.BytesIO(data),
            mimetype='application/pdf',
            as_attachment=True,
            download_name='converted.pdf')

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
            as_attachment=True,
            download_name='converted.docx')

    else:
        return jsonify({'error': 'Unsupported conversion'}), 400

if __name__ == '__main__':
    app.run(debug=True)
