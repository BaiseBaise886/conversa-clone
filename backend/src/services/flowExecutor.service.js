import { query } from '../config/database.js';
import { logger } from '../middleware/errorHandler.js';
import whatsappService from './whatsapp.service.js';
import geminiService from './gemini.service.js';
import antiBanService from './antiban.service.js';
import analyticsService from './analytics.service.js';

class FlowExecutorService {
  
  /**
   * Execute a specific node in the flow
   */
  async executeNode(flowDefinition, nodeId, contactId, organizationId, variables = {}, flowId = null) {
    try {
      const node = flowDefinition.nodes.find(n => n.id === nodeId);
      
      if (!node) {
        logger.error(`Node ${nodeId} not found in flow`);
        return;
      }
      
      logger.info(`Executing node ${nodeId} (${node.type}) for contact ${contactId}`);
      
      // Track analytics
      if (flowId) {
        await analyticsService.trackNodeInteraction(
          contactId, 
          flowId, 
          null, 
          nodeId, 
          node.type, 
          'entered'
        );
      }
      
      // Execute based on node type
      switch (node.type) {
        case 'start':
          await this.handleStartNode(flowDefinition, node, contactId, organizationId, variables, flowId);
          break;
          
        case 'botResponse':
          await this.handleBotResponse(flowDefinition, node, contactId, organizationId, variables, flowId);
          break;
          
        case 'userInput':
          await this.handleUserInput(flowDefinition, node, contactId, organizationId, variables, flowId);
          break;
          
        case 'condition':
          await this.handleCondition(flowDefinition, node, contactId, organizationId, variables, flowId);
          break;
          
        case 'delay':
          await this.handleDelay(flowDefinition, node, contactId, organizationId, variables, flowId);
          break;
          
        case 'aiResponse':
          await this.handleAIResponse(flowDefinition, node, contactId, organizationId, variables, flowId);
          break;
          
        case 'assignAgent':
          await this.handleAssignAgent(flowDefinition, node, contactId, organizationId, variables, flowId);
          break;
          
        case 'logEvent':
          await this.handleLogEvent(flowDefinition, node, contactId, organizationId, variables, flowId);
          break;
          
        case 'addTag':
          await this.handleAddTag(flowDefinition, node, contactId, organizationId, variables, flowId);
          break;
          
        case 'updateScore':
          await this.handleUpdateScore(flowDefinition, node, contactId, organizationId, variables, flowId);
          break;
          
        case 'integration':
          await this.handleIntegration(flowDefinition, node, contactId, organizationId, variables, flowId);
          break;
          
        default:
          logger.warn(`Unknown node type: ${node.type}`);
      }
      
      // Track completion
      if (flowId) {
        await analyticsService.trackNodeInteraction(
          contactId, 
          flowId, 
          null, 
          nodeId, 
          node.type, 
          'completed'
        );
      }
      
    } catch (error) {
      logger.error(`Error executing node ${nodeId}:`, error);
      
      // Track failure
      if (flowId) {
        await analyticsService.trackNodeInteraction(
          contactId, 
          flowId, 
          null, 
          nodeId, 
          'error', 
          'dropped_off'
        );
      }
    }
  }

  /**
   * Handle start node - just move to next
   */
  async handleStartNode(flowDefinition, node, contactId, organizationId, variables, flowId) {
    const nextNode = this.getNextNode(flowDefinition, node.id);
    if (nextNode) {
      await this.executeNode(flowDefinition, nextNode.id, contactId, organizationId, variables, flowId);
    }
  }

  /**
   * Handle bot response - send message
   */
  async handleBotResponse(flowDefinition, node, contactId, organizationId, variables, flowId) {
    let message = node.data.message || '';
    
    // Replace variables in message
    message = this.replaceVariables(message, variables);
    
    // Get contact and channel
    const contactResult = await query(
      `SELECT c.*, ch.id as channel_id 
       FROM contacts c
       LEFT JOIN channels ch ON ch.organization_id = c.organization_id 
         AND ch.type = c.channel_type AND ch.status = 'connected'
       WHERE c.id = $1`,
      [contactId]
    );
    
    if (contactResult.rows.length === 0 || !contactResult.rows[0].channel_id) {
      logger.error(`No channel found for contact ${contactId}`);
      return;
    }
    
    const contact = contactResult.rows[0];
    
    // Queue message with anti-ban delay
    await antiBanService.queueMessage(
      contact.channel_id,
      contactId,
      message,
      { flowId, nodeId: node.id }
    );
    
    // Move to next node
    const nextNode = this.getNextNode(flowDefinition, node.id);
    if (nextNode) {
      await this.executeNode(flowDefinition, nextNode.id, contactId, organizationId, variables, flowId);
    }
  }

  /**
   * Handle user input - wait for response
   */
  async handleUserInput(flowDefinition, node, contactId, organizationId, variables, flowId) {
    // Update flow state to wait for user input
    await query(
      `UPDATE flow_states 
       SET current_node_id = $1, 
           awaiting_input = true,
           variables = $2,
           updated_at = NOW()
       WHERE contact_id = $3 AND flow_id = $4`,
      [node.id, JSON.stringify(variables), contactId, flowId]
    );
    
    logger.info(`Waiting for user input at node ${node.id} for contact ${contactId}`);
  }

  /**
   * Handle condition - branch logic
   */
  async handleCondition(flowDefinition, node, contactId, organizationId, variables, flowId) {
    const { variable, operator, value } = node.data;
    
    const userValue = variables[variable];
    let conditionMet = false;
    
    switch (operator) {
      case 'equals':
        conditionMet = userValue?.toString().toLowerCase() === value.toLowerCase();
        break;
      case 'contains':
        conditionMet = userValue?.toString().toLowerCase().includes(value.toLowerCase());
        break;
      case 'greater':
        conditionMet = parseFloat(userValue) > parseFloat(value);
        break;
      case 'less':
        conditionMet = parseFloat(userValue) < parseFloat(value);
        break;
      default:
        conditionMet = false;
    }
    
    // Find next node based on condition
    const edges = flowDefinition.edges.filter(e => e.source === node.id);
    const nextEdge = edges.find(e => 
      conditionMet ? e.sourceHandle === 'true' : e.sourceHandle === 'false'
    ) || edges[0]; // Fallback to first edge
    
    if (nextEdge) {
      await this.executeNode(flowDefinition, nextEdge.target, contactId, organizationId, variables, flowId);
    }
  }

  /**
   * Handle delay - wait before next action
   */
  async handleDelay(flowDefinition, node, contactId, organizationId, variables, flowId) {
    const seconds = node.data.seconds || 3;
    
    logger.info(`Delaying ${seconds}s at node ${node.id} for contact ${contactId}`);
    
    // Schedule next node execution
    setTimeout(async () => {
      const nextNode = this.getNextNode(flowDefinition, node.id);
      if (nextNode) {
        await this.executeNode(flowDefinition, nextNode.id, contactId, organizationId, variables, flowId);
      }
    }, seconds * 1000);
  }

  /**
   * Handle AI response - use Gemini to generate response
   */
  async handleAIResponse(flowDefinition, node, contactId, organizationId, variables, flowId) {
    try {
      const prompt = node.data.prompt || 'Respond helpfully to the customer';
      const useContext = node.data.useContext !== false;
      
      // Get conversation history if needed
      let conversationHistory = [];
      if (useContext) {
        const historyResult = await query(
          `SELECT * FROM ai_conversations 
           WHERE contact_id = $1 
           ORDER BY created_at DESC 
           LIMIT 10`,
          [contactId]
        );
        conversationHistory = historyResult.rows.reverse();
      }
      
      // Get last user message
      const lastMessage = variables.last_user_message || variables.user_input || '';
      
      // Generate AI response
      const aiResult = await geminiService.generateSupportResponse(
        contactId,
        lastMessage,
        conversationHistory
      );
      
      // Send the AI response
      const contactResult = await query(
        `SELECT c.*, ch.id as channel_id 
         FROM contacts c
         LEFT JOIN channels ch ON ch.organization_id = c.organization_id 
           AND ch.type = c.channel_type AND ch.status = 'connected'
         WHERE c.id = $1`,
        [contactId]
      );
      
      if (contactResult.rows.length > 0 && contactResult.rows[0].channel_id) {
        const contact = contactResult.rows[0];
        await antiBanService.queueMessage(
          contact.channel_id,
          contactId,
          aiResult.response,
          { flowId, nodeId: node.id, aiGenerated: true }
        );
      }
      
      // If should escalate, assign to agent
      if (aiResult.shouldEscalate) {
        await query(
          `INSERT INTO live_chat_sessions (contact_id, status)
           VALUES ($1, 'pending')
           ON CONFLICT (contact_id) DO UPDATE SET status = 'pending'`,
          [contactId]
        );
      }
      
      // Move to next node
      const nextNode = this.getNextNode(flowDefinition, node.id);
      if (nextNode) {
        await this.executeNode(flowDefinition, nextNode.id, contactId, organizationId, variables, flowId);
      }
      
    } catch (error) {
      logger.error('Error handling AI response:', error);
      // Fallback message
      const contactResult = await query(
        `SELECT c.*, ch.id as channel_id 
         FROM contacts c
         LEFT JOIN channels ch ON ch.organization_id = c.organization_id 
           AND ch.type = c.channel_type AND ch.status = 'connected'
         WHERE c.id = $1`,
        [contactId]
      );
      
      if (contactResult.rows.length > 0 && contactResult.rows[0].channel_id) {
        const contact = contactResult.rows[0];
        await antiBanService.queueMessage(
          contact.channel_id,
          contactId,
          "I'm here to help! Let me connect you with our team.",
          { flowId, nodeId: node.id }
        );
      }
    }
  }

  /**
   * Handle assign agent - transfer to human
   */
  async handleAssignAgent(flowDefinition, node, contactId, organizationId, variables, flowId) {
    const department = node.data.department || 'general';
    
    await query(
      `INSERT INTO live_chat_sessions (contact_id, status, metadata)
       VALUES ($1, 'pending', $2)
       ON CONFLICT (contact_id) 
       DO UPDATE SET status = 'pending', metadata = $2, created_at = NOW()`,
      [contactId, JSON.stringify({ department })]
    );
    
    // Update flow state
    await query(
      `UPDATE flow_states 
       SET completed = true, updated_at = NOW()
       WHERE contact_id = $1 AND flow_id = $2`,
      [contactId, flowId]
    );
    
    logger.info(`Assigned contact ${contactId} to ${department} department`);
  }

  /**
   * Handle log event - track analytics
   */
  async handleLogEvent(flowDefinition, node, contactId, organizationId, variables, flowId) {
    const eventName = node.data.eventName || 'custom_event';
    
    await query(
      `INSERT INTO event_logs (organization_id, contact_id, event_name, metadata)
       VALUES ($1, $2, $3, $4)`,
      [organizationId, contactId, eventName, JSON.stringify(variables)]
    );
    
    logger.info(`Logged event ${eventName} for contact ${contactId}`);
    
    // Move to next node
    const nextNode = this.getNextNode(flowDefinition, node.id);
    if (nextNode) {
      await this.executeNode(flowDefinition, nextNode.id, contactId, organizationId, variables, flowId);
    }
  }

  /**
   * Handle add tag
   */
  async handleAddTag(flowDefinition, node, contactId, organizationId, variables, flowId) {
    const tag = node.data.tag || 'tagged';
    
    await query(
      `INSERT INTO contact_tags (contact_id, tag_name, auto_generated)
       VALUES ($1, $2, true)
       ON CONFLICT (contact_id, tag_name) DO NOTHING`,
      [contactId, tag]
    );
    
    logger.info(`Added tag ${tag} to contact ${contactId}`);
    
    // Move to next node
    const nextNode = this.getNextNode(flowDefinition, node.id);
    if (nextNode) {
      await this.executeNode(flowDefinition, nextNode.id, contactId, organizationId, variables, flowId);
    }
  }

  /**
   * Handle update score
   */
  async handleUpdateScore(flowDefinition, node, contactId, organizationId, variables, flowId) {
    const change = node.data.change || 0;
    
    await query(
      `UPDATE flow_states 
       SET engagement_score = GREATEST(0, LEAST(100, COALESCE(engagement_score, 50) + $1))
       WHERE contact_id = $2 AND flow_id = $3`,
      [change, contactId, flowId]
    );
    
    logger.info(`Updated engagement score by ${change} for contact ${contactId}`);
    
    // Move to next node
    const nextNode = this.getNextNode(flowDefinition, node.id);
    if (nextNode) {
      await this.executeNode(flowDefinition, nextNode.id, contactId, organizationId, variables, flowId);
    }
  }

  /**
   * Handle integration (webhook call)
   */
  async handleIntegration(flowDefinition, node, contactId, organizationId, variables, flowId) {
    const { method, url, headers, body } = node.data;
    
    try {
      const response = await fetch(url, {
        method: method || 'POST',
        headers: JSON.parse(headers || '{}'),
        body: this.replaceVariables(body || '{}', variables)
      });
      
      const responseData = await response.json();
      variables.integration_response = responseData;
      
      logger.info(`Integration call successful for contact ${contactId}`);
    } catch (error) {
      logger.error('Integration call failed:', error);
    }
    
    // Move to next node
    const nextNode = this.getNextNode(flowDefinition, node.id);
    if (nextNode) {
      await this.executeNode(flowDefinition, nextNode.id, contactId, organizationId, variables, flowId);
    }
  }

  /**
   * Get next node from edges
   */
  getNextNode(flowDefinition, currentNodeId) {
    const edge = flowDefinition.edges.find(e => e.source === currentNodeId);
    if (edge) {
      return flowDefinition.nodes.find(n => n.id === edge.target);
    }
    return null;
  }

  /**
   * Replace variables in text (e.g., {{contact_name}})
   */
  replaceVariables(text, variables) {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  /**
   * Resume flow after user input
   */
  async resumeFlow(contactId, userMessage) {
    try {
      // Get current flow state
      const stateResult = await query(
        `SELECT fs.*, f.flow_definition, f.id as flow_id, c.organization_id
         FROM flow_states fs
         JOIN flows f ON fs.flow_id = f.id
         JOIN contacts c ON fs.contact_id = c.id
         WHERE fs.contact_id = $1 AND fs.awaiting_input = true AND fs.completed = false`,
        [contactId]
      );
      
      if (stateResult.rows.length === 0) {
        logger.info(`No flow waiting for input for contact ${contactId}`);
        return;
      }
      
      const state = stateResult.rows[0];
      const currentNode = state.flow_definition.nodes.find(n => n.id === state.current_node_id);
      
      if (!currentNode) {
        logger.error(`Current node ${state.current_node_id} not found`);
        return;
      }
      
      // Save user input to variables
      const variables = JSON.parse(state.variables || '{}');
      const saveAs = currentNode.data.saveAs || 'user_input';
      variables[saveAs] = userMessage;
      variables.last_user_message = userMessage;
      
      // Update flow state
      await query(
        `UPDATE flow_states 
         SET awaiting_input = false, variables = $1, updated_at = NOW()
         WHERE contact_id = $2 AND flow_id = $3`,
        [JSON.stringify(variables), contactId, state.flow_id]
      );
      
      // Track response
      await analyticsService.trackNodeInteraction(
        contactId,
        state.flow_id,
        null,
        state.current_node_id,
        currentNode.type,
        'completed',
        { response: userMessage }
      );
      
      // Move to next node
      const nextNode = this.getNextNode(state.flow_definition, state.current_node_id);
      if (nextNode) {
        await this.executeNode(
          state.flow_definition,
          nextNode.id,
          contactId,
          state.organization_id,
          variables,
          state.flow_id
        );
      } else {
        // Flow completed
        await query(
          `UPDATE flow_states SET completed = true WHERE contact_id = $1 AND flow_id = $2`,
          [contactId, state.flow_id]
        );
        await analyticsService.completeFlowJourney(contactId, state.flow_id);
      }
      
    } catch (error) {
      logger.error('Error resuming flow:', error);
    }
  }
}

export default new FlowExecutorService();