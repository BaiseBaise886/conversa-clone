import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import { query } from '../config/database.js';
import { logger } from '../middleware/errorHandler.js';

class GeminiService {
  constructor() {
    if (!config.gemini.apiKey) {
      logger.warn('⚠️  Gemini API key not configured. AI features will not work.');
      this.enabled = false;
      return;
    }
    
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    this.enabled = true;
  }

  checkEnabled() {
    if (!this.enabled) {
      throw new Error('Gemini AI is not configured. Please add GEMINI_API_KEY to .env file');
    }
  }

  /**
   * Generate a complete flow from natural language prompt
   */
  async generateFlowFromPrompt(prompt, organizationId) {
    this.checkEnabled();
    
    try {
      logger.info(`Generating flow from prompt for org ${organizationId}`);
      
      // Get marketing brain context
      const marketingContext = await this.getMarketingContext(organizationId);
      
      const systemPrompt = `You are an expert marketing automation specialist. Generate a WhatsApp chatbot flow in JSON format.

IMPORTANT: Your response must be ONLY valid JSON, no markdown, no explanations, no code blocks.

Marketing Context:
${JSON.stringify(marketingContext, null, 2)}

Flow Structure Rules:
1. Every flow must start with a "start" node
2. Available node types: start, botResponse, userInput, condition, delay, aiResponse, assignAgent, logEvent, addTag, updateScore
3. Nodes must be connected via edges with source and target IDs
4. Use realistic, human-like message delays (2-5 seconds)
5. Include conversation paths for different customer responses
6. Add tags to segment users (e.g., "interested", "qualified", "hot_lead")
7. Use conditions to branch based on user responses
8. Include engagement scoring (add/subtract points based on responses)

Node Types:
- start: Entry point (no data needed)
- botResponse: Send message (data: {message: "text"})
- userInput: Wait for user reply (data: {saveAs: "variable_name", validation: "text|email|phone"})
- condition: Branch logic (data: {variable: "var", operator: "contains|equals|greater", value: "text", trueLabel: "yes", falseLabel: "no"})
- delay: Wait before next message (data: {seconds: 3})
- aiResponse: Use AI to respond (data: {prompt: "instructions", useContext: true})
- assignAgent: Transfer to human (data: {department: "sales|support"})
- addTag: Tag user (data: {tag: "tag_name"})
- updateScore: Change engagement score (data: {change: 10})
- logEvent: Track analytics (data: {eventName: "event"})

User Request: ${prompt}

Generate a complete flow as JSON with this structure:
{
  "name": "Flow Name",
  "description": "What this flow does",
  "category": "lead_generation|sales|support|onboarding",
  "keywords": ["trigger", "words"],
  "nodes": [
    {"id": "1", "type": "start", "position": {"x": 100, "y": 100}, "data": {}},
    {"id": "2", "type": "botResponse", "position": {"x": 100, "y": 200}, "data": {"message": "..."}}
  ],
  "edges": [
    {"id": "e1-2", "source": "1", "target": "2"}
  ]
}`;

      const result = await this.model.generateContent(systemPrompt);
      const response = result.response.text();
      
      // Clean response - remove markdown code blocks if present
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
      }
      
      const flowData = JSON.parse(cleanedResponse);
      
      // Validate flow structure
      if (!flowData.nodes || !flowData.edges || !flowData.name) {
        throw new Error('Invalid flow structure generated');
      }
      
      // Ensure start node exists
      const hasStart = flowData.nodes.some(n => n.type === 'start');
      if (!hasStart) {
        throw new Error('Flow must have a start node');
      }
      
      logger.info(`Successfully generated flow: ${flowData.name}`);
      return flowData;
      
    } catch (error) {
      logger.error('Error generating flow from prompt:', error);
      throw new Error(`Failed to generate flow: ${error.message}`);
    }
  }

  /**
   * Get marketing context for the organization
   */
  async getMarketingContext(organizationId) {
    const result = await query(
      'SELECT * FROM marketing_brain WHERE organization_id = $1',
      [organizationId]
    );
    
    if (result.rows.length === 0) {
      return {
        note: "No marketing context configured. Using general sales approach."
      };
    }
    
    return result.rows.map(product => ({
      product: product.product_name,
      description: product.product_description,
      price: product.price,
      angles: product.marketing_angles,
      painPoints: product.pain_points,
      benefits: product.benefits,
      tone: product.tone_of_voice
    }));
  }

  /**
   * AI-powered customer support response
   */
  async generateSupportResponse(contactId, message, conversationHistory) {
    this.checkEnabled();
    
    try {
      // Get contact info
      const contactResult = await query(
        `SELECT c.*, o.id as org_id FROM contacts c
         JOIN organizations o ON c.organization_id = o.id
         WHERE c.id = $1`,
        [contactId]
      );
      
      if (contactResult.rows.length === 0) {
        throw new Error('Contact not found');
      }
      
      const contact = contactResult.rows[0];
      const marketingContext = await this.getMarketingContext(contact.org_id);
      
      // Get recent conversation
      const recentMessages = conversationHistory.slice(-10);
      
      const prompt = `You are a friendly, helpful customer support agent for our business.

Business Context:
${JSON.stringify(marketingContext, null, 2)}

Customer Information:
- Name: ${contact.name}
- Phone: ${contact.phone}
- Tags: ${contact.tags?.join(', ') || 'None'}

Recent Conversation:
${recentMessages.map(m => `${m.message_role}: ${m.message_content}`).join('\n')}

Current Customer Message: ${message}

Instructions:
1. Respond naturally and helpfully
2. Use the customer's name occasionally
3. If they're asking about products, mention relevant benefits
4. If they have objections, address them empathetically
5. Keep responses under 280 characters (WhatsApp-friendly)
6. Don't be pushy, be consultative
7. If you can't help, say you'll connect them with a human agent

Generate ONLY the response text, nothing else:`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text().trim();
      
      // Analyze sentiment and intent
      const analysis = await this.analyzeMessage(message);
      
      // Save to conversation history
      await query(
        `INSERT INTO ai_conversations (contact_id, message_role, message_content, sentiment, intent, confidence)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [contactId, 'user', message, analysis.sentiment, analysis.intent, analysis.confidence]
      );
      
      await query(
        `INSERT INTO ai_conversations (contact_id, message_role, message_content)
         VALUES ($1, $2, $3)`,
        [contactId, 'assistant', response]
      );
      
      return {
        response,
        sentiment: analysis.sentiment,
        intent: analysis.intent,
        shouldEscalate: analysis.intent === 'complaint' || analysis.sentiment === 'very_negative'
      };
      
    } catch (error) {
      logger.error('Error generating support response:', error);
      return {
        response: "I apologize, but I'm having trouble understanding. Let me connect you with a team member who can help.",
        shouldEscalate: true
      };
    }
  }

  /**
   * Analyze message sentiment and intent
   */
  async analyzeMessage(message) {
    this.checkEnabled();
    
    try {
      const prompt = `Analyze this customer message and respond with ONLY a JSON object (no markdown, no explanations):

Message: "${message}"

Respond with this exact structure:
{
  "sentiment": "very_positive|positive|neutral|negative|very_negative",
  "intent": "buy|info|support|complaint|objection|greeting|goodbye",
  "confidence": 0.0-1.0,
  "urgency": "low|medium|high"
}`;

      const result = await this.model.generateContent(prompt);
      let response = result.response.text().trim();
      
      // Clean response
      if (response.startsWith('```')) {
        response = response.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
      }
      
      return JSON.parse(response);
      
    } catch (error) {
      logger.error('Error analyzing message:', error);
      return {
        sentiment: 'neutral',
        intent: 'info',
        confidence: 0.5,
        urgency: 'medium'
      };
    }
  }

  /**
   * Auto-tag users based on behavior
   */
  async autoTagContact(contactId, behavior) {
    this.checkEnabled();
    
    try {
      const { messages, responses, timeSpent, clickedLinks } = behavior;
      
      const prompt = `Based on this customer behavior, suggest relevant tags (return ONLY a JSON array of strings):

Behavior:
- Total messages: ${messages}
- Response rate: ${responses}%
- Time engaged: ${timeSpent} minutes
- Clicked links: ${clickedLinks}

Examples of good tags: "hot_lead", "price_conscious", "needs_nurturing", "ready_to_buy", "information_seeker", "tire_kicker"

Return format: ["tag1", "tag2", "tag3"]`;

      const result = await this.model.generateContent(prompt);
      let response = result.response.text().trim();
      
      if (response.startsWith('```')) {
        response = response.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
      }
      
      const tags = JSON.parse(response);
      
      // Save tags
      for (const tag of tags) {
        await query(
          `INSERT INTO contact_tags (contact_id, tag_name, auto_generated)
           VALUES ($1, $2, true)
           ON CONFLICT (contact_id, tag_name) DO NOTHING`,
          [contactId, tag]
        );
      }
      
      logger.info(`Auto-tagged contact ${contactId} with: ${tags.join(', ')}`);
      return tags;
      
    } catch (error) {
      logger.error('Error auto-tagging contact:', error);
      return [];
    }
  }

  /**
   * Optimize message for WhatsApp (prevent bans)
   */
  async optimizeMessage(message, context = {}) {
    this.checkEnabled();
    
    try {
      const prompt = `Rewrite this marketing message to be more natural and less spam-like for WhatsApp:

Original: "${message}"

Rules:
1. Make it conversational and personal
2. Remove excessive emojis (max 2)
3. No ALL CAPS words
4. No spam trigger words (FREE, LIMITED TIME, ACT NOW)
5. Add personalization if possible
6. Keep under 250 characters
7. Sound human, not robotic

Context: ${JSON.stringify(context)}

Return ONLY the rewritten message:`;

      const result = await this.model.generateContent(prompt);
      return result.response.text().trim();
      
    } catch (error) {
      logger.error('Error optimizing message:', error);
      return message; // Return original if optimization fails
    }
  }

  /**
   * Generate marketing angle based on customer data
   */
  async selectMarketingAngle(contactId, productId) {
    this.checkEnabled();
    
    try {
      // Get contact behavior and product info
      const contactResult = await query(
        `SELECT c.*, 
                array_agg(DISTINCT ct.tag_name) as tags,
                COUNT(m.id) as message_count
         FROM contacts c
         LEFT JOIN contact_tags ct ON c.id = ct.contact_id
         LEFT JOIN messages m ON c.id = m.contact_id
         WHERE c.id = $1
         GROUP BY c.id`,
        [contactId]
      );
      
      const productResult = await query(
        'SELECT * FROM marketing_brain WHERE id = $1',
        [productId]
      );
      
      if (contactResult.rows.length === 0 || productResult.rows.length === 0) {
        return null;
      }
      
      const contact = contactResult.rows[0];
      const product = productResult.rows[0];
      
      const prompt = `Select the best marketing angle for this customer:

Customer Profile:
- Tags: ${contact.tags?.join(', ') || 'None'}
- Engagement: ${contact.message_count} messages
- Custom fields: ${JSON.stringify(contact.custom_fields)}

Product: ${product.product_name}
Available Angles: ${product.marketing_angles?.join(', ')}
Pain Points: ${product.pain_points?.join(', ')}
Benefits: ${product.benefits?.join(', ')}

Return ONLY a JSON object:
{
  "selectedAngle": "angle_name",
  "reasoning": "why this angle",
  "openingMessage": "personalized message using this angle"
}`;

      const result = await this.model.generateContent(prompt);
      let response = result.response.text().trim();
      
      if (response.startsWith('```')) {
        response = response.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
      }
      
      return JSON.parse(response);
      
    } catch (error) {
      logger.error('Error selecting marketing angle:', error);
      return null;
    }
  }
}

export default new GeminiService();