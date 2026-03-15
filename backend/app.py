from flask import Flask, request, send_file, jsonify, make_response
import io
import os
import tempfile

app = Flask(__name__)

def cors(response):
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

@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response


@app.route('/convert', methods=['POST', 'OPTIONS'])
def convert():
    file = request.files['file']
    target_format = request.form['format']
    filename = file.filename.lower()

    if filename.endswith('.txt') and target_format == 'html':
        content = file.read().decode('utf-8')
        result = '<html><body><pre>' + content + '</pre></body></html>'
        return cors(make_response(send_file(io.BytesIO(result.encode()),
            mimetype='text/html', as_attachment=True, download_name='converted.html')))

    elif filename.endswith('.html') and target_format == 'txt':
        content = file.read().decode('utf-8')
        return cors(make_response(send_file(io.BytesIO(content.encode()),
            mimetype='text/plain', as_attachment=True, download_name='converted.txt')))

    elif filename.endswith('.md') and target_format == 'html':
        import markdown
        content = file.read().decode('utf-8')
        result = markdown.markdown(content)
        return cors(make_response(send_file(io.BytesIO(result.encode()),
            mimetype='text/html', as_attachment=True, download_name='converted.html')))

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
        return cors(make_response(send_file(buffer,
            mimetype='application/pdf', as_attachment=True, download_name='converted.pdf')))

    elif (filename.endswith('.jpg') or filename.endswith('.jpeg') or
          filename.endswith('.png')) and target_format == 'pdf':
        from PIL import Image
        img = Image.open(file).convert('RGB')
        buffer = io.BytesIO()
        img.save(buffer, format='PDF')
        buffer.seek(0)
        return cors(make_response(send_file(buffer,
            mimetype='application/pdf', as_attachment=True, download_name='converted.pdf')))

    else:
        return cors(make_response(jsonify({'error': 'Conversion not supported yet'}), 400))


@app.route('/pdf/merge', methods=['POST', 'OPTIONS'])
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
    return cors(make_response(send_file(buffer,
        mimetype='application/pdf', as_attachment=True, download_name='merged.pdf')))


@app.route('/pdf/split', methods=['POST', 'OPTIONS'])
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
            zf.writestr('page_{}.pdf'.format(i + 1), page_buffer.read())
    zip_buffer.seek(0)
    return cors(make_response(send_file(zip_buffer,
        mimetype='application/zip', as_attachment=True, download_name='split_pages.zip')))


@app.route('/pdf/protect', methods=['POST', 'OPTIONS'])
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
    return cors(make_response(send_file(buffer,
        mimetype='application/pdf', as_attachment=True, download_name='protected.pdf')))


@app.route('/pdf/unlock', methods=['POST', 'OPTIONS'])
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
    return cors(make_response(send_file(buffer,
        mimetype='application/pdf', as_attachment=True, download_name='unlocked.pdf')))


@app.route('/pdf/pagenumbers', methods=['POST', 'OPTIONS'])
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
        c.drawString(280, 20, 'Page {}'.format(i + 1))
        c.save()
        packet.seek(0)
        from PyPDF2 import PdfReader as PR
        overlay = PR(packet)
        page.merge_page(overlay.pages[0])
        writer.add_page(page)
    buffer = io.BytesIO()
    writer.write(buffer)
    buffer.seek(0)
    return cors(make_response(send_file(buffer,
        mimetype='application/pdf', as_attachment=True, download_name='numbered.pdf')))


@app.route('/csv-columns', methods=['POST', 'OPTIONS'])
def get_columns():
    import csv
    file = request.files['file']
    filename = file.filename.lower()
    try:
        if filename.endswith('.csv'):
            content = file.read().decode('utf-8').splitlines()
            reader = csv.DictReader(content)
            columns = list(reader.fieldnames)
        elif filename.endswith('.xlsx'):
            import openpyxl
            wb = openpyxl.load_workbook(file)
            ws = wb.active
            columns = [cell.value for cell in ws[1] if cell.value]
        else:
            return cors(make_response(jsonify({'error': 'Unsupported file'}), 400))
        return cors(make_response(jsonify({'columns': columns})))
    except Exception as e:
        return cors(make_response(jsonify({'error': str(e)}), 500))


@app.route('/csv-to-kml', methods=['POST', 'OPTIONS'])
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
    kml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>'
    ]
    for row in rows:
        name = row.get(name_col, 'Point')
        desc = row.get(desc_col, '') if desc_col else ''
        lat = row.get(lat_col, 0)
        lng = row.get(lng_col, 0)
        kml_lines.append(
            '<Placemark><name>{}</name><description>{}</description>'
            '<Point><coordinates>{},{},0</coordinates></Point></Placemark>'.format(
                name, desc, lng, lat))
    kml_lines.append('</Document></kml>')
    return cors(make_response(send_file(
        io.BytesIO('\n'.join(kml_lines).encode()),
        mimetype='application/vnd.google-earth.kml+xml',
        as_attachment=True,
        download_name='output.kml')))


@app.route('/remove-bg', methods=['POST', 'OPTIONS'])
def remove_bg():
    from rembg import remove
    from PIL import Image, ImageFilter, ImageEnhance
    file = request.files['file']
    img = Image.open(file).convert('RGBA')
    result = remove(img)
    r, g, b, a = result.split()
    a = a.filter(ImageFilter.SMOOTH_MORE)
    a = a.filter(ImageFilter.SMOOTH_MORE)
    result = Image.merge('RGBA', (r, g, b, a))
    result = ImageEnhance.Sharpness(result).enhance(1.5)
    buffer = io.BytesIO()
    result.save(buffer, format='PNG')
    buffer.seek(0)
    return cors(make_response(send_file(buffer,
        mimetype='image/png', as_attachment=True, download_name='no-background.png')))


@app.route('/media/info', methods=['POST', 'OPTIONS'])
def media_info():
    import yt_dlp
    url = request.form.get('url', '').strip()
    if not url:
        return cors(make_response(jsonify({'error': 'No URL provided'}), 400))
    try:
        ydl_opts = {'quiet': True, 'no_warnings': True, 'skip_download': True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return cors(make_response(jsonify({
                'title': info.get('title', 'Unknown'),
                'thumbnail': info.get('thumbnail', ''),
                'duration': info.get('duration', 0)
            })))
    except Exception as e:
        return cors(make_response(jsonify({'error': str(e)}), 500))


@app.route('/media/download', methods=['POST', 'OPTIONS'])
def media_download():
    import yt_dlp
    url = request.form.get('url', '').strip()
    fmt = request.form.get('format', 'mp4-best')
    if not url:
        return cors(make_response(jsonify({'error': 'No URL provided'}), 400))
    try:
        tmp_dir = tempfile.mkdtemp()
        output_path = os.path.join(tmp_dir, 'download.%(ext)s')

        if fmt == 'mp3':
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': output_path,
                'quiet': True,
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }]
            }
        else:
            quality_map = {
                'mp4-best': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                'mp4-720': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]/best',
                'mp4-480': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]/best',
            }
            ydl_opts = {
                'format': quality_map.get(fmt, 'best'),
                'outtmpl': output_path,
                'quiet': True,
                'merge_output_format': 'mp4'
            }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        files = os.listdir(tmp_dir)
        if not files:
            return cors(make_response(jsonify({'error': 'Download failed'}), 500))

        file_path = os.path.join(tmp_dir, files[0])
        ext = files[0].split('.')[-1]
        mimetype = 'audio/mpeg' if ext == 'mp3' else 'video/mp4'

        with open(file_path, 'rb') as f:
            data = f.read()

        return cors(make_response(send_file(
            io.BytesIO(data),
            mimetype=mimetype,
            as_attachment=True,
            download_name='fileshift-download.{}'.format(ext)
        )))
    except Exception as e:
        return cors(make_response(jsonify({'error': str(e)}), 500))


if __name__ == '__main__':
    app.run(debug=True)
