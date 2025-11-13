import express from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import mediaService from '../services/media.service.js';
import { config } from '../config/index.js';
import { query } from '../config/database.js';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.media.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    try {
      mediaService.validateFile(file.mimetype, file.size);
      cb(null, true);
    } catch (error) {
      cb(new Error(error.message));
    }
  }
});

// Upload single file
router.post('/upload', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    // Save file
    const media = await mediaService.saveFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      req.organizationId,
      req.user.id
    );
    
    res.json(media);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Upload multiple files
router.post('/upload-multiple', authenticate, upload.array('files', 10), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  
  try {
    const uploadedFiles = [];
    
    for (const file of req.files) {
      const media = await mediaService.saveFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        req.organizationId,
        req.user.id
      );
      
      uploadedFiles.push(media);
    }
    
    res.json(uploadedFiles);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Get media library
router.get('/library', authenticate, asyncHandler(async (req, res) => {
  const { type, page = 1, limit = 50 } = req.query;
  
  const media = await mediaService.getMediaLibrary(req.organizationId, type);
  
  // Paginate
  const start = (page - 1) * limit;
  const end = start + parseInt(limit);
  const paginated = media.slice(start, end);
  
  res.json({
    data: paginated,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: media.length,
      totalPages: Math.ceil(media.length / limit)
    }
  });
}));

// Get single media
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const media = await mediaService.getMediaById(parseInt(req.params.id), req.organizationId);
  res.json(media);
}));

// Serve media file
router.get('/:id/file', authenticate, asyncHandler(async (req, res) => {
  const media = await mediaService.getMediaById(parseInt(req.params.id), req.organizationId);
  
  if (!fs.existsSync(media.file_path)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }
  
  res.setHeader('Content-Type', media.mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${media.file_name}"`);
  
  const fileStream = fs.createReadStream(media.file_path);
  fileStream.pipe(res);
}));

// Download media file
router.get('/:id/download', authenticate, asyncHandler(async (req, res) => {
  const media = await mediaService.getMediaById(parseInt(req.params.id), req.organizationId);
  
  if (!fs.existsSync(media.file_path)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }
  
  res.setHeader('Content-Type', media.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename="${media.file_name}"`);
  
  const fileStream = fs.createReadStream(media.file_path);
  fileStream.pipe(res);
}));

// Delete media
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  await mediaService.deleteMedia(parseInt(req.params.id), req.organizationId);
  res.json({ success: true });
}));

// Create message sequence
router.post('/sequence', authenticate, asyncHandler(async (req, res) => {
  const { sequenceName, items, delayBetweenMs } = req.body;
  
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Items array required' });
  }
  
  const sequence = await mediaService.createSequence(
    req.organizationId,
    sequenceName,
    items,
    delayBetweenMs
  );
  
  res.json(sequence);
}));

// Get sequences
router.get('/sequences/list', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM message_sequences WHERE organization_id = $1 ORDER BY created_at DESC',
    [req.organizationId]
  );
  
  res.json(result.rows);
}));

// Get single sequence
router.get('/sequences/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM message_sequences WHERE id = $1 AND organization_id = $2',
    [req.params.id, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Sequence not found' });
  }
  
  res.json(result.rows[0]);
}));

// Delete sequence
router.delete('/sequences/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'DELETE FROM message_sequences WHERE id = $1 AND organization_id = $2 RETURNING id',
    [req.params.id, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Sequence not found' });
  }
  
  res.json({ success: true });
}));

// Get media statistics
router.get('/stats/summary', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT 
       COUNT(*) as total_files,
       COUNT(*) FILTER (WHERE file_type = 'image') as images,
       COUNT(*) FILTER (WHERE file_type = 'video') as videos,
       COUNT(*) FILTER (WHERE file_type = 'audio') as audio,
       COUNT(*) FILTER (WHERE file_type = 'document') as documents,
       SUM(file_size) as total_size,
       AVG(file_size) as avg_size
     FROM media_library
     WHERE organization_id = $1`,
    [req.organizationId]
  );
  
  const stats = result.rows[0];
  
  // Format size in MB
  stats.total_size_mb = stats.total_size ? (parseInt(stats.total_size) / (1024 * 1024)).toFixed(2) : 0;
  stats.avg_size_mb = stats.avg_size ? (parseFloat(stats.avg_size) / (1024 * 1024)).toFixed(2) : 0;
  
  res.json(stats);
}));

export default router;