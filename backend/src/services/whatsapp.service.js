import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import { query } from '../config/database.js';
import { logger } from '../middleware/errorHandler.js';
import mediaService from './media.service.js';
import fs from 'fs';
import path from 'path';

class WhatsAppService {
  constructor() {
    this.clients = new Map();
    this.sessionPath = './whatsapp-sessions';
    
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }
  }

  async initializeChannel(channelId, organizationId, io) {
    try {
      if (this.clients.has(channelId)) {
        logger.info(`Channel ${channelId} already initialized`);
        return;
      }

      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: `channel-${channelId}`,
          dataPath: this.sessionPath
        }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      // QR Code event
      client.on('qr', async (qr) => {
        logger.info(`QR Code generated for channel ${channelId}`);
        
        const qrDataUrl = await qrcode.toDataURL(qr);
        
        await query(
          'UPDATE channels SET status = $1, qr_code = $2, updated_at = NOW() WHERE id = $3',
          ['pending_qr', qrDataUrl, channelId]
        );
        
        io.to(`org-${organizationId}`).emit('whatsapp_qr', {
          channelId,
          qrCode: qrDataUrl
        });
      });

      // Ready event
      client.on('ready', async () => {
        logger.info(`WhatsApp client ready for channel ${channelId}`);
        
        await query(
          'UPDATE channels SET status = $1, qr_code = NULL, updated_at = NOW() WHERE id = $2',
          ['connected', channelId]
        );
        
        io.to(`org-${organizationId}`).emit('whatsapp_connected', {
          channelId,
          status: 'connected'
        });
      });

      // Authenticated event
      client.on('authenticated', () => {
        logger.info(`WhatsApp authenticated for channel ${channelId}`);
      });

      // Auth failure
      client.on('auth_failure', async (msg) => {
        logger.error(`Auth failure for channel ${channelId}:`, msg);
        
        await query(
          'UPDATE channels SET status = $1, updated_at = NOW() WHERE id = $2',
          ['disconnected', channelId]
        );
      });

      // Disconnected
      client.on('disconnected', async (reason) => {
        logger.warn(`WhatsApp disconnected for channel ${channelId}:`, reason);
        
        await query(
          'UPDATE channels SET status = $1, updated_at = NOW() WHERE id = $2',
          ['disconnected', channelId]
        );
        
        this.clients.delete(channelId);
        
        io.to(`org-${organizationId}`).emit('whatsapp_disconnected', {
          channelId
        });
      });

      // Message received
      client.on('message', async (message) => {
        await this.handleIncomingMessage(message, channelId, organizationId);
      });

      this.clients.set(channelId, client);
      await client.initialize();
      
      logger.info(`WhatsApp client initialized for channel ${channelId}`);
    } catch (error) {
      logger.error(`Error initializing WhatsApp channel ${channelId}:`, error);
      throw error;
    }
  }

  async handleIncomingMessage(message, channelId, organizationId) {
    try {
      const phoneNumber = message.from.replace('@c.us', '');
      
      // Find or create contact
      let contactResult = await query(
        'SELECT * FROM contacts WHERE organization_id = $1 AND phone = $2',
        [organizationId, phoneNumber]
      );
      
      let contact;
      if (contactResult.rows.length === 0) {
        const insertResult = await query(
          `INSERT INTO contacts (organization_id, phone, name, channel_type) 
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [organizationId, phoneNumber, message.notifyName || phoneNumber, 'whatsapp']
        );
        contact = insertResult.rows[0];
      } else {
        contact = contactResult.rows[0];
      }
      
      // Determine message type and save
      let mediaType = 'text';
      let mediaUrl = null;
      let mediaFilename = null;
      let mediaMimetype = null;
      
      if (message.hasMedia) {
        const media = await message.downloadMedia();
        mediaType = this.getMediaType(media.mimetype);
        
        // Save media file
        const buffer = Buffer.from(media.data, 'base64');
        const savedMedia = await mediaService.saveFile(
          buffer,
          `received_${Date.now()}.${this.getExtension(media.mimetype)}`,
          media.mimetype,
          organizationId,
          null
        );
        
        mediaUrl = savedMedia.file_path;
        mediaFilename = savedMedia.file_name;
        mediaMimetype = media.mimetype;
      }
      
      // Save message
      await query(
        `INSERT INTO messages (contact_id, channel_id, content, type, message_id, media_type, media_url, media_filename, media_mimetype, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [contact.id, channelId, message.body || '', 'inbound', message.id._serialized, mediaType, mediaUrl, mediaFilename, mediaMimetype]
      );
      
      logger.info(`Received ${mediaType} message from ${phoneNumber}: ${message.body || '[media]'}`);
      
      // Trigger flow execution
      const { default: queueService } = await import('./queue.service.js');
      await queueService.addFlowExecutionJob({
        contactId: contact.id,
        message: message.body || '[media]',
        organizationId
      });
      
    } catch (error) {
      logger.error('Error handling incoming message:', error);
    }
  }

  /**
   * Send text message
   */
  async sendMessage(channelId, phoneNumber, content) {
    try {
      const client = this.clients.get(channelId);
      
      if (!client) {
        throw new Error(`WhatsApp client not initialized for channel ${channelId}`);
      }
      
      const chatId = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
      await client.sendMessage(chatId, content);
      
      logger.info(`Message sent to ${phoneNumber}: ${content}`);
      return true;
    } catch (error) {
      logger.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Send media (image, video, audio, document)
   */
  async sendMedia(channelId, phoneNumber, mediaPath, caption = '', mimetype = null) {
    try {
      const client = this.clients.get(channelId);
      
      if (!client) {
        throw new Error(`WhatsApp client not initialized for channel ${channelId}`);
      }
      
      const chatId = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
      
      // Read file and create MessageMedia
      const mediaBuffer = fs.readFileSync(mediaPath);
      const base64Data = mediaBuffer.toString('base64');
      
      const media = new MessageMedia(
        mimetype || this.getMimeType(mediaPath),
        base64Data,
        path.basename(mediaPath)
      );
      
      await client.sendMessage(chatId, media, { caption });
      
      logger.info(`Media sent to ${phoneNumber}: ${path.basename(mediaPath)}`);
      return true;
    } catch (error) {
      logger.error('Error sending media:', error);
      throw error;
    }
  }

  /**
   * Send voice note (audio with PTT flag)
   */
  async sendVoiceNote(channelId, phoneNumber, audioPath) {
    try {
      const client = this.clients.get(channelId);
      
      if (!client) {
        throw new Error(`WhatsApp client not initialized for channel ${channelId}`);
      }
      
      const chatId = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
      
      // Read audio file
      const audioBuffer = fs.readFileSync(audioPath);
      const base64Data = audioBuffer.toString('base64');
      
      const media = new MessageMedia(
        'audio/ogg; codecs=opus',
        base64Data,
        path.basename(audioPath)
      );
      
      // Send with PTT (Push To Talk) flag for voice note
      await client.sendMessage(chatId, media, { sendAudioAsVoice: true });
      
      logger.info(`Voice note sent to ${phoneNumber}`);
      return true;
    } catch (error) {
      logger.error('Error sending voice note:', error);
      throw error;
    }
  }

  /**
   * Send multiple media in sequence
   */
  async sendMediaSequence(channelId, phoneNumber, mediaItems, delayBetweenMs = 2000) {
    try {
      for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        
        if (item.type === 'text') {
          await this.sendMessage(channelId, phoneNumber, item.content);
        } else if (item.type === 'voice') {
          await this.sendVoiceNote(channelId, phoneNumber, item.mediaPath);
        } else {
          await this.sendMedia(channelId, phoneNumber, item.mediaPath, item.caption, item.mimetype);
        }
        
        // Wait between messages (except for last one)
        if (i < mediaItems.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenMs));
        }
      }
      
      logger.info(`Sequence of ${mediaItems.length} items sent to ${phoneNumber}`);
      return true;
    } catch (error) {
      logger.error('Error sending media sequence:', error);
      throw error;
    }
  }

  async disconnectChannel(channelId) {
    try {
      const client = this.clients.get(channelId);
      
      if (client) {
        await client.destroy();
        this.clients.delete(channelId);
        
        await query(
          'UPDATE channels SET status = $1, updated_at = NOW() WHERE id = $2',
          ['disconnected', channelId]
        );
        
        logger.info(`WhatsApp channel ${channelId} disconnected`);
      }
    } catch (error) {
      logger.error(`Error disconnecting channel ${channelId}:`, error);
      throw error;
    }
  }

  getClient(channelId) {
    return this.clients.get(channelId);
  }

  getMediaType(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'document';
  }

  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.3gpp': 'video/3gpp',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.opus': 'audio/opus',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  getExtension(mimetype) {
    const extensions = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/3gpp': '3gp',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/opus': 'opus',
      'application/pdf': 'pdf'
    };
    return extensions[mimetype] || 'dat';
  }
}

export default new WhatsAppService();