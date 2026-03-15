from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import io
import os

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

    elif (filename.endswith('.docx')) and target_format == 'pdf':
        from docx2pdf import convert
        import tempfile
        tmp_in = tempfile.NamedTemporaryFile(delete=False, suffix='.docx')
        tmp_out = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        file.save(tmp_in.name)
        convert(tmp_in.name, tmp_out.name)
        return send_file(tmp_out.name, mimetype='application/pdf', as_attachment=True, download_name='converted.pdf')

    elif (filename.endswith('.jpg') or filename.endswith('.jpeg') or filename.endswith('.png')) and target_format == 'pdf':
        from PIL import Image
        img = Image.open(file)
        img = img.convert('RGB')
        buffer = io.BytesIO()
        img.save(buffer, format='PDF')
        buffer.seek(0)
        return send_file(buffer, mimetype='application/pdf', as_attachment=True, download_name='converted.pdf')

    else:
        return jsonify({'error': 'Conversion not supported yet'}), 400


@app.route('/pdf/merge', methods=['POST'])
def merge_pdf():
    from PyPDF2 import PdfMerger
    files = request.files.getlist('files')
    merger = PdfMerger()
    for f in files:
        merger.append(f)
    buffer = io.BytesIO()
    merger.write(buffer)
    merger.close()
    buffer.seek(0)
    return send_file(buffer, mimetype='application/pdf', as_attachment=True, download_name='merged.pdf')


@app.route('/pdf/split', methods=['POST'])
def split_pdf():
    from PyPDF2 import PdfReader, PdfWriter
    import zipfile
    file = request.files['file']
    reader = PdfReader(file)
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w') as zf:
        for i, page in enumerate(reader.pages):
            writer = PdfWriter()
            writer.add_page(page)
            page_buffer = io.BytesIO()
            writer.write(page_buffer)
            page_buffer.seek(0)
            zf.writestr(f'page_{i+1}.pdf', page_buffer.read())
    zip_buffer.seek(0)
    return send_file(zip_buffer, mimetype='application/zip', as_attachment=True, download_name='split_pages.zip')


@app.route('/pdf/protect', methods=['POST'])
def protect_pdf():
    from PyPDF2 import PdfReader, PdfWriter
    file = request.files['file']
    password = request.form['password']
    reader = PdfReader(file)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    writer.encrypt(password)
    buffer = io.BytesIO()
    writer.write(buffer)
    buffer.seek(0)
    return send_file(buffer, mimetype='application/pdf', as_attachment=True, download_name='protected.pdf')


@app.route('/pdf/unlock', methods=['POST'])
def unlock_pdf():
    from PyPDF2 import PdfReader, PdfWriter
    file = request.files['file']
    password = request.form['password']
    reader = PdfReader(file)
    if reader.is_encrypted:
        reader.decrypt(password)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    buffer = io.BytesIO()
    writer.write(buffer)
    buffer.seek(0)
    return send_file(buffer, mimetype='application/pdf', as_attachment=True, download_name='unlocked.pdf')


@app.route('/pdf/pagenumbers', methods=['POST'])
def add_page_numbers():
    from PyPDF2 import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas as pdf_canvas
    from reportlab.lib.pagesizes import letter
    file = request.files['file']
    reader = PdfReader(file)
    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        packet = io.BytesIO()
        c = pdf_canvas.Canvas(packet, pagesize=letter)
        c.setFont('Helvetica', 10)
        c.drawString(280, 20, f'Page {i + 1}')
        c.save()
        packet.seek(0)
        from PyPDF2 import PdfReader as PR
        overlay = PR(packet)
        page.merge_page(overlay.pages[0])
        writer.add_page(page)
    buffer = io.BytesIO()
    writer.write(buffer)
    buffer.seek(0)
    return send_file(buffer, mimetype='application/pdf', as_attachment=True, download_name='numbered.pdf')


@app.route('/csv-to-kml', methods=['POST'])
def csv_to_kml():
    import csv
    file = request.files['file']
    lat_col = request.form['lat']
    lng_col = request.form['lng']
    name_col = request.form['name']
    desc_col = request.form.get('desc', '')
    filename = file.filename.lower()

    rows = []
    if filename.endswith('.csv'):
        content = file.read().decode('utf-8').splitlines()
        reader = csv.DictReader(content)
        rows = list(reader)
    elif filename.endswith('.xlsx'):
        import openpyxl
        wb = openpyxl.load_workbook(file)
        ws = wb.active
        headers = [cell.value for cell in ws[1]]
        for row in ws.iter_rows(min_row=2, values_only=True):
            rows.append(dict(zip(headers, row)))

    kml_lines = ['<?xml version="1.0" encoding="UTF-8"?>',
                 '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>']
    for row in rows:
        name = row.get(name_col, 'Point')
        desc = row.get(desc_col, '') if desc_col else ''
        lat = row.get(lat_col, 0)
        lng = row.get(lng_col, 0)
        kml_lines.append(f'''<Placemark>
  <name>{name}</name>
  <description>{desc}</description>
  <Point><coordinates>{lng},{lat},0</coordinates></Point>
</Placemark>''')
    kml_lines.append('</Document></kml>')
    kml_content = '\n'.join(kml_lines)
    return send_file(io.BytesIO(kml_content.encode()), mimetype='application/vnd.google-earth.kml+xml', as_attachment=True, download_name='output.kml')


@app.route('/remove-bg', methods=['POST'])
def remove_bg():
    from rembg import remove
    from PIL import Image
    file = request.files['file']
    img = Image.open(file)
    result = remove(img)
    buffer = io.BytesIO()
    result.save(buffer, format='PNG')
    buffer.seek(0)
    return send_file(buffer, mimetype='image/png', as_attachment=True, download_name='no-background.png')


if __name__ == '__main__':
    app.run(debug=True)