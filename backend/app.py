from flask import Flask, request, send_file
from flask_cors import CORS
import io

app = Flask(__name__)
CORS(app)

@app.route('/convert', methods=['POST'])
def convert():
    file = request.files['file']
    target_format = request.form['format']
    filename = file.filename.lower()

    if filename.endswith('.txt') and target_format == 'html':
        content = file.read().decode('utf-8')
        result = '<html><body><pre>' + content + '</pre></body></html>'
        return send_file(io.BytesIO(result.encode()), mimetype='text/html', as_attachment=True, download_name='converted.html')

    elif filename.endswith('.html') and target_format == 'txt':
        content = file.read().decode('utf-8')
        return send_file(io.BytesIO(content.encode()), mimetype='text/plain', as_attachment=True, download_name='converted.txt')

    elif filename.endswith('.md') and target_format == 'html':
        import markdown
        content = file.read().decode('utf-8')
        result = markdown.markdown(content)
        return send_file(io.BytesIO(result.encode()), mimetype='text/html', as_attachment=True, download_name='converted.html')

    elif filename.endswith('.txt') and target_format == 'pdf':
        from reportlab.pdfgen import canvas as pdf_canvas
        content = file.read().decode('utf-8')
        buffer = io.BytesIO()
        c = pdf_canvas.Canvas(buffer)
        y = 750
        for line in content.split('\n'):
            c.drawString(50, y, line)
            y -= 20
            if y < 50:
                c.showPage()
                y = 750
        c.save()
        buffer.seek(0)
        return send_file(buffer, mimetype='application/pdf', as_attachment=True, download_name='converted.pdf')

    else:
        return {'error': 'Conversion not supported yet'}, 400

if __name__ == '__main__':
    app.run(debug=True)