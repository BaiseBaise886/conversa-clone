// ==UserScript==
// @name         Conversa WhatsApp Automation
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  WhatsApp Web automation using WA-JS with Laravel backend integration
// @author       BaiseBaise886
// @match        https://web.whatsapp.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=whatsapp.com
// @require      https://github.com/wppconnect-team/wa-js/releases/download/nightly/wppconnect-wa.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @connect      localhost
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        laravelApiUrl: GM_getValue('laravelApiUrl', 'http://localhost:8000'),
        apiKey: GM_getValue('apiKey', ''),
        channelId: GM_getValue('channelId', null),
        organizationId: GM_getValue('organizationId', null),
        autoConnect: GM_getValue('autoConnect', true),
        pollInterval: 5000, // Poll for new messages every 5 seconds
    };

    // State
    let isConnected = false;
    let isInitialized = false;
    let messageQueue = [];
    let pollTimer = null;

    // UI Elements
    let controlPanel = null;

    /**
     * Initialize WA-JS and set up event listeners
     */
    async function initialize() {
        if (isInitialized) return;

        console.log('[Conversa] Initializing WA-JS...');

        try {
            // Wait for WPP to be available
            await waitForWPP();

            // Initialize WPP
            await WPP.webpack.injectLoader();
            console.log('[Conversa] WPP loaded successfully');

            // Set up event listeners
            setupEventListeners();

            // Create control panel
            createControlPanel();

            isInitialized = true;

            // Auto-connect if enabled
            if (CONFIG.autoConnect && CONFIG.channelId) {
                await notifyLaravel('ready');
                startMessagePolling();
            }

            GM_notification({
                title: 'Conversa WhatsApp',
                text: 'Automation script loaded successfully!',
                timeout: 3000
            });

        } catch (error) {
            console.error('[Conversa] Initialization error:', error);
            GM_notification({
                title: 'Conversa Error',
                text: 'Failed to initialize: ' + error.message,
                timeout: 5000
            });
        }
    }

    /**
     * Wait for WPP to be available
     */
    function waitForWPP() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 30;

            const check = setInterval(() => {
                attempts++;
                if (typeof WPP !== 'undefined') {
                    clearInterval(check);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(check);
                    reject(new Error('WPP not available after 30 attempts'));
                }
            }, 1000);
        });
    }

    /**
     * Set up WA-JS event listeners
     */
    function setupEventListeners() {
        // Listen for incoming messages
        WPP.whatsapp.MsgStore.on('add', async (msg) => {
            if (msg.isNewMsg && !msg.isSentByMe) {
                console.log('[Conversa] New message received:', msg);
                await handleIncomingMessage(msg);
            }
        });

        // Listen for connection status changes
        WPP.conn.on('change:state', (state) => {
            console.log('[Conversa] Connection state:', state);
            isConnected = state === 'CONNECTED';
            updateControlPanel();

            if (isConnected && CONFIG.channelId) {
                notifyLaravel('connected');
            }
        });
    }

    /**
     * Handle incoming WhatsApp message
     */
    async function handleIncomingMessage(msg) {
        try {
            const contact = await msg.getContact();
            const messageData = {
                event: 'message',
                channel_id: CONFIG.channelId,
                from: contact.id._serialized.replace('@c.us', ''),
                message: msg.body,
                message_id: msg.id._serialized,
                media_type: msg.type || 'chat',
                timestamp: msg.t * 1000,
            };

            // Send to Laravel webhook
            await sendToLaravel('/api/webhooks/whatsapp', messageData);

        } catch (error) {
            console.error('[Conversa] Error handling incoming message:', error);
        }
    }

    /**
     * Send message via WhatsApp
     */
    async function sendMessage(phone, message, options = {}) {
        try {
            const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
            const result = await WPP.chat.sendTextMessage(chatId, message);
            
            console.log('[Conversa] Message sent:', result);
            return {
                success: true,
                messageId: result.id._serialized,
            };
        } catch (error) {
            console.error('[Conversa] Error sending message:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Send media via WhatsApp
     */
    async function sendMedia(phone, mediaUrl, caption = '', type = 'image') {
        try {
            const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
            
            // Download media
            const mediaData = await downloadMedia(mediaUrl);
            
            let result;
            switch (type) {
                case 'image':
                    result = await WPP.chat.sendFileMessage(chatId, mediaData, {
                        caption: caption,
                        type: 'image',
                    });
                    break;
                case 'video':
                    result = await WPP.chat.sendFileMessage(chatId, mediaData, {
                        caption: caption,
                        type: 'video',
                    });
                    break;
                case 'audio':
                    result = await WPP.chat.sendFileMessage(chatId, mediaData, {
                        type: 'audio',
                    });
                    break;
                case 'document':
                    result = await WPP.chat.sendFileMessage(chatId, mediaData, {
                        caption: caption,
                        type: 'document',
                    });
                    break;
                default:
                    result = await WPP.chat.sendFileMessage(chatId, mediaData);
            }

            console.log('[Conversa] Media sent:', result);
            return {
                success: true,
                messageId: result.id._serialized,
            };
        } catch (error) {
            console.error('[Conversa] Error sending media:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Download media from URL
     */
    function downloadMedia(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                onload: (response) => {
                    resolve(response.response);
                },
                onerror: (error) => {
                    reject(error);
                }
            });
        });
    }

    /**
     * Poll Laravel for pending messages to send
     */
    async function pollForMessages() {
        if (!CONFIG.channelId || !isConnected) return;

        try {
            const response = await sendToLaravel(`/api/channels/${CONFIG.channelId}/pending-messages`);
            
            if (response && response.messages) {
                for (const msg of response.messages) {
                    if (msg.media_url) {
                        await sendMedia(msg.phone, msg.media_url, msg.caption, msg.media_type);
                    } else {
                        await sendMessage(msg.phone, msg.message);
                    }

                    // Acknowledge message sent
                    await sendToLaravel(`/api/messages/${msg.id}/sent`, { sent: true });
                }
            }
        } catch (error) {
            console.error('[Conversa] Error polling for messages:', error);
        }
    }

    /**
     * Start polling for messages
     */
    function startMessagePolling() {
        if (pollTimer) return;

        pollTimer = setInterval(() => {
            pollForMessages();
        }, CONFIG.pollInterval);

        console.log('[Conversa] Message polling started');
    }

    /**
     * Stop polling for messages
     */
    function stopMessagePolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
            console.log('[Conversa] Message polling stopped');
        }
    }

    /**
     * Send data to Laravel backend
     */
    function sendToLaravel(endpoint, data = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: CONFIG.laravelApiUrl + endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': CONFIG.apiKey,
                },
                data: JSON.stringify(data),
                onload: (response) => {
                    try {
                        const result = JSON.parse(response.responseText);
                        resolve(result);
                    } catch (e) {
                        resolve({});
                    }
                },
                onerror: (error) => {
                    console.error('[Conversa] API Error:', error);
                    reject(error);
                }
            });
        });
    }

    /**
     * Notify Laravel of status changes
     */
    async function notifyLaravel(event) {
        if (!CONFIG.channelId) return;

        await sendToLaravel('/api/webhooks/whatsapp', {
            event: event,
            channel_id: CONFIG.channelId,
            organization_id: CONFIG.organizationId,
        });
    }

    /**
     * Create control panel UI
     */
    function createControlPanel() {
        controlPanel = document.createElement('div');
        controlPanel.id = 'conversa-control-panel';
        controlPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-width: 250px;
        `;

        controlPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="font-size: 16px;">🗨️ Conversa</strong>
                <button id="conversa-toggle" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 5px; cursor: pointer;">Hide</button>
            </div>
            <div id="conversa-content">
                <div style="font-size: 12px; margin-bottom: 10px;">
                    Status: <span id="conversa-status">Initializing...</span>
                </div>
                <div style="font-size: 11px; opacity: 0.9;">
                    Channel: <span id="conversa-channel">${CONFIG.channelId || 'Not configured'}</span>
                </div>
                <div style="margin-top: 10px;">
                    <button id="conversa-config" style="width: 100%; background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px; border-radius: 5px; cursor: pointer; font-size: 12px;">⚙️ Configure</button>
                </div>
            </div>
        `;

        document.body.appendChild(controlPanel);

        // Toggle button
        document.getElementById('conversa-toggle').addEventListener('click', () => {
            const content = document.getElementById('conversa-content');
            const toggle = document.getElementById('conversa-toggle');
            if (content.style.display === 'none') {
                content.style.display = 'block';
                toggle.textContent = 'Hide';
            } else {
                content.style.display = 'none';
                toggle.textContent = 'Show';
            }
        });

        // Config button
        document.getElementById('conversa-config').addEventListener('click', showConfigDialog);

        updateControlPanel();
    }

    /**
     * Update control panel UI
     */
    function updateControlPanel() {
        if (!controlPanel) return;

        const statusEl = document.getElementById('conversa-status');
        if (statusEl) {
            if (isConnected) {
                statusEl.textContent = '✅ Connected';
                statusEl.style.color = '#4ade80';
            } else {
                statusEl.textContent = '⏳ Connecting...';
                statusEl.style.color = '#fbbf24';
            }
        }
    }

    /**
     * Show configuration dialog
     */
    function showConfigDialog() {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            color: #333;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 999999;
            min-width: 400px;
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 20px 0;">⚙️ Conversa Configuration</h3>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Laravel API URL:</label>
                <input type="text" id="config-api-url" value="${CONFIG.laravelApiUrl}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">API Key:</label>
                <input type="password" id="config-api-key" value="${CONFIG.apiKey}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Channel ID:</label>
                <input type="number" id="config-channel-id" value="${CONFIG.channelId || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Organization ID:</label>
                <input type="number" id="config-org-id" value="${CONFIG.organizationId || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="config-cancel" style="padding: 10px 20px; background: #e5e7eb; border: none; border-radius: 5px; cursor: pointer;">Cancel</button>
                <button id="config-save" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 5px; cursor: pointer;">Save</button>
            </div>
        `;

        document.body.appendChild(dialog);

        // Save button
        document.getElementById('config-save').addEventListener('click', () => {
            CONFIG.laravelApiUrl = document.getElementById('config-api-url').value;
            CONFIG.apiKey = document.getElementById('config-api-key').value;
            CONFIG.channelId = parseInt(document.getElementById('config-channel-id').value) || null;
            CONFIG.organizationId = parseInt(document.getElementById('config-org-id').value) || null;

            // Save to storage
            GM_setValue('laravelApiUrl', CONFIG.laravelApiUrl);
            GM_setValue('apiKey', CONFIG.apiKey);
            GM_setValue('channelId', CONFIG.channelId);
            GM_setValue('organizationId', CONFIG.organizationId);

            document.body.removeChild(dialog);

            // Update UI
            document.getElementById('conversa-channel').textContent = CONFIG.channelId || 'Not configured';

            // Restart polling if connected
            if (isConnected && CONFIG.channelId) {
                stopMessagePolling();
                startMessagePolling();
                notifyLaravel('ready');
            }

            GM_notification({
                title: 'Conversa',
                text: 'Configuration saved successfully!',
                timeout: 3000
            });
        });

        // Cancel button
        document.getElementById('config-cancel').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
    }

    // Wait for page to load then initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        setTimeout(initialize, 2000); // Wait 2 seconds for WhatsApp Web to load
    }

})();
