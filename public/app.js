async function listFiles() {
  const res = await fetch('/files');
  const files = await res.json();
  const ul = document.getElementById('fileList');
  ul.innerHTML = '';
  files.forEach(f => {
    const li = document.createElement('li');
    li.textContent = `${f.name} (${Math.round(f.size/1024)} KB) `;
    const dl = document.createElement('button');
    dl.textContent = 'Download';
    dl.onclick = () => downloadFile(f.name);
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = () => deleteFile(f.name);
    li.appendChild(dl);
    li.appendChild(del);
    ul.appendChild(li);
  });
}

async function uploadFile() {
  const input = document.getElementById('fileInput');
  if (!input.files.length) return alert('Select a file first');
  const file = input.files[0];
  const form = new FormData();
  form.append('file', file);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/upload');
  const progress = document.getElementById('progress');
  progress.style.display = 'inline';
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) progress.value = (e.loaded / e.total) * 100;
  };
  xhr.onload = () => {
    progress.style.display = 'none';
    if (xhr.status === 200) {
      listFiles();
      alert('Upload complete');
    } else {
      alert('Upload failed');
    }
  };
  xhr.onerror = () => {
    progress.style.display = 'none';
    alert('Upload error');
  };
  xhr.send(form);
}

async function downloadFile(name) {
  const res = await fetch(`/download/${encodeURIComponent(name)}`);
  if (!res.ok) return alert('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function deleteFile(name) {
  if (!confirm('Delete ' + name + '?')) return;
  const res = await fetch(`/delete/${encodeURIComponent(name)}`, { method: 'DELETE' });
  if (res.ok) listFiles(); else alert('Delete failed');
}

document.getElementById('uploadBtn').addEventListener('click', uploadFile);
listFiles();
