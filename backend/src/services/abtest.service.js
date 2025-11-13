import { query } from '../config/database.js';
import { logger } from '../middleware/errorHandler.js';

class ABTestService {
  
  /**
   * Create A/B test variant
   */
  async createVariant(flowId, variantName, flowDefinition, trafficPercentage = 50) {
    try {
      const result = await query(
        `INSERT INTO flow_variants (flow_id, variant_name, flow_definition, traffic_percentage, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [flowId, variantName, flowDefinition, trafficPercentage]
      );
      
      logger.info(`Created variant ${variantName} for flow ${flowId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating variant:', error);
      throw error;
    }
  }

  /**
   * Assign contact to variant (traffic splitting)
   */
  async assignVariant(contactId, flowId) {
    try {
      // Check if already assigned
      const existingResult = await query(
        'SELECT variant_id FROM contact_variant_assignments WHERE contact_id = $1 AND flow_id = $2',
        [contactId, flowId]
      );
      
      if (existingResult.rows.length > 0) {
        return existingResult.rows[0].variant_id;
      }
      
      // Get all active variants for this flow
      const variantsResult = await query(
        'SELECT id, traffic_percentage FROM flow_variants WHERE flow_id = $1 AND is_active = true ORDER BY id',
        [flowId]
      );
      
      if (variantsResult.rows.length === 0) {
        return null; // No variants, use original flow
      }
      
      // Traffic splitting algorithm
      const variants = variantsResult.rows;
      const random = Math.random() * 100;
      let cumulative = 0;
      let selectedVariant = variants[0].id;
      
      for (const variant of variants) {
        cumulative += variant.traffic_percentage;
        if (random <= cumulative) {
          selectedVariant = variant.id;
          break;
        }
      }
      
      // Assign variant
      await query(
        `INSERT INTO contact_variant_assignments (contact_id, flow_id, variant_id)
         VALUES ($1, $2, $3)`,
        [contactId, flowId, selectedVariant]
      );
      
      logger.info(`Assigned contact ${contactId} to variant ${selectedVariant}`);
      return selectedVariant;
      
    } catch (error) {
      logger.error('Error assigning variant:', error);
      throw error;
    }
  }

  /**
   * Get variant for contact
   */
  async getContactVariant(contactId, flowId) {
    try {
      const result = await query(
        `SELECT fv.* FROM flow_variants fv
         JOIN contact_variant_assignments cva ON fv.id = cva.variant_id
         WHERE cva.contact_id = $1 AND cva.flow_id = $2`,
        [contactId, flowId]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('Error getting contact variant:', error);
      return null;
    }
  }

  /**
   * Get A/B test results
   */
  async getTestResults(flowId, days = 30) {
    try {
      const result = await query(
        `SELECT 
          fv.id as variant_id,
          fv.variant_name,
          fv.traffic_percentage,
          SUM(abr.total_starts) as total_starts,
          SUM(abr.total_completions) as total_completions,
          SUM(abr.total_drop_offs) as total_drop_offs,
          AVG(abr.conversion_rate) as avg_conversion_rate,
          AVG(abr.avg_completion_time_seconds) as avg_time_seconds,
          SUM(abr.total_revenue) as total_revenue,
          AVG(abr.avg_revenue_per_user) as avg_revenue_per_user
         FROM flow_variants fv
         LEFT JOIN ab_test_results abr ON fv.id = abr.variant_id
         WHERE fv.flow_id = $1
         AND (abr.metric_date IS NULL OR abr.metric_date >= CURRENT_DATE - INTERVAL '${days} days')
         GROUP BY fv.id, fv.variant_name, fv.traffic_percentage
         ORDER BY avg_conversion_rate DESC NULLS LAST`,
        [flowId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting test results:', error);
      throw error;
    }
  }

  /**
   * Update traffic split
   */
  async updateTrafficSplit(flowId, splits) {
    try {
      // splits = [{variantId: 1, percentage: 60}, {variantId: 2, percentage: 40}]
      const total = splits.reduce((sum, s) => sum + s.percentage, 0);
      
      if (total !== 100) {
        throw new Error('Traffic percentages must sum to 100');
      }
      
      for (const split of splits) {
        await query(
          'UPDATE flow_variants SET traffic_percentage = $1 WHERE id = $2 AND flow_id = $3',
          [split.percentage, split.variantId, flowId]
        );
      }
      
      logger.info(`Updated traffic split for flow ${flowId}`);
    } catch (error) {
      logger.error('Error updating traffic split:', error);
      throw error;
    }
  }

  /**
   * Deactivate variant
   */
  async deactivateVariant(variantId) {
    try {
      await query(
        'UPDATE flow_variants SET is_active = false WHERE id = $1',
        [variantId]
      );
      
      logger.info(`Deactivated variant ${variantId}`);
    } catch (error) {
      logger.error('Error deactivating variant:', error);
      throw error;
    }
  }

  /**
   * Promote winning variant to main flow
   */
  async promoteWinner(flowId, winningVariantId) {
    try {
      // Get winning variant definition
      const variantResult = await query(
        'SELECT flow_definition FROM flow_variants WHERE id = $1',
        [winningVariantId]
      );
      
      if (variantResult.rows.length === 0) {
        throw new Error('Variant not found');
      }
      
      // Update main flow
      await query(
        'UPDATE flows SET flow_definition = $1, updated_at = NOW() WHERE id = $2',
        [variantResult.rows[0].flow_definition, flowId]
      );
      
      // Deactivate all variants
      await query(
        'UPDATE flow_variants SET is_active = false WHERE flow_id = $1',
        [flowId]
      );
      
      logger.info(`Promoted variant ${winningVariantId} to main flow ${flowId}`);
    } catch (error) {
      logger.error('Error promoting winner:', error);
      throw error;
    }
  }

  /**
   * Get variant performance comparison
   */
  async compareVariants(flowId) {
    try {
      const result = await query(
        `SELECT 
          fv.variant_name,
          COUNT(DISTINCT fj.contact_id) as total_users,
          COUNT(DISTINCT fj.contact_id) FILTER (WHERE fj.status = 'completed') as completed,
          AVG(fj.total_time_seconds) FILTER (WHERE fj.status = 'completed') as avg_time,
          SUM(fj.conversion_value) as revenue,
          ROUND((COUNT(DISTINCT fj.contact_id) FILTER (WHERE fj.status = 'completed')::DECIMAL / 
                 NULLIF(COUNT(DISTINCT fj.contact_id), 0) * 100)::numeric, 2) as conversion_rate
         FROM flow_variants fv
         LEFT JOIN flow_journeys fj ON fv.id = fj.variant_id
         WHERE fv.flow_id = $1
         GROUP BY fv.variant_name
         ORDER BY conversion_rate DESC NULLS LAST`,
        [flowId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error comparing variants:', error);
      throw error;
    }
  }
}

export default new ABTestService();