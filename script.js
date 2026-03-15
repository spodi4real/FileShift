const BACKEND = 'https://fileshift-production.up.railway.app';
const status = document.getElementById('status');

function showStatus(message, type) {
  status.textContent = message;
  status.className = type;
}

function showTool(toolId, el) {
  document.querySelectorAll('.tool-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));
  document.getElementById('tool-' + toolId).classList.add('active');
  el.classList.add('active');
  status.className = '';
  status.textContent = '';
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

async function postToBackend(endpoint, formData) {
  const response = await fetch(BACKEND + endpoint, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Request failed');
  }
  return await response.blob();
}

// ─── FILE CONVERTER ───────────────────────────────────────────

const fileInput = document.getElementById('fileInput');
const formatSelect = document.getElementById('formatSelect');

fileInput.addEventListener('change', function() {
  const file = fileInput.files[0];
  if (!file) return;
  document.getElementById('uploadLabel').textContent = '✅ ' + file.name;
  const name = file.name.toLowerCase();
  formatSelect.innerHTML = '<option value="">-- Select format --</option>';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.gif') || name.endsWith('.bmp')) {
    addOptions(['JPG', 'PNG', 'WebP', 'GIF', 'BMP']);
  } else if (name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.aac') || name.endsWith('.flac') || name.endsWith('.ogg')) {
    addOptions(['MP3', 'WAV', 'AAC', 'FLAC', 'OGG']);
  } else if (name.endsWith('.pdf') || name.endsWith('.docx') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.html') || name.endsWith('.csv')) {
    addOptions(['PDF', 'TXT', 'HTML', 'CSV']);
  } else {
    showStatus('⚠️ Unsupported file type!', 'error');
  }
});

function addOptions(formats) {
  formats.forEach(function(fmt) {
    const option = document.createElement('option');
    option.value = fmt.toLowerCase();
    option.textContent = fmt;
    formatSelect.appendChild(option);
  });
}

async function handleConvert() {
  const file = fileInput.files[0];
  const format = formatSelect.value;
  if (!file) { showStatus('⚠️ Please upload a file first!', 'error'); return; }
  if (!format) { showStatus('⚠️ Please select a format!', 'error'); return; }
  const name = file.name.toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.gif') || name.endsWith('.bmp')) {
    convertImage(file, format);
  } else if (name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.aac') || name.endsWith('.flac') || name.endsWith('.ogg')) {
    convertAudio(file, format);
  } else {
    try {
      showStatus('⏳ Converting your file...', 'loading');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('format', format);
      const blob = await postToBackend('/convert', formData);
      download(blob, 'fileshift-converted.' + format);
      showStatus('✅ File converted successfully!', 'success');
    } catch (err) {
      showStatus('❌ ' + err.message, 'error');
    }
  }
}

function convertImage(file, format) {
  showStatus('⏳ Converting your image...', 'loading');
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const mimeType = 'image/' + (format === 'jpg' ? 'jpeg' : format);
      canvas.toBlob(function(blob) {
        download(blob, 'fileshift-converted.' + format);
        showStatus('✅ Image converted successfully!', 'success');
      }, mimeType);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function convertAudio(file, format) {
  showStatus('⏳ Loading audio converter... this may take a moment!', 'loading');
  try {
    const { createFFmpeg, fetchFile } = FFmpeg;
    const ffmpeg = createFFmpeg({ log: true });
    await ffmpeg.load();
    const inputName = 'input.' + file.name.split('.').pop();
    const outputName = 'output.' + format;
    ffmpeg.FS('writeFile', inputName, await fetchFile(file));
    await ffmpeg.run('-i', inputName, outputName);
    const data = ffmpeg.FS('readFile', outputName);
    const blob = new Blob([data.buffer], { type: 'audio/' + format });
    download(blob, 'fileshift-converted.' + format);
    showStatus('✅ Audio converted successfully!', 'success');
  } catch (err) {
    showStatus('❌ Audio conversion failed: ' + err.message, 'error');
  }
}

// ─── MERGE PDF ────────────────────────────────────────────────

document.getElementById('mergeInput').addEventListener('change', function() {
  if (this.files.length > 0) {
    document.getElementById('mergeLabel').textContent = '✅ ' + this.files.length + ' files selected';
  }
});

async function mergePDFs() {
  const files = document.getElementById('mergeInput').files;
  if (files.length < 2) { showStatus('⚠️ Please upload at least 2 PDF files!', 'error'); return; }
  try {
    showStatus('⏳ Merging PDFs...', 'loading');
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    const blob = await postToBackend('/pdf/merge', formData);
    download(blob, 'merged.pdf');
    showStatus('✅ PDFs merged successfully!', 'success');
  } catch (err) {
    showStatus('❌ ' + err.message, 'error');
  }
}

// ─── SPLIT PDF ────────────────────────────────────────────────

document.getElementById('splitInput').addEventListener('change', function() {
  if (this.files[0]) document.getElementById('splitLabel').textContent = '✅ ' + this.files[0].name;
});

async function splitPDF() {
  const file = document.getElementById('splitInput').files[0];
  if (!file) { showStatus('⚠️ Please upload a PDF!', 'error'); return; }
  try {
    showStatus('⏳ Splitting PDF...', 'loading');
    const formData = new FormData();
    formData.append('file', file);
    const blob = await postToBackend('/pdf/split', formData);
    download(blob, 'split_pages.zip');
    showStatus('✅ PDF split successfully! A ZIP file was downloaded.', 'success');
  } catch (err) {
    showStatus('❌ ' + err.message, 'error');
  }
}

// ─── PROTECT PDF ─────────────────────────────────────────────

document.getElementById('protectInput').addEventListener('change', function() {
  if (this.files[0]) document.getElementById('protectLabel').textContent = '✅ ' + this.files[0].name;
});

async function protectPDF() {
  const file = document.getElementById('protectInput').files[0];
  const password = document.getElementById('protectPassword').value;
  if (!file) { showStatus('⚠️ Please upload a PDF!', 'error'); return; }
  if (!password) { showStatus('⚠️ Please enter a password!', 'error'); return; }
  try {
    showStatus('⏳ Protecting PDF...', 'loading');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);
    const blob = await postToBackend('/pdf/protect', formData);
    download(blob, 'protected.pdf');
    showStatus('✅ PDF protected successfully!', 'success');
  } catch (err) {
    showStatus('❌ ' + err.message, 'error');
  }
}

// ─── UNLOCK PDF ───────────────────────────────────────────────

document.getElementById('unlockInput').addEventListener('change', function() {
  if (this.files[0]) document.getElementById('unlockLabel').textContent = '✅ ' + this.files[0].name;
});

async function unlockPDF() {
  const file = document.getElementById('unlockInput').files[0];
  const password = document.getElementById('unlockPassword').value;
  if (!file) { showStatus('⚠️ Please upload a PDF!', 'error'); return; }
  if (!password) { showStatus('⚠️ Please enter the password!', 'error'); return; }
  try {
    showStatus('⏳ Unlocking PDF...', 'loading');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);
    const blob = await postToBackend('/pdf/unlock', formData);
    download(blob, 'unlocked.pdf');
    showStatus('✅ PDF unlocked successfully!', 'success');
  } catch (err) {
    showStatus('❌ ' + err.message, 'error');
  }
}

// ─── PAGE NUMBERS ─────────────────────────────────────────────

document.getElementById('pageNumInput').addEventListener('change', function() {
  if (this.files[0]) document.getElementById('pageNumLabel').textContent = '✅ ' + this.files[0].name;
});

async function addPageNumbers() {
  const file = document.getElementById('pageNumInput').files[0];
  if (!file) { showStatus('⚠️ Please upload a PDF!', 'error'); return; }
  try {
    showStatus('⏳ Adding page numbers...', 'loading');
    const formData = new FormData();
    formData.append('file', file);
    const blob = await postToBackend('/pdf/pagenumbers', formData);
    download(blob, 'numbered.pdf');
    showStatus('✅ Page numbers added successfully!', 'success');
  } catch (err) {
    showStatus('❌ ' + err.message, 'error');
  }
}

// ─── IMAGE TO PDF ─────────────────────────────────────────────

document.getElementById('imgPdfInput').addEventListener('change', function() {
  if (this.files[0]) document.getElementById('imgPdfLabel').textContent = '✅ ' + this.files[0].name;
});

async function imageToPDF() {
  const file = document.getElementById('imgPdfInput').files[0];
  if (!file) { showStatus('⚠️ Please upload an image!', 'error'); return; }
  try {
    showStatus('⏳ Converting image to PDF...', 'loading');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', 'pdf');
    const blob = await postToBackend('/convert', formData);
    download(blob, 'converted.pdf');
    showStatus('✅ Image converted to PDF successfully!', 'success');
  } catch (err) {
    showStatus('❌ ' + err.message, 'error');
  }
}

// ─── WORD TO PDF ──────────────────────────────────────────────

document.getElementById('wordPdfInput').addEventListener('change', function() {
  if (this.files[0]) document.getElementById('wordPdfLabel').textContent = '✅ ' + this.files[0].name;
});

async function wordToPDF() {
  const file = document.getElementById('wordPdfInput').files[0];
  if (!file) { showStatus('⚠️ Please upload a Word file!', 'error'); return; }
  try {
    showStatus('⏳ Converting Word to PDF...', 'loading');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', 'pdf');
    const blob = await postToBackend('/convert', formData);
    download(blob, 'converted.pdf');
    showStatus('✅ Word file converted to PDF successfully!', 'success');
  } catch (err) {
    showStatus('❌ ' + err.message, 'error');
  }
}

// ─── CSV/XLSX TO KML ──────────────────────────────────────────

document.getElementById('kmlInput').addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  document.getElementById('kmlLabel').textContent = '✅ ' + file.name;

  try {
    showStatus('⏳ Reading columns...', 'loading');
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(BACKEND + '/csv-columns', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    const columns = data.columns;

    ['kmlLat', 'kmlLng', 'kmlName'].forEach(id => {
      const select = document.getElementById(id);
      select.innerHTML = '';
      columns.forEach(col => {
        const option = document.createElement('option');
        option.value = col;
        option.textContent = col;
        select.appendChild(option);
      });
    });

    const descSelect = document.getElementById('kmlDesc');
    descSelect.innerHTML = '<option value="">-- None --</option>';
    columns.forEach(col => {
      const option = document.createElement('option');
      option.value = col;
      option.textContent = col;
      descSelect.appendChild(option);
    });

    document.getElementById('kmlFields').style.display = 'block';
    showStatus('✅ Columns loaded! Now select which column is which.', 'success');
  } catch (err) {
    showStatus('❌ Could not read columns: ' + err.message, 'error');
  }
});

async function convertToKML() {
  const file = document.getElementById('kmlInput').files[0];
  const lat = document.getElementById('kmlLat').value;
  const lng = document.getElementById('kmlLng').value;
  const name = document.getElementById('kmlName').value;
  const desc = document.getElementById('kmlDesc').value;
  if (!file) { showStatus('⚠️ Please upload a file!', 'error'); return; }
  if (!lat || !lng || !name) { showStatus('⚠️ Please select Latitude, Longitude and Name columns!', 'error'); return; }
  try {
    showStatus('⏳ Converting to KML...', 'loading');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lat', lat);
    formData.append('lng', lng);
    formData.append('name', name);
    formData.append('desc', desc);
    const blob = await postToBackend('/csv-to-kml', formData);
    download(blob, 'output.kml');
    showStatus('✅ File converted to KML successfully!', 'success');
  } catch (err) {
    showStatus('❌ ' + err.message, 'error');
  }
}

// ─── REMOVE BACKGROUND ────────────────────────────────────────

document.getElementById('removeBgInput').addEventListener('change', function() {
  if (this.files[0]) document.getElementById('removeBgLabel').textContent = '✅ ' + this.files[0].name;
});

async function removeBackground() {
  const file = document.getElementById('removeBgInput').files[0];
  if (!file) { showStatus('⚠️ Please upload an image!', 'error'); return; }
  try {
    showStatus('⏳ Removing background... this may take a moment!', 'loading');
    const formData = new FormData();
    formData.append('file', file);
    const blob = await postToBackend('/remove-bg', formData);
    download(blob, 'no-background.png');
    showStatus('✅ Background removed successfully!', 'success');
  } catch (err) {
    showStatus('❌ ' + err.message, 'error');
  }
}

// ─── CROP IMAGE ───────────────────────────────────────────────

document.getElementById('cropInput').addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  document.getElementById('cropLabel').textContent = '✅ ' + file.name;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.getElementById('cropCanvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.style.display = 'block';
      document.getElementById('cropW').value = img.width;
      document.getElementById('cropH').value = img.height;
      document.getElementById('cropControls').style.display = 'flex';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

function cropImage() {
  const canvas = document.getElementById('cropCanvas');
  const x = parseInt(document.getElementById('cropX').value);
  const y = parseInt(document.getElementById('cropY').value);
  const w = parseInt(document.getElementById('cropW').value);
  const h = parseInt(document.getElementById('cropH').value);
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = w;
  cropCanvas.height = h;
  cropCanvas.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
  cropCanvas.toBlob(function(blob) {
    download(blob, 'cropped.png');
    showStatus('✅ Image cropped successfully!', 'success');
  });
}