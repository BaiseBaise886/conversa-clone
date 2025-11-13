import OpenAI from 'openai';
import { config } from '../config/index.js';
import { logger } from '../middleware/errorHandler.js';

class OpenAIService {
  constructor() {
    if (!config.openai.apiKey) {
      logger.warn('⚠️  OpenAI API key not configured. OpenAI features will not work.');
      this.enabled = false;
      return;
    }
    
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
    this.enabled = true;
  }

  checkEnabled() {
    if (!this.enabled) {
      throw new Error('OpenAI is not configured. Please add OPENAI_API_KEY to .env file');
    }
  }

  /**
   * Generate chat completion (alternative to Gemini)
   */
  async generateChatCompletion(messages, options = {}) {
    this.checkEnabled();
    
    try {
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-3.5-turbo',
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 500
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      logger.error('OpenAI chat completion error:', error);
      throw error;
    }
  }

  /**
   * Generate support response using OpenAI
   */
  async generateSupportResponse(context, message) {
    this.checkEnabled();
    
    const messages = [
      {
        role: 'system',
        content: `You are a helpful customer support agent. Business context: ${JSON.stringify(context)}`
      },
      {
        role: 'user',
        content: message
      }
    ];
    
    return await this.generateChatCompletion(messages, { maxTokens: 280 });
  }

  /**
   * Analyze sentiment using OpenAI
   */
  async analyzeSentiment(message) {
    this.checkEnabled();
    
    try {
      const messages = [
        {
          role: 'system',
          content: 'Analyze the sentiment and intent. Respond with JSON: {"sentiment": "positive|negative|neutral", "intent": "buy|support|info|complaint", "confidence": 0.0-1.0}'
        },
        {
          role: 'user',
          content: message
        }
      ];
      
      const response = await this.generateChatCompletion(messages, { temperature: 0.3 });
      return JSON.parse(response);
    } catch (error) {
      logger.error('OpenAI sentiment analysis error:', error);
      return { sentiment: 'neutral', intent: 'info', confidence: 0.5 };
    }
  }

  /**
   * Generate image (DALL-E)
   */
  async generateImage(prompt, options = {}) {
    this.checkEnabled();
    
    try {
      const response = await this.openai.images.generate({
        prompt,
        n: options.n || 1,
        size: options.size || '1024x1024'
      });
      
      return response.data[0].url;
    } catch (error) {
      logger.error('OpenAI image generation error:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio (Whisper)
   */
  async transcribeAudio(audioFile) {
    this.checkEnabled();
    
    try {
      const response = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1'
      });
      
      return response.text;
    } catch (error) {
      logger.error('OpenAI audio transcription error:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings
   */
  async generateEmbeddings(text) {
    this.checkEnabled();
    
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      });
      
      return response.data[0].embedding;
    } catch (error) {
      logger.error('OpenAI embeddings error:', error);
      throw error;
    }
  }
}

export default new OpenAIService();