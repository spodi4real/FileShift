var BACKEND = 'https://fileshift-production.up.railway.app';

function toast(message, type) {
  type = type || 'loading';
  var t = document.getElementById('statusToast');
  t.textContent = message;
  t.className = 'toast ' + type;
  t.classList.add('show');
  if (type !== 'loading') {
    setTimeout(function() { t.classList.remove('show'); }, 3500);
  }
}

function showHero() {
  document.getElementById('hero').style.display = 'flex';
  document.querySelectorAll('.section').forEach(function(s) {
    s.classList.remove('active');
  });
}

function showSection(id) {
  document.getElementById('hero').style.display = 'none';
  document.querySelectorAll('.section').forEach(function(s) {
    s.classList.remove('active');
  });
  document.getElementById('section-' + id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showTab(id) {
  var tabEl = document.getElementById('tab-' + id);
  var section = tabEl.closest('.section');
  section.querySelectorAll('.tab-content').forEach(function(t) {
    t.classList.remove('active');
  });
  section.querySelectorAll('.tab').forEach(function(t) {
    t.classList.remove('active');
  });
  tabEl.classList.add('active');
  section.querySelectorAll('.tab').forEach(function(t) {
    var onclick = t.getAttribute('onclick') || '';
    if (onclick.indexOf("'" + id + "'") !== -1) {
      t.classList.add('active');
    }
  });
}

function showImageTab(id) {
  var section = document.getElementById('section-image');
  section.querySelectorAll('.tab-content').forEach(function(t) {
    t.classList.remove('active');
  });
  section.querySelectorAll('.tab').forEach(function(t) {
    t.classList.remove('active');
  });
  document.getElementById('tab-' + id).classList.add('active');
  section.querySelectorAll('.tab').forEach(function(t) {
    var onclick = t.getAttribute('onclick') || '';
    if (onclick.indexOf("'" + id + "'") !== -1) {
      t.classList.add('active');
    }
  });
}

function download(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

async function postToBackend(endpoint, formData) {
  var response = await fetch(BACKEND + endpoint, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    var err = await response.json().catch(function() { return { error: 'Server error' }; });
    throw new Error(err.error || 'Request failed');
  }
  return await response.blob();
}

function setupDropZone(dropId, inputId, labelId, onFile) {
  var drop = document.getElementById(dropId);
  var input = document.getElementById(inputId);

  drop.addEventListener('click', function() { input.click(); });

  drop.addEventListener('dragover', function(e) {
    e.preventDefault();
    drop.classList.add('dragover');
  });

  drop.addEventListener('dragleave', function() {
    drop.classList.remove('dragover');
  });

  drop.addEventListener('drop', function(e) {
    e.preventDefault();
    drop.classList.remove('dragover');
    var file = e.dataTransfer.files[0];
    if (file) {
      try { input.files = e.dataTransfer.files; } catch(err) {}
      if (labelId) document.getElementById(labelId).textContent = '✅ ' + file.name;
      if (onFile) onFile(file);
    }
  });

  input.addEventListener('change', function() {
    var file = input.files[0];
    if (file) {
      if (labelId) document.getElementById(labelId).textContent = '✅ ' + file.name;
      if (onFile) onFile(file);
    }
  });
}

// FILE CONVERTER
setupDropZone('converterDrop', 'converterInput', 'converterFileName', function(file) {
  var name = file.name.toLowerCase();
  var formatSelect = document.getElementById('formatSelect');
  formatSelect.innerHTML = '';
  var formats = [];

  if (name.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/)) {
    formats = ['JPG', 'PNG', 'WebP', 'GIF', 'BMP'];
  } else if (name.match(/\.(mp3|wav|aac|flac|ogg)$/)) {
    formats = ['MP3', 'WAV', 'AAC', 'FLAC', 'OGG'];
  } else if (name.match(/\.(pdf|docx|txt|md|html|csv)$/)) {
    formats = ['PDF', 'TXT', 'HTML', 'CSV'];
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

  document.getElementById('converterFormatRow').style.display = 'flex';
});

async function handleConvert() {
  var file = document.getElementById('converterInput').files[0];
  var format = document.getElementById('formatSelect').value;
  if (!file || !format) { toast('Please upload a file and select a format!', 'error'); return; }
  var name = file.name.toLowerCase();

  if (name.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/)) {
    convertImage(file, format);
  } else if (name.match(/\.(mp3|wav|aac|flac|ogg)$/)) {
    convertAudio(file, format);
  } else {
    try {
      toast('Converting your file...', 'loading');
      var formData = new FormData();
      formData.append('file', file);
      formData.append('format', format);
      var blob = await postToBackend('/convert', formData);
      download(blob, 'fileshift-converted.' + format);
      toast('Converted successfully!', 'success');
    } catch(err) { toast(err.message, 'error'); }
  }
}

function convertImage(file, format) {
  toast('Converting image...', 'loading');
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      var mimeType = 'image/' + (format === 'jpg' ? 'jpeg' : format);
      canvas.toBlob(function(blob) {
        download(blob, 'fileshift-converted.' + format);
        toast('Image converted!', 'success');
      }, mimeType);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function convertAudio(file, format) {
  toast('Loading audio converter...', 'loading');
  try {
    var createFFmpeg = FFmpeg.createFFmpeg;
    var fetchFile = FFmpeg.fetchFile;
    var ffmpeg = createFFmpeg({ log: false });
    await ffmpeg.load();
    var inputName = 'input.' + file.name.split('.').pop();
    var outputName = 'output.' + format;
    ffmpeg.FS('writeFile', inputName, await fetchFile(file));
    await ffmpeg.run('-i', inputName, outputName);
    var data = ffmpeg.FS('readFile', outputName);
    var blob = new Blob([data.buffer], { type: 'audio/' + format });
    download(blob, 'fileshift-converted.' + format);
    toast('Audio converted!', 'success');
  } catch(err) { toast(err.message, 'error'); }
}

// PDF TOOLS
setupDropZone('mergeDrop', 'mergeInput', null, function() {
  var files = document.getElementById('mergeInput').files;
  var list = document.getElementById('mergeFileList');
  list.innerHTML = '';
  Array.from(files).forEach(function(f) {
    var item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = '<i class="fa-solid fa-file-pdf"></i> ' + f.name;
    list.appendChild(item);
  });
});

async function mergePDFs() {
  var files = document.getElementById('mergeInput').files;
  if (files.length < 2) { toast('Upload at least 2 PDFs!', 'error'); return; }
  try {
    toast('Merging PDFs...', 'loading');
    var formData = new FormData();
    Array.from(files).forEach(function(f) { formData.append('files', f); });
    var blob = await postToBackend('/pdf/merge', formData);
    download(blob, 'merged.pdf');
    toast('PDFs merged!', 'success');
  } catch(err) { toast(err.message, 'error'); }
}

setupDropZone('splitDrop', 'splitInput', 'splitFileName', null);
async function splitPDF() {
  var file = document.getElementById('splitInput').files[0];
  if (!file) { toast('Upload a PDF first!', 'error'); return; }
  try {
    toast('Splitting PDF...', 'loading');
    var formData = new FormData();
    formData.append('file', file);
    var blob = await postToBackend('/pdf/split', formData);
    download(blob, 'split_pages.zip');
    toast('PDF split! ZIP downloaded.', 'success');
  } catch(err) { toast(err.message, 'error'); }
}

setupDropZone('protectDrop', 'protectInput', 'protectFileName', null);
async function protectPDF() {
  var file = document.getElementById('protectInput').files[0];
  var password = document.getElementById('protectPassword').value;
  if (!file) { toast('Upload a PDF first!', 'error'); return; }
  if (!password) { toast('Enter a password!', 'error'); return; }
  try {
    toast('Protecting PDF...', 'loading');
    var formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);
    var blob = await postToBackend('/pdf/protect', formData);
    download(blob, 'protected.pdf');
    toast('PDF protected!', 'success');
  } catch(err) { toast(err.message, 'error'); }
}

setupDropZone('unlockDrop', 'unlockInput', 'unlockFileName', null);
async function unlockPDF() {
  var file = document.getElementById('unlockInput').files[0];
  var password = document.getElementById('unlockPassword').value;
  if (!file) { toast('Upload a PDF first!', 'error'); return; }
  if (!password) { toast('Enter the password!', 'error'); return; }
  try {
    toast('Unlocking PDF...', 'loading');
    var formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);
    var blob = await postToBackend('/pdf/unlock', formData);
    download(blob, 'unlocked.pdf');
    toast('PDF unlocked!', 'success');
  } catch(err) { toast(err.message, 'error'); }
}

setupDropZone('pageNumDrop', 'pageNumInput', 'pageNumFileName', null);
async function addPageNumbers() {
  var file = document.getElementById('pageNumInput').files[0];
  if (!file) { toast('Upload a PDF first!', 'error'); return; }
  try {
    toast('Adding page numbers...', 'loading');
    var formData = new FormData();
    formData.append('file', file);
    var blob = await postToBackend('/pdf/pagenumbers', formData);
    download(blob, 'numbered.pdf');
    toast('Page numbers added!', 'success');
  } catch(err) { toast(err.message, 'error'); }
}

setupDropZone('wordDrop', 'wordInput', 'wordFileName', null);
async function wordToPDF() {
  var file = document.getElementById('wordInput').files[0];
  if (!file) { toast('Upload a Word file first!', 'error'); return; }
  try {
    toast('Converting to PDF...', 'loading');
    var formData = new FormData();
    formData.append('file', file);
    formData.append('format', 'pdf');
    var blob = await postToBackend('/convert', formData);
    download(blob, 'converted.pdf');
    toast('Word converted to PDF!', 'success');
  } catch(err) { toast(err.message, 'error'); }
}

setupDropZone('imgPdfDrop', 'imgPdfInput', 'imgPdfFileName', null);
async function imageToPDF() {
  var file = document.getElementById('imgPdfInput').files[0];
  if (!file) { toast('Upload an image first!', 'error'); return; }
  try {
    toast('Converting to PDF...', 'loading');
    var formData = new FormData();
    formData.append('file', file);
    formData.append('format', 'pdf');
    var blob = await postToBackend('/convert', formData);
    download(blob, 'converted.pdf');
    toast('Image converted to PDF!', 'success');
  } catch(err) { toast(err.message, 'error'); }
}

// MEDIA DOWNLOADER
async function fetchMediaInfo() {
  var url = document.getElementById('mediaUrl').value.trim();
  if (!url) { toast('Paste a video URL first!', 'error'); return; }
  try {
    toast('Fetching video info...', 'loading');
    var formData = new FormData();
    formData.append('url', url);
    var response = await fetch(BACKEND + '/media/info', { method: 'POST', body: formData });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch');
    document.getElementById('mediaThumbnail').src = data.thumbnail;
    document.getElementById('mediaTitle').textContent = data.title;
    document.getElementById('mediaResult').style.display = 'block';
    toast('Video found!', 'success');
  } catch(err) { toast(err.message, 'error'); }
}

async function downloadMedia() {
  var url = document.getElementById('mediaUrl').value.trim();
  var format = document.getElementById('mediaFormat').value;
  if (!url) { toast('No URL found!', 'error'); return; }
  try {
    toast('Downloading... this may take a moment!', 'loading');
    var formData = new FormData();
    formData.append('url', url);
    formData.append('format', format);
    var response = await fetch(BACKEND + '/media/download', { method: 'POST', body: formData });
    if (!response.ok) {
      var err = await response.json().catch(function() { return { error: 'Download failed' }; });
      throw new Error(err.error);
    }
    var blob = await response.blob();
    var ext = format === 'mp3' ? 'mp3' : 'mp4';
    download(blob, 'fileshift-download.' + ext);
    toast('Downloaded!', 'success');
  } catch(err) { toast(err.message, 'error'); }
}

// REMOVE BACKGROUND
var removedBgBlob = null;

setupDropZone('removeBgDrop', 'removeBgInput', 'removeBgFileName', function(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('removeBgOriginal').src = e.target.result;
  };
  reader.readAsDataURL(file);
});

async function removeBackground() {
  var file = document.getElementById('removeBgInput').files[0];
  if (!file) { toast('Upload an image first!', 'error'); return; }
  try {
    toast('Removing background... this may take a moment!', 'loading');
    var formData = new FormData();
    formData.append('file', file);
    var blob = await postToBackend('/remove-bg', formData);
    removedBgBlob = blob;
    var url = URL.createObjectURL(blob);
    document.getElementById('removeBgResult').src = url;
    document.getElementById('removeBgPreview').style.display = 'block';
    document.getElementById('removeBgBtn').style.display = 'none';
    toast('Background removed!', 'success');
  } catch(err) { toast(err.message, 'error'); }
}

function downloadRemovedBg() {
  if (removedBgBlob) download(removedBgBlob, 'no-background.png');
}

// CROP IMAGE
var cropImg = null;
var cropRect = { x: 0, y: 0, w: 0, h: 0 };
var dragging = null;
var dragStart = { x: 0, y: 0 };
var originalRect = {};
var cropHandlesSetup = false;

setupDropZone('cropDrop', 'cropInput', 'cropFileName', function(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    cropImg = new Image();
    cropImg.onload = function() {
      var canvas = document.getElementById('cropCanvas');
      var maxW = Math.min(cropImg.width, 700);
      var scale = maxW / cropImg.width;
      canvas.width = maxW;
      canvas.height = cropImg.height * scale;
      canvas.getContext('2d').drawImage(cropImg, 0, 0, canvas.width, canvas.height);
      cropRect = { x: 0, y: 0, w: canvas.width, h: canvas.height };
      updateOverlay();
      document.getElementById('cropArea').style.display = 'block';
      if (!cropHandlesSetup) {
        setupCropHandles();
        cropHandlesSetup = true;
      }
    };
    cropImg.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

function updateOverlay() {
  var overlay = document.getElementById('cropOverlay');
  var canvas = document.getElementById('cropCanvas');
  var scaleX = canvas.offsetWidth / canvas.width;
  var scaleY = canvas.offsetHeight / canvas.height;
  overlay.style.left = (cropRect.x * scaleX) + 'px';
  overlay.style.top = (cropRect.y * scaleY) + 'px';
  overlay.style.width = (cropRect.w * scaleX) + 'px';
  overlay.style.height = (cropRect.h * scaleY) + 'px';
  document.getElementById('cropDimensions').textContent = 'W: ' + Math.round(cropRect.w) + 'px  H: ' + Math.round(cropRect.h) + 'px';
}

function setupCropHandles() {
  var canvas = document.getElementById('cropCanvas');
  var overlay = document.getElementById('cropOverlay');

  function getScale() {
    return {
      x: canvas.width / canvas.offsetWidth,
      y: canvas.height / canvas.offsetHeight
    };
  }

  ['tl', 'tr', 'bl', 'br'].forEach(function(handle) {
    var el = document.getElementById('handle-' + handle);
    el.addEventListener('mousedown', function(e) {
      e.stopPropagation();
      dragging = handle;
      dragStart = { x: e.clientX, y: e.clientY };
      originalRect = { x: cropRect.x, y: cropRect.y, w: cropRect.w, h: cropRect.h };
    });
  });

  overlay.addEventListener('mousedown', function(e) {
    if (e.target === overlay) {
      dragging = 'move';
      dragStart = { x: e.clientX, y: e.clientY };
      originalRect = { x: cropRect.x, y: cropRect.y, w: cropRect.w, h: cropRect.h };
    }
  });

  document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    var scale = getScale();
    var dx = (e.clientX - dragStart.x) * scale.x;
    var dy = (e.clientY - dragStart.y) * scale.y;

    if (dragging === 'move') {
      cropRect.x = Math.max(0, Math.min(canvas.width - cropRect.w, originalRect.x + dx));
      cropRect.y = Math.max(0, Math.min(canvas.height - cropRect.h, originalRect.y + dy));
    } else if (dragging === 'br') {
      cropRect.w = Math.max(20, Math.min(canvas.width - cropRect.x, originalRect.w + dx));
      cropRect.h = Math.max(20, Math.min(canvas.height - cropRect.y, originalRect.h + dy));
    } else if (dragging === 'tl') {
      var newX = Math.max(0, Math.min(originalRect.x + originalRect.w - 20, originalRect.x + dx));
      var newY = Math.max(0, Math.min(originalRect.y + originalRect.h - 20, originalRect.y + dy));
      cropRect.w = originalRect.w + (originalRect.x - newX);
      cropRect.h = originalRect.h + (originalRect.y - newY);
      cropRect.x = newX;
      cropRect.y = newY;
    } else if (dragging === 'tr') {
      var newY2 = Math.max(0, Math.min(originalRect.y + originalRect.h - 20, originalRect.y + dy));
      cropRect.w = Math.max(20, Math.min(canvas.width - cropRect.x, originalRect.w + dx));
      cropRect.h = originalRect.h + (originalRect.y - newY2);
      cropRect.y = newY2;
    } else if (dragging === 'bl') {
      var newX2 = Math.max(0, Math.min(originalRect.x + originalRect.w - 20, originalRect.x + dx));
      cropRect.w = originalRect.w + (originalRect.x - newX2);
      cropRect.h = Math.max(20, Math.min(canvas.height - cropRect.y, originalRect.h + dy));
      cropRect.x = newX2;
    }
    updateOverlay();
  });

  document.addEventListener('mouseup', function() { dragging = null; });
}

function cropImage() {
  if (!cropImg) { toast('Upload an image first!', 'error'); return; }
  var canvas = document.getElementById('cropCanvas');
  var scaleX = cropImg.width / canvas.width;
  var scaleY = cropImg.height / canvas.height;
  var cropCanvas = document.createElement('canvas');
  cropCanvas.width = Math.round(cropRect.w * scaleX);
  cropCanvas.height = Math.round(cropRect.h * scaleY);
  cropCanvas.getContext('2d').drawImage(
    cropImg,
    cropRect.x * scaleX, cropRect.y * scaleY,
    cropRect.w * scaleX, cropRect.h * scaleY,
    0, 0, cropCanvas.width, cropCanvas.height
  );
  cropCanvas.toBlob(function(blob) {
    download(blob, 'cropped.png');
    toast('Image cropped!', 'success');
  });
}

// CSV TO KML
setupDropZone('kmlDrop', 'kmlInput', 'kmlFileName', null);

async function convertToKML() {
  var file = document.getElementById('kmlInput').files[0];
  var lat = document.getElementById('kmlLat').value;
  var lng = document.getElementById('kmlLng').value;
  var name = document.getElementById('kmlName').value;
  var desc = document.getElementById('kmlDesc').value;
  if (!file) { toast('Upload a file first!', 'error'); return; }
  if (!lat || !lng || !name) { toast('Please fill in Latitude, Longitude and Name!', 'error'); return; }
  try {
    toast('Converting to KML...', 'loading');
    var formData = new FormData();
    formData.append('file', file);
    formData.append('lat', lat);
    formData.append('lng', lng);
    formData.append('name', name);
    formData.append('desc', desc);
    var blob = await postToBackend('/csv-to-kml', formData);
    download(blob, 'output.kml');
    toast('KML file ready!', 'success');
  } catch(err) { toast(err.message, 'error'); }
}