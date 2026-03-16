var BACKEND = 'https://fileshift.onrender.com';

// ── CLOCK ────────────────────────────────────────────────────
function updateClock() {
  var now = new Date();
  var h = now.getHours().toString().padStart(2, '0');
  var m = now.getMinutes().toString().padStart(2, '0');
  var el = document.getElementById('clock');
  if (el) el.textContent = h + ':' + m;
}
updateClock();
setInterval(updateClock, 1000);

// ── PROGRESS BAR ─────────────────────────────────────────────
function showProgressBar() {
  var bar = document.getElementById('progressBar');
  bar.classList.add('loading');
}

function hideProgressBar() {
  var bar = document.getElementById('progressBar');
  bar.classList.remove('loading');
  bar.style.width = '100%';
  setTimeout(function() {
    bar.style.width = '0%';
  }, 300);
}

// ── TOAST ────────────────────────────────────────────────────
function toast(message, type) {
  if (!type) type = 'loading';
  var toast = document.getElementById('xpToast');
  var msg = document.getElementById('xpToastMsg');
  var face = document.getElementById('xpToastFace');
  var title = document.getElementById('xpToastTitle');

  msg.textContent = message;

  if (type === 'success') {
    face.src = 'face-success.png';
    title.textContent = 'Success!';
  } else if (type === 'error') {
    face.src = 'face-error.png';
    title.textContent = 'Error!';
  } else {
    face.src = 'loading-circle.gif';
    title.textContent = 'Please wait...';
  }

  toast.style.display = 'block';

  if (type !== 'loading') {
    setTimeout(function() {
      toast.style.display = 'none';
    }, 4000);
  }
}

function hideToast() {
  document.getElementById('xpToast').style.display = 'none';
}

// ── DOWNLOAD ─────────────────────────────────────────────────
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

// ── WINDOW MANAGEMENT ─────────────────────────────────────────
var zCounter = 200;
var minimizedWindows = {};

function openTool(id) {
  var win = document.getElementById('win-' + id);
  if (!win) return;
  win.style.display = 'block';
  bringToFront(id);
  addTaskbarItem(id);
}

function openWindow(id) {
  openTool(id);
}

function closeWindow(id) {
  var win = document.getElementById('win-' + id);
  if (win) {
    win.style.display = 'none';
    removeTaskbarItem(id);
  }
}

function minimizeWindow(id) {
  var win = document.getElementById('win-' + id);
  if (win) {
    win.style.display = 'none';
    minimizedWindows[id] = true;
  }
}

function bringToFront(id) {
  zCounter++;
  var win = document.getElementById('win-' + id);
  if (win) win.style.zIndex = zCounter;
}

function addTaskbarItem(id) {
  var existing = document.getElementById('tb-' + id);
  if (existing) return;
  var names = {
    'converter': 'File Converter',
    'map': 'Map Converter',
    'pdf': 'PDF Tools',
    'image': 'Image Tools',
    'download': 'Downloader',
    'about': 'About'
  };
  var icons = {
    'converter': 'icon-converter.png',
    'map': 'icon-map.png',
    'pdf': 'icon-pdf.png',
    'image': 'icon-image.png',
    'download': 'icon-download.png',
    'about': 'icon-about.png'
  };
  var items = document.querySelector('.taskbar-items');
  var item = document.createElement('div');
  item.className = 'taskbar-item';
  item.id = 'tb-' + id;
  item.innerHTML = '<img src="' + (icons[id] || 'icon-converter.png') + '" style="height:18px;" /><span>' + (names[id] || id) + '</span>';
  item.onclick = function() {
    var win = document.getElementById('win-' + id);
    if (win) {
      if (win.style.display === 'none') {
        win.style.display = 'block';
        bringToFront(id);
      } else {
        win.style.display = 'none';
      }
    }
  };
  items.appendChild(item);
}

function removeTaskbarItem(id) {
  var item = document.getElementById('tb-' + id);
  if (item) item.remove();
}

function goHome() {
  document.querySelectorAll('.xp-window').forEach(function(w) {
    w.style.display = 'none';
  });
  document.querySelectorAll('.taskbar-item:not(#tb-home)').forEach(function(t) {
    t.remove();
  });
}

// ── DRAG WINDOWS ─────────────────────────────────────────────
var dragWin = null;
var dragOffX = 0;
var dragOffY = 0;

function dragStart(e, id) {
  bringToFront(id);
  dragWin = document.getElementById(id);
  var rect = dragWin.getBoundingClientRect();
  dragOffX = e.clientX - rect.left;
  dragOffY = e.clientY - rect.top;
  document.addEventListener('mousemove', dragMove);
  document.addEventListener('mouseup', dragEnd);
}

function dragMove(e) {
  if (!dragWin) return;
  var x = e.clientX - dragOffX;
  var y = e.clientY - dragOffY;
  x = Math.max(0, Math.min(window.innerWidth - dragWin.offsetWidth, x));
  y = Math.max(0, Math.min(window.innerHeight - dragWin.offsetHeight - 40, y));
  dragWin.style.left = x + 'px';
  dragWin.style.top = y + 'px';
}

function dragEnd() {
  dragWin = null;
  document.removeEventListener('mousemove', dragMove);
  document.removeEventListener('mouseup', dragEnd);
}

// ── FILE CONVERTER ────────────────────────────────────────────
window.addEventListener('load', function() {
  var dropZone = document.getElementById('dropZone');
  var fileInput = document.getElementById('fileInput');

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', function() { fileInput.click(); });

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

  // KML drop zone
  var kmlDrop = document.getElementById('kmlDrop');
  var kmlInput = document.getElementById('kmlInput');

  if (kmlDrop && kmlInput) {
    kmlInput.addEventListener('change', function() {
      if (kmlInput.files && kmlInput.files[0]) {
        document.getElementById('kmlFileName').textContent = '✅ ' + kmlInput.files[0].name;
        document.getElementById('kmlFields').style.display = 'block';
      }
    });

    kmlDrop.addEventListener('dragover', function(e) {
      e.preventDefault();
      kmlDrop.classList.add('dragover');
    });

    kmlDrop.addEventListener('dragleave', function() {
      kmlDrop.classList.remove('dragover');
    });

    kmlDrop.addEventListener('drop', function(e) {
      e.preventDefault();
      kmlDrop.classList.remove('dragover');
      var file = e.dataTransfer.files[0];
      if (file) {
        document.getElementById('kmlFileName').textContent = '✅ ' + file.name;
        document.getElementById('kmlFields').style.display = 'block';
      }
    });
  }
});

function onFileSelected(file) {
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

  document.getElementById('filePillName').textContent = file.name;
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
  showProgressBar();
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
      hideProgressBar();
      toast('Converted successfully!', 'success');
    });
  }).catch(function(err) {
    hideProgressBar();
    toast('Error: ' + err.message, 'error');
  });
}

function convertDocument(file, format) {
  showProgressBar();
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
    hideProgressBar();
    toast('Converted successfully!', 'success');
  }).catch(function(err) {
    hideProgressBar();
    toast('Error: ' + err.message, 'error');
  });
}

// ── CSV TO KML ────────────────────────────────────────────────
function convertToKML() {
  var file = document.getElementById('kmlInput').files[0];
  var lat = document.getElementById('kmlLat').value.trim();
  var lng = document.getElementById('kmlLng').value.trim();
  var name = document.getElementById('kmlName').value.trim();
  var desc = document.getElementById('kmlDesc').value.trim();

  if (!file) { toast('Please upload a file first!', 'error'); return; }
  if (!lat || !lng || !name) { toast('Please fill in Latitude, Longitude and Name!', 'error'); return; }

  toast('Converting to KML...', 'loading');
  var formData = new FormData();
  formData.append('file', file);
  formData.append('lat', lat);
  formData.append('lng', lng);
  formData.append('name', name);
  formData.append('desc', desc);

  fetch(BACKEND + '/csv-to-kml', {
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
    download(blob, 'output.kml');
    toast('KML file ready!', 'success');
  }).catch(function(err) {
    toast('Error: ' + err.message, 'error');
  });
}
