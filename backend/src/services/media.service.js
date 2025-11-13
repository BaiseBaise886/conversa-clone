import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { query } from '../config/database.js';
import { logger } from '../middleware/errorHandler.js';
import crypto from 'crypto';

class MediaService {
  constructor() {
    this.uploadPath = config.media.uploadPath;
    
    // Create upload directory if it doesn't exist
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
    
    // Create subdirectories
    ['images', 'videos', 'audio', 'documents'].forEach(dir => {
      const fullPath = path.join(this.uploadPath, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });
  }

  /**
   * Save uploaded file
   */
  async saveFile(fileBuffer, filename, mimetype, organizationId, uploadedBy) {
    try {
      const fileType = this.getFileType(mimetype);
      const ext = path.extname(filename);
      const uniqueName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
      const subDir = this.getSubDirectory(fileType);
      const filePath = path.join(this.uploadPath, subDir, uniqueName);
      
      // Write file
      fs.writeFileSync(filePath, fileBuffer);
      
      const fileSize = fileBuffer.length;
      
      // Save to database
      const result = await query(
        `INSERT INTO media_library 
         (organization_id, file_name, file_type, mime_type, file_size, file_path, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [organizationId, filename, fileType, mimetype, fileSize, filePath, uploadedBy]
      );
      
      logger.info(`File saved: ${filename} (${fileType})`);
      return result.rows[0];
      
    } catch (error) {
      logger.error('Error saving file:', error);
      throw error;
    }
  }

  /**
   * Get file type from mimetype
   */
  getFileType(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'document';
  }

  /**
   * Get subdirectory based on file type
   */
  getSubDirectory(fileType) {
    switch (fileType) {
      case 'image': return 'images';
      case 'video': return 'videos';
      case 'audio': return 'audio';
      default: return 'documents';
    }
  }

  /**
   * Validate file
   */
  validateFile(mimetype, fileSize) {
    const allAllowed = [
      ...config.media.allowedImageTypes,
      ...config.media.allowedVideoTypes,
      ...config.media.allowedAudioTypes,
      ...config.media.allowedDocTypes
    ];
    
    if (!allAllowed.includes(mimetype)) {
      throw new Error(`File type ${mimetype} not allowed`);
    }
    
    if (fileSize > config.media.maxFileSize) {
      throw new Error(`File size exceeds maximum of ${config.media.maxFileSize} bytes`);
    }
    
    return true;
  }

  /**
   * Get media library items
   */
  async getMediaLibrary(organizationId, fileType = null) {
    try {
      let sql = 'SELECT * FROM media_library WHERE organization_id = $1';
      const params = [organizationId];
      
      if (fileType) {
        sql += ' AND file_type = $2';
        params.push(fileType);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting media library:', error);
      throw error;
    }
  }

  /**
   * Get media file by ID
   */
  async getMediaById(mediaId, organizationId) {
    try {
      const result = await query(
        'SELECT * FROM media_library WHERE id = $1 AND organization_id = $2',
        [mediaId, organizationId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Media not found');
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting media by ID:', error);
      throw error;
    }
  }

  /**
   * Delete media file
   */
  async deleteMedia(mediaId, organizationId) {
    try {
      const media = await this.getMediaById(mediaId, organizationId);
      
      // Delete physical file
      if (fs.existsSync(media.file_path)) {
        fs.unlinkSync(media.file_path);
      }
      
      // Delete from database
      await query(
        'DELETE FROM media_library WHERE id = $1',
        [mediaId]
      );
      
      logger.info(`Media deleted: ${media.file_name}`);
      return true;
    } catch (error) {
      logger.error('Error deleting media:', error);
      throw error;
    }
  }

  /**
   * Create message sequence
   */
  async createSequence(organizationId, sequenceName, items, delayBetweenMs = 2000) {
    try {
      const result = await query(
        `INSERT INTO message_sequences (organization_id, sequence_name, items, delay_between_ms)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [organizationId, sequenceName, JSON.stringify(items), delayBetweenMs]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating sequence:', error);
      throw error;
    }
  }

  /**
   * Get file buffer for sending
   */
  getFileBuffer(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }
      return fs.readFileSync(filePath);
    } catch (error) {
      logger.error('Error reading file:', error);
      throw error;
    }
  }

  /**
   * Get file extension from mimetype
   */
  getExtensionFromMimetype(mimetype) {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/3gpp': '.3gp',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'audio/opus': '.opus',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
    };
    return extensions[mimetype] || '';
  }

  /**
   * Clean up old files
   */
  async cleanupOldFiles(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const result = await query(
        'SELECT * FROM media_library WHERE created_at < $1',
        [cutoffDate]
      );
      
      let deletedCount = 0;
      for (const file of result.rows) {
        try {
          if (fs.existsSync(file.file_path)) {
            fs.unlinkSync(file.file_path);
          }
          await query('DELETE FROM media_library WHERE id = $1', [file.id]);
          deletedCount++;
        } catch (error) {
          logger.error(`Error deleting file ${file.id}:`, error);
        }
      }
      
      logger.info(`Cleaned up ${deletedCount} old media files`);
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up old files:', error);
      return 0;
    }
  }
}

export default new MediaService();