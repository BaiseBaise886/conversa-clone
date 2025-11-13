import Bull from 'bull';
import { config } from '../config/index.js';
import { query } from '../config/database.js';
import { logger } from '../middleware/errorHandler.js';

class QueueService {
  constructor() {
    this.flowQueue = new Bull('flow-execution', {
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password
      }
    });

    this.setupProcessors();
  }

  setupProcessors() {
    // Process flow execution jobs
    this.flowQueue.process(async (job) => {
      const { contactId, flowId, organizationId, variables } = job.data;
      
      try {
        logger.info(`Processing flow execution: Flow ${flowId} for contact ${contactId}`);
        
        // Get flow definition
        const flowResult = await query(
          'SELECT * FROM flows WHERE id = $1 AND organization_id = $2',
          [flowId, organizationId]
        );
        
        if (flowResult.rows.length === 0) {
          throw new Error(`Flow ${flowId} not found`);
        }
        
        const flow = flowResult.rows[0];
        
        // Execute flow
        const flowExecutor = (await import('./flowExecutor.service.js')).default;
        await flowExecutor.executeNode(
          flow.flow_definition,
          flow.flow_definition.nodes[0].id, // Start node
          contactId,
          organizationId,
          variables || {},
          flowId
        );
        
        logger.info(`Flow execution completed: Flow ${flowId} for contact ${contactId}`);
      } catch (error) {
        logger.error(`Flow execution failed:`, error);
        throw error;
      }
    });

    // Event listeners
    this.flowQueue.on('completed', (job) => {
      logger.info(`Job ${job.id} completed`);
    });

    this.flowQueue.on('failed', (job, err) => {
      logger.error(`Job ${job.id} failed:`, err);
    });
  }

  async executeFlow(flow, contactId, organizationId) {
    try {
      // Check if flow is already running for this contact
      const existingState = await query(
        'SELECT * FROM flow_states WHERE contact_id = $1 AND flow_id = $2 AND completed = false',
        [contactId, flow.id]
      );
      
      if (existingState.rows.length > 0) {
        logger.info(`Flow ${flow.id} already running for contact ${contactId}`);
        return;
      }
      
      // Create flow state
      await query(
        `INSERT INTO flow_states (contact_id, flow_id, current_node_id, variables)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (contact_id, flow_id) 
         DO UPDATE SET current_node_id = $3, variables = $4, completed = false, updated_at = NOW()`,
        [contactId, flow.id, flow.flow_definition.nodes[0].id, JSON.stringify({})]
      );
      
      // Add to queue
      await this.flowQueue.add({
        contactId,
        flowId: flow.id,
        organizationId,
        variables: {}
      });
      
      logger.info(`Flow ${flow.id} queued for contact ${contactId}`);
    } catch (error) {
      logger.error('Error executing flow:', error);
      throw error;
    }
  }

  async addFlowExecutionJob(data) {
    const { contactId, message, organizationId } = data;
    
    try {
      // Find flows triggered by this message
      const flows = await query(
        `SELECT * FROM flows 
         WHERE organization_id = $1 
         AND is_active = true
         AND (
           $2 = ANY(keyword_triggers)
           OR array_length(keyword_triggers, 1) IS NULL
         )`,
        [organizationId, message.toLowerCase()]
      );
      
      for (const flow of flows.rows) {
        await this.executeFlow(flow, contactId, organizationId);
      }
    } catch (error) {
      logger.error('Error adding flow execution job:', error);
    }
  }

  async getQueueStats() {
    const waiting = await this.flowQueue.getWaitingCount();
    const active = await this.flowQueue.getActiveCount();
    const completed = await this.flowQueue.getCompletedCount();
    const failed = await this.flowQueue.getFailedCount();
    
    return { waiting, active, completed, failed };
  }

  async clearQueue() {
    await this.flowQueue.empty();
    logger.info('Queue cleared');
  }
}

export default new QueueService();