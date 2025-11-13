import { query } from '../config/database.js';
import { logger } from '../middleware/errorHandler.js';
import redisClient from '../config/redis.js';

class AnalyticsService {
  
  /**
   * Track node interaction
   */
  async trackNodeInteraction(contactId, flowId, variantId, nodeId, nodeType, action, userData = {}) {
    try {
      const contactResult = await query(
        'SELECT organization_id FROM contacts WHERE id = $1',
        [contactId]
      );
      
      if (contactResult.rows.length === 0) return;
      
      const organizationId = contactResult.rows[0].organization_id;
      
      await query(
        `INSERT INTO node_analytics 
         (organization_id, flow_id, variant_id, contact_id, node_id, node_type, action, user_response, time_spent_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          organizationId,
          flowId,
          variantId,
          contactId,
          nodeId,
          nodeType,
          action,
          userData.response || null,
          userData.timeSpent || null
        ]
      );
      
      // Update journey path
      await query(
        `UPDATE flow_journeys 
         SET path = path || $1::jsonb,
             last_node_id = $2,
             updated_at = NOW()
         WHERE contact_id = $3 AND flow_id = $4 AND status = 'in_progress'`,
        [JSON.stringify([{ nodeId, action, timestamp: new Date() }]), nodeId, contactId, flowId]
      );
      
      logger.info(`Tracked ${action} on node ${nodeId} for contact ${contactId}`);
    } catch (error) {
      logger.error('Error tracking node interaction:', error);
    }
  }

  /**
   * Start flow journey
   */
  async startFlowJourney(contactId, flowId, variantId = null) {
    try {
      await query(
        `INSERT INTO flow_journeys (contact_id, flow_id, variant_id, status, started_at)
         VALUES ($1, $2, $3, 'in_progress', NOW())
         ON CONFLICT (contact_id, flow_id) 
         DO UPDATE SET started_at = NOW(), status = 'in_progress', variant_id = $3`,
        [contactId, flowId, variantId]
      );
      
      logger.info(`Started journey for contact ${contactId} in flow ${flowId}`);
    } catch (error) {
      logger.error('Error starting flow journey:', error);
    }
  }

  /**
   * Complete flow journey
   */
  async completeFlowJourney(contactId, flowId, conversionValue = null) {
    try {
      await query(
        `UPDATE flow_journeys 
         SET status = 'completed',
             completed_at = NOW(),
             total_time_seconds = EXTRACT(EPOCH FROM (NOW() - started_at)),
             conversion_value = $3
         WHERE contact_id = $1 AND flow_id = $2 AND status = 'in_progress'`,
        [contactId, flowId, conversionValue]
      );
      
      logger.info(`Completed journey for contact ${contactId} in flow ${flowId}`);
    } catch (error) {
      logger.error('Error completing flow journey:', error);
    }
  }

  /**
   * Mark flow as abandoned
   */
  async abandonFlowJourney(contactId, flowId) {
    try {
      await query(
        `UPDATE flow_journeys 
         SET status = 'abandoned',
             total_time_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
         WHERE contact_id = $1 AND flow_id = $2 AND status = 'in_progress'`,
        [contactId, flowId]
      );
      
      logger.info(`Marked journey as abandoned for contact ${contactId}`);
    } catch (error) {
      logger.error('Error marking journey as abandoned:', error);
    }
  }

  /**
   * Get drop-off analysis for a flow
   */
  async getDropOffAnalysis(flowId, variantId = null) {
    try {
      const whereClause = variantId 
        ? 'WHERE na.flow_id = $1 AND na.variant_id = $2'
        : 'WHERE na.flow_id = $1';
      
      const params = variantId ? [flowId, variantId] : [flowId];
      
      const result = await query(
        `WITH node_stats AS (
          SELECT 
            na.node_id,
            na.node_type,
            COUNT(DISTINCT CASE WHEN na.action = 'entered' THEN na.contact_id END) as reached,
            COUNT(DISTINCT CASE WHEN na.action = 'completed' THEN na.contact_id END) as completed,
            COUNT(DISTINCT CASE WHEN na.action = 'dropped_off' THEN na.contact_id END) as dropped
          FROM node_analytics na
          ${whereClause}
          GROUP BY na.node_id, na.node_type
        )
        SELECT 
          node_id,
          node_type,
          reached,
          completed,
          dropped,
          CASE 
            WHEN reached > 0 THEN (dropped / reached)
            ELSE 0 
          END as drop_off_rate,
          CASE 
            WHEN reached > 0 THEN ((reached - completed) / reached)
            ELSE 0
          END as incomplete_rate
        FROM node_stats
        WHERE reached > 0
        ORDER BY drop_off_rate DESC, reached DESC`,
        params
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting drop-off analysis:', error);
      throw error;
    }
  }

  /**
   * Get flow funnel visualization data
   */
  async getFlowFunnel(flowId, variantId = null) {
    try {
      // Get flow definition to know node order
      const flowResult = await query(
        'SELECT flow_definition FROM flows WHERE id = $1',
        [flowId]
      );
      
      if (flowResult.rows.length === 0) {
        throw new Error('Flow not found');
      }
      
      const flowDef = variantId 
        ? (await query('SELECT flow_definition FROM flow_variants WHERE id = $1', [variantId])).rows[0]?.flow_definition
        : flowResult.rows[0].flow_definition;
      
      if (!flowDef || !flowDef.nodes) {
        throw new Error('Invalid flow definition');
      }
      
      // Get analytics for each node
      const dropOffData = await this.getDropOffAnalysis(flowId, variantId);
      
      // Build funnel stages
      const funnel = flowDef.nodes.map(node => {
        const analytics = dropOffData.find(d => d.node_id === node.id);
        
        return {
          nodeId: node.id,
          nodeType: node.type,
          label: node.data?.message?.substring(0, 50) || node.type,
          reached: analytics?.reached || 0,
          completed: analytics?.completed || 0,
          dropped: analytics?.dropped || 0,
          dropOffRate: analytics?.drop_off_rate || 0,
          incompleteRate: analytics?.incomplete_rate || 0
        };
      });
      
      return funnel;
    } catch (error) {
      logger.error('Error getting flow funnel:', error);
      throw error;
    }
  }

  /**
   * Get response patterns for a node
   */
  async getResponsePatterns(flowId, nodeId) {
    try {
      const result = await query(
        `SELECT 
          response_text,
          COUNT(*) as count,
          AVG(CASE WHEN led_to_conversion THEN 1 ELSE 0 END) as conversion_rate
         FROM response_patterns
         WHERE flow_id = $1 AND node_id = $2
         GROUP BY response_text
         ORDER BY count DESC
         LIMIT 20`,
        [flowId, nodeId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting response patterns:', error);
      throw error;
    }
  }

  /**
   * Get time-based analytics
   */
  async getTimeAnalytics(flowId, days = 7) {
    try {
      const result = await query(
        `SELECT 
          DATE(started_at) as date,
          COUNT(*) as total_starts,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completions,
          SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) as abandons,
          AVG(CASE WHEN status = 'completed' THEN total_time_seconds END) as avg_completion_time,
          AVG(CASE WHEN conversion_value IS NOT NULL THEN conversion_value END) as avg_conversion_value
         FROM flow_journeys
         WHERE flow_id = $1 
         AND started_at >= NOW() - INTERVAL ${days} DAY
         GROUP BY DATE(started_at)
         ORDER BY date DESC`,
        [flowId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting time analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate daily aggregates (run this daily via cron)
   */
  async calculateDailyAggregates() {
    try {
      logger.info('Calculating daily A/B test aggregates...');
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      
      // Get all active flow variants
      const variantsResult = await query(
        `SELECT DISTINCT fv.id as variant_id, fv.flow_id
         FROM flow_variants fv
         WHERE fv.is_active = true`
      );
      
      for (const variant of variantsResult.rows) {
        const { flow_id, variant_id } = variant;
        
        // Calculate metrics
        const metricsResult = await query(
          `WITH journey_metrics AS (
            SELECT 
              COUNT(*) as total_starts,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completions,
              SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) as drop_offs,
              AVG(CASE WHEN status = 'completed' THEN total_time_seconds END) as avg_time,
              SUM(CASE WHEN conversion_value IS NOT NULL THEN conversion_value ELSE 0 END) as total_revenue,
              AVG(CASE WHEN conversion_value IS NOT NULL THEN conversion_value END) as avg_revenue
            FROM flow_journeys
            WHERE flow_id = $1 
            AND variant_id = $2
            AND DATE(started_at) = $3
          ),
          message_metrics AS (
            SELECT 
              AVG(msg_count) as avg_messages,
              AVG(response_rate) as avg_response
            FROM (
              SELECT 
                contact_id,
                COUNT(*) as msg_count,
                SUM(CASE WHEN action = 'completed' THEN 1.0 ELSE 0 END) / NULLIF(COUNT(*), 0) as response_rate
              FROM node_analytics
              WHERE flow_id = $1
              AND variant_id = $2
              AND DATE(created_at) = $3
              GROUP BY contact_id
            ) contact_stats
          )
          SELECT 
            jm.total_starts,
            jm.completions,
            jm.drop_offs,
            jm.avg_time,
            CASE WHEN jm.total_starts > 0 
              THEN jm.completions / jm.total_starts 
              ELSE 0 
            END as conversion_rate,
            jm.total_revenue,
            jm.avg_revenue,
            mm.avg_messages,
            mm.avg_response
          FROM journey_metrics jm, message_metrics mm`,
          [flow_id, variant_id, dateStr]
        );
        
        if (metricsResult.rows.length > 0) {
          const metrics = metricsResult.rows[0];
          
          // Insert or update
          await query(
            `INSERT INTO ab_test_results (
              flow_id, variant_id, metric_date,
              total_starts, total_completions, total_drop_offs,
              avg_completion_time_seconds, conversion_rate,
              total_revenue, avg_revenue_per_user,
              avg_messages_sent, avg_response_rate
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (flow_id, variant_id, metric_date) 
            DO UPDATE SET
              total_starts = $4,
              total_completions = $5,
              total_drop_offs = $6,
              avg_completion_time_seconds = $7,
              conversion_rate = $8,
              total_revenue = $9,
              avg_revenue_per_user = $10,
              avg_messages_sent = $11,
              avg_response_rate = $12,
              updated_at = NOW()`,
            [
              flow_id,
              variant_id,
              dateStr,
              metrics.total_starts || 0,
              metrics.completions || 0,
              metrics.drop_offs || 0,
              metrics.avg_time || 0,
              metrics.conversion_rate || 0,
              metrics.total_revenue || 0,
              metrics.avg_revenue || 0,
              metrics.avg_messages || 0,
              metrics.avg_response || 0
            ]
          );
        }
      }
      
      logger.info('Daily aggregates calculated successfully');
    } catch (error) {
      logger.error('Error calculating daily aggregates:', error);
    }
  }

  /**
   * Detect winning variant (statistical significance)
   */
  async detectWinner(flowId, minSampleSize = 100) {
    try {
      // Get all variants with their performance
      const result = await query(
        `SELECT 
          variant_id,
          SUM(total_starts) as total_starts,
          SUM(total_completions) as total_completions,
          AVG(conversion_rate) as avg_conversion_rate,
          SUM(total_revenue) as total_revenue
         FROM ab_test_results
         WHERE flow_id = $1
         AND metric_date >= CURRENT_DATE - INTERVAL 30 DAY
         GROUP BY variant_id
         HAVING SUM(total_starts) >= $2
         ORDER BY avg_conversion_rate DESC`,
        [flowId, minSampleSize]
      );
      
      if (result.rows.length < 2) {
        return { hasWinner: false, message: 'Not enough data or variants' };
      }
      
      const variants = result.rows;
      const control = variants[0]; // Assume first is control
      const challenger = variants[1];
      
      // Simple z-test for proportions
      const p1 = parseFloat(control.avg_conversion_rate);
      const p2 = parseFloat(challenger.avg_conversion_rate);
      const n1 = parseInt(control.total_starts);
      const n2 = parseInt(challenger.total_starts);
      
      const pPool = ((p1 * n1) + (p2 * n2)) / (n1 + n2);
      const se = Math.sqrt(pPool * (1 - pPool) * ((1/n1) + (1/n2)));
      const zScore = (p2 - p1) / se;
      
      // 95% confidence = z-score > 1.96
      const isSignificant = Math.abs(zScore) > 1.96;
      const winner = p2 > p1 ? challenger : control;
      const improvement = ((Math.max(p1, p2) / Math.min(p1, p2)) - 1) * 100;
      
      if (isSignificant) {
        // Declare winner
        await query(
          `INSERT INTO ab_test_winners (flow_id, winning_variant_id, confidence_level, improvement_percentage, reason)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            flowId,
            winner.variant_id,
            0.95,
            improvement.toFixed(2),
            `Statistically significant improvement in conversion rate (z-score: ${zScore.toFixed(2)})`
          ]
        );
        
        return {
          hasWinner: true,
          winner: winner,
          improvement: improvement.toFixed(2),
          confidence: '95%',
          zScore: zScore.toFixed(2)
        };
      }
      
      return {
        hasWinner: false,
        message: 'No statistically significant winner yet',
        currentLeader: variants[0],
        sampleSizes: { control: n1, challenger: n2 }
      };
      
    } catch (error) {
      logger.error('Error detecting winner:', error);
      throw error;
    }
  }
}

export default new AnalyticsService();