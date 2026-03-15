const fileInput = document.getElementById('fileInput');
const formatSelect = document.getElementById('formatSelect');
const status = document.getElementById('status');

function showStatus(message, type) {
  status.textContent = message;
  status.className = type;
}

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

const convertBtn = document.getElementById('convertBtn');

convertBtn.addEventListener('click', function() {
  const file = fileInput.files[0];
  const format = formatSelect.value;

  if (!file) {
    showStatus('⚠️ Please upload a file first!', 'error');
    return;
  }

  if (!format) {
    showStatus('⚠️ Please select a format!', 'error');
    return;
  }

  const name = file.name.toLowerCase();

  if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.gif') || name.endsWith('.bmp')) {
    convertImage(file, format);
  } else if (name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.aac') || name.endsWith('.flac') || name.endsWith('.ogg')) {
    convertAudio(file, format);
  } else if (name.endsWith('.pdf') || name.endsWith('.docx') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.html') || name.endsWith('.csv')) {
    convertDocument(file, format);
  }
});

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
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fileshift-converted.' + format;
        a.click();
        showStatus('✅ Image converted successfully!', 'success');
      }, mimeType);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function convertAudio(file, format) {
  showStatus('⏳ Loading audio converter... this may take a moment!', 'loading');
  const { createFFmpeg, fetchFile } = FFmpeg;
  const ffmpeg = createFFmpeg({ log: true });

  await ffmpeg.load();

  const inputName = 'input.' + file.name.split('.').pop();
  const outputName = 'output.' + format;

  ffmpeg.FS('writeFile', inputName, await fetchFile(file));
  await ffmpeg.run('-i', inputName, outputName);

  const data = ffmpeg.FS('readFile', outputName);
  const blob = new Blob([data.buffer], { type: 'audio/' + format });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'fileshift-converted.' + format;
  a.click();

  showStatus('✅ Audio converted successfully!', 'success');
}

async function convertDocument(file, format) {
  showStatus('⏳ Converting your document...', 'loading');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('format', format);

  const response = await fetch('http://127.0.0.1:5000/convert', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    showStatus('❌ Sorry, that conversion is not supported yet!', 'error');
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fileshift-converted.' + format;
  a.click();

  showStatus('✅ Document converted successfully!', 'success');
}