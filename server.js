// server.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { BlobServiceClient } = require('@azure/storage-blob');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // serve frontend

// Multer memory storage
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } }); // 200MB limit

const AZ_CONN_STR = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.CONTAINER_NAME || 'myfiles';
if (!AZ_CONN_STR) {
  console.error('AZURE_STORAGE_CONNECTION_STRING missing in .env');
  process.exit(1);
}

const blobServiceClient = BlobServiceClient.fromConnectionString(AZ_CONN_STR);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

// ensure container exists
async function ensureContainer() {
  const exists = await containerClient.exists();
  if (!exists) {
    await containerClient.create();
    console.log('Created container:', CONTAINER_NAME);
  } else {
    console.log('Container exists:', CONTAINER_NAME);
  }
}
ensureContainer().catch(err => {
  console.error('Error ensuring container:', err.message);
  process.exit(1);
});

// Upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const blobName = req.file.originalname;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const uploadOptions = { blobHTTPHeaders: { blobContentType: req.file.mimetype } };
    await blockBlobClient.uploadData(req.file.buffer, uploadOptions);
    res.json({ success: true, name: blobName });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// List files
app.get('/files', async (req, res) => {
  try {
    const files = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      files.push({ name: blob.name, size: blob.properties.contentLength || 0 });
    }
    res.json(files);
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ error: 'Could not list files' });
  }
});

// Download
app.get('/download/:name', async (req, res) => {
  try {
    const name = req.params.name;
    const blockBlobClient = containerClient.getBlockBlobClient(name);
    const exists = await blockBlobClient.exists();
    if (!exists) return res.status(404).send('Not found');

    const buffer = await blockBlobClient.downloadToBuffer();
    let contentType = 'application/octet-stream';
    try {
      const props = await blockBlobClient.getProperties();
      contentType = props.contentType || contentType;
    } catch (_) {}
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(name)}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('Download failed');
  }
});

// Delete
app.delete('/delete/:name', async (req, res) => {
  try {
    const name = req.params.name;
    const blockBlobClient = containerClient.getBlockBlobClient(name);
    const result = await blockBlobClient.deleteIfExists();
    res.json({ deleted: result.succeeded });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).send('Delete failed');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
