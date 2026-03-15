var BACKEND = 'https://fileshift.onrender.com';

function toast(message, type) {
  if (!type) type = 'loading';
  var t = document.getElementById('statusToast');
  t.textContent = message;
  t.className = 'toast ' + type;
  t.classList.add('show');
  if (type !== 'loading') {
    setTimeout(function() { t.classList.remove('show'); }, 3500);
  }
}

function download(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

window.addEventListener('load', function() {

  var dropZone = document.getElementById('dropZone');
  var fileInput = document.getElementById('fileInput');

  dropZone.addEventListener('click', function() {
    fileInput.click();
  });

  dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', function() {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    var file = e.dataTransfer.files[0];
    if (file) onFileSelected(file);
  });

  fileInput.addEventListener('change', function() {
    if (fileInput.files && fileInput.files[0]) {
      onFileSelected(fileInput.files[0]);
    }
  });

});

function onFileSelected(file) {
  document.getElementById('fileName').textContent = '✅ ' + file.name;
  var name = file.name.toLowerCase();
  var formatSelect = document.getElementById('formatSelect');
  formatSelect.innerHTML = '';
  var formats = [];

  if (name.endsWith('.docx')) {
    formats = ['PDF'];
  } else if (name.endsWith('.pdf')) {
    formats = ['DOCX'];
  } else if (name.endsWith('.mp4')) {
    formats = ['MP3'];
  } else if (name.endsWith('.mp3')) {
    formats = ['WAV'];
  } else if (name.endsWith('.wav')) {
    formats = ['MP3'];
  } else {
    toast('Unsupported file type!', 'error');
    return;
  }

  formats.forEach(function(fmt) {
    var opt = document.createElement('option');
    opt.value = fmt.toLowerCase();
    opt.textContent = fmt;
    formatSelect.appendChild(opt);
  });

  document.getElementById('convertRow').style.display = 'flex';
}

function handleConvert() {
  var fileInput = document.getElementById('fileInput');
  var file = fileInput.files[0];
  var format = document.getElementById('formatSelect').value;

  if (!file) { toast('Please upload a file first!', 'error'); return; }
  if (!format) { toast('Please select a format!', 'error'); return; }

  var name = file.name.toLowerCase();

  if (name.endsWith('.mp4') || name.endsWith('.mp3') || name.endsWith('.wav')) {
    convertAudio(file, format);
  } else {
    convertDocument(file, format);
  }
}

function convertAudio(file, format) {
  toast('Loading audio converter...', 'loading');
  var createFFmpeg = FFmpeg.createFFmpeg;
  var fetchFile = FFmpeg.fetchFile;
  var ffmpeg = createFFmpeg({ log: false });

  ffmpeg.load().then(function() {
    var inputName = 'input.' + file.name.split('.').pop();
    var outputName = 'output.' + format;
    return fetchFile(file).then(function(data) {
      ffmpeg.FS('writeFile', inputName, data);
      return ffmpeg.run('-i', inputName, outputName);
    }).then(function() {
      var data = ffmpeg.FS('readFile', outputName);
      var blob = new Blob([data.buffer], { type: 'audio/' + format });
      download(blob, 'fileshift-converted.' + format);
      toast('Converted successfully!', 'success');
    });
  }).catch(function(err) {
    toast('Error: ' + err.message, 'error');
  });
}

function convertDocument(file, format) {
  toast('Converting... please wait!', 'loading');
  var formData = new FormData();
  formData.append('file', file);
  formData.append('format', format);

  fetch(BACKEND + '/convert', {
    method: 'POST',
    body: formData
  }).then(function(response) {
    if (!response.ok) {
      return response.json().then(function(err) {
        throw new Error(err.error || 'Conversion failed');
      });
    }
    return response.blob();
  }).then(function(blob) {
    download(blob, 'fileshift-converted.' + format);
    toast('Converted successfully!', 'success');
  }).catch(function(err) {
    toast('Error: ' + err.message, 'error');
  });
}
