import express from 'express';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const LARAVEL_API_URL = process.env.LARAVEL_API_URL || 'http://localhost:8000';
const API_KEY = process.env.API_KEY || '';

app.use(cors());
app.use(express.json());

// Store active WhatsApp clients
const clients = new Map();
const sessionPath = './whatsapp-sessions';

// Ensure session directory exists
if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
}

// Middleware to check API key
const authenticate = (req, res, next) => {
    if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'whatsapp-bridge',
        clients: clients.size
    });
});

// Initialize a WhatsApp channel
app.post('/channels/initialize', authenticate, async (req, res) => {
    const { channel_id, organization_id, phone_number } = req.body;

    if (!channel_id) {
        return res.status(400).json({ error: 'channel_id is required' });
    }

    try {
        // If client already exists, return existing status
        if (clients.has(channel_id)) {
            const existingClient = clients.get(channel_id);
            const state = await existingClient.getState();
            
            return res.json({
                status: state === 'CONNECTED' ? 'connected' : 'pending_qr',
                message: 'Client already exists'
            });
        }

        // Create new client
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `channel-${channel_id}`,
                dataPath: sessionPath
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        // QR Code event
        client.on('qr', async (qr) => {
            console.log(`QR Code generated for channel ${channel_id}`);
            
            const qrDataUrl = await qrcode.toDataURL(qr);
            
            // Notify Laravel via webhook
            try {
                await axios.post(`${LARAVEL_API_URL}/api/webhooks/whatsapp`, {
                    event: 'qr',
                    channel_id: channel_id,
                    qr_code: qrDataUrl
                }, {
                    headers: { 'X-API-Key': API_KEY }
                });
            } catch (error) {
                console.error('Failed to send QR webhook:', error.message);
            }
        });

        // Ready event
        client.on('ready', async () => {
            console.log(`WhatsApp client ready for channel ${channel_id}`);
            
            // Notify Laravel
            try {
                await axios.post(`${LARAVEL_API_URL}/api/webhooks/whatsapp`, {
                    event: 'ready',
                    channel_id: channel_id
                }, {
                    headers: { 'X-API-Key': API_KEY }
                });
            } catch (error) {
                console.error('Failed to send ready webhook:', error.message);
            }
        });

        // Message event
        client.on('message', async (message) => {
            console.log(`Message received on channel ${channel_id}`);
            
            try {
                const contact = await message.getContact();
                
                await axios.post(`${LARAVEL_API_URL}/api/webhooks/whatsapp`, {
                    event: 'message',
                    channel_id: channel_id,
                    from: contact.number,
                    message: message.body,
                    message_id: message.id._serialized,
                    media_type: message.hasMedia ? 'media' : 'text'
                }, {
                    headers: { 'X-API-Key': API_KEY }
                });
            } catch (error) {
                console.error('Failed to send message webhook:', error.message);
            }
        });

        // Disconnected event
        client.on('disconnected', async (reason) => {
            console.log(`WhatsApp disconnected for channel ${channel_id}:`, reason);
            
            clients.delete(channel_id);
            
            try {
                await axios.post(`${LARAVEL_API_URL}/api/webhooks/whatsapp`, {
                    event: 'disconnected',
                    channel_id: channel_id,
                    reason: reason
                }, {
                    headers: { 'X-API-Key': API_KEY }
                });
            } catch (error) {
                console.error('Failed to send disconnect webhook:', error.message);
            }
        });

        // Store client
        clients.set(channel_id, client);

        // Initialize client
        await client.initialize();

        res.json({
            status: 'initializing',
            message: 'WhatsApp client is being initialized. Watch for QR code event.'
        });
    } catch (error) {
        console.error('Error initializing channel:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check channel status
app.get('/channels/:channelId/status', authenticate, async (req, res) => {
    const { channelId } = req.params;

    const client = clients.get(parseInt(channelId));
    if (!client) {
        return res.json({ status: 'disconnected', connected: false });
    }

    try {
        const state = await client.getState();
        res.json({
            status: state === 'CONNECTED' ? 'connected' : 'pending_qr',
            connected: state === 'CONNECTED'
        });
    } catch (error) {
        res.json({ status: 'error', connected: false, error: error.message });
    }
});

// Send text message
app.post('/messages/send', authenticate, async (req, res) => {
    const { channel_id, phone, message, message_id } = req.body;

    if (!channel_id || !phone || !message) {
        return res.status(400).json({ error: 'channel_id, phone, and message are required' });
    }

    const client = clients.get(channel_id);
    if (!client) {
        return res.status(404).json({ error: 'Channel not found or not connected' });
    }

    try {
        // Format phone number
        const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
        
        // Send message
        const sentMessage = await client.sendMessage(chatId, message);

        res.json({
            success: true,
            whatsapp_message_id: sentMessage.id._serialized,
            message_id: message_id
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send media message
app.post('/messages/send-media', authenticate, async (req, res) => {
    const { channel_id, phone, media_url, media_type, caption, message_id } = req.body;

    if (!channel_id || !phone || !media_url) {
        return res.status(400).json({ error: 'channel_id, phone, and media_url are required' });
    }

    const client = clients.get(channel_id);
    if (!client) {
        return res.status(404).json({ error: 'Channel not found or not connected' });
    }

    try {
        const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
        
        // Download and send media
        const media = await MessageMedia.fromUrl(media_url);
        const sentMessage = await client.sendMessage(chatId, media, { caption });

        res.json({
            success: true,
            whatsapp_message_id: sentMessage.id._serialized,
            message_id: message_id
        });
    } catch (error) {
        console.error('Error sending media:', error);
        res.status(500).json({ error: error.message });
    }
});

// Disconnect channel
app.post('/channels/:channelId/disconnect', authenticate, async (req, res) => {
    const { channelId } = req.params;

    const client = clients.get(parseInt(channelId));
    if (!client) {
        return res.json({ success: true, message: 'Channel already disconnected' });
    }

    try {
        await client.destroy();
        clients.delete(parseInt(channelId));
        res.json({ success: true, message: 'Channel disconnected successfully' });
    } catch (error) {
        console.error('Error disconnecting channel:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`WhatsApp Bridge API running on port ${PORT}`);
    console.log(`Laravel API URL: ${LARAVEL_API_URL}`);
    console.log(`API Key authentication: ${API_KEY ? 'enabled' : 'disabled'}`);
});
