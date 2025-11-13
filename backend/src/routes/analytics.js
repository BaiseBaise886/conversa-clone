import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import analyticsService from '../services/analytics.service.js';
import abTestService from '../services/abtest.service.js';

const router = express.Router();

// Get drop-off analysis
router.get('/dropoff/:flowId', authenticate, asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  const { variantId } = req.query;
  
  const dropOffData = await analyticsService.getDropOffAnalysis(
    parseInt(flowId),
    variantId ? parseInt(variantId) : null
  );
  
  res.json(dropOffData);
}));

// Get flow funnel visualization
router.get('/funnel/:flowId', authenticate, asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  const { variantId } = req.query;
  
  const funnelData = await analyticsService.getFlowFunnel(
    parseInt(flowId),
    variantId ? parseInt(variantId) : null
  );
  
  res.json(funnelData);
}));

// Get response patterns for a node
router.get('/responses/:flowId/:nodeId', authenticate, asyncHandler(async (req, res) => {
  const { flowId, nodeId } = req.params;
  
  const patterns = await analyticsService.getResponsePatterns(
    parseInt(flowId),
    nodeId
  );
  
  res.json(patterns);
}));

// Get time-based analytics
router.get('/timeline/:flowId', authenticate, asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  const { days } = req.query;
  
  const timeData = await analyticsService.getTimeAnalytics(
    parseInt(flowId),
    parseInt(days) || 7
  );
  
  res.json(timeData);
}));

// Create A/B test variant
router.post('/abtest/variant', authenticate, asyncHandler(async (req, res) => {
  const { flowId, variantName, flowDefinition, trafficPercentage } = req.body;
  
  if (!flowId || !variantName || !flowDefinition) {
    return res.status(400).json({ error: 'flowId, variantName, and flowDefinition required' });
  }
  
  // Validate flow belongs to organization
  const { query } = await import('../config/database.js');
  const flowCheck = await query(
    'SELECT id FROM flows WHERE id = $1 AND organization_id = $2',
    [flowId, req.organizationId]
  );
  
  if (flowCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Flow not found' });
  }
  
  const variant = await abTestService.createVariant(
    parseInt(flowId),
    variantName,
    flowDefinition,
    trafficPercentage || 50
  );
  
  res.status(201).json(variant);
}));

// Get A/B test results
router.get('/abtest/:flowId', authenticate, asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  const { days } = req.query;
  
  const results = await abTestService.getTestResults(
    parseInt(flowId),
    parseInt(days) || 30
  );
  
  res.json(results);
}));

// Get all variants for a flow
router.get('/abtest/:flowId/variants', authenticate, asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  const { query } = await import('../config/database.js');
  
  const result = await query(
    'SELECT * FROM flow_variants WHERE flow_id = $1 ORDER BY created_at DESC',
    [flowId]
  );
  
  res.json(result.rows);
}));

// Update traffic split
router.put('/abtest/:flowId/traffic', authenticate, asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  const { splits } = req.body;
  
  if (!Array.isArray(splits)) {
    return res.status(400).json({ error: 'splits array required' });
  }
  
  // Validate total is 100%
  const total = splits.reduce((sum, s) => sum + (s.percentage || 0), 0);
  if (total !== 100) {
    return res.status(400).json({ error: 'Traffic percentages must sum to 100%' });
  }
  
  await abTestService.updateTrafficSplit(parseInt(flowId), splits);
  
  res.json({ success: true, message: 'Traffic split updated' });
}));

// Detect winner
router.get('/abtest/:flowId/winner', authenticate, asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  const { minSampleSize } = req.query;
  
  const result = await analyticsService.detectWinner(
    parseInt(flowId),
    minSampleSize ? parseInt(minSampleSize) : 100
  );
  
  res.json(result);
}));

// Promote winning variant
router.post('/abtest/:flowId/promote', authenticate, asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  const { variantId } = req.body;
  
  if (!variantId) {
    return res.status(400).json({ error: 'variantId required' });
  }
  
  // Verify variant belongs to flow
  const { query } = await import('../config/database.js');
  const variantCheck = await query(
    `SELECT fv.id FROM flow_variants fv
     JOIN flows f ON fv.flow_id = f.id
     WHERE fv.id = $1 AND fv.flow_id = $2 AND f.organization_id = $3`,
    [variantId, flowId, req.organizationId]
  );
  
  if (variantCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Variant not found or does not belong to this flow' });
  }
  
  await abTestService.promoteWinner(parseInt(flowId), parseInt(variantId));
  
  res.json({ success: true, message: 'Variant promoted to main flow' });
}));

// Deactivate variant
router.delete('/abtest/variant/:variantId', authenticate, asyncHandler(async (req, res) => {
  const { variantId } = req.params;
  
  // Verify variant belongs to organization
  const { query } = await import('../config/database.js');
  const variantCheck = await query(
    `SELECT fv.id FROM flow_variants fv
     JOIN flows f ON fv.flow_id = f.id
     WHERE fv.id = $1 AND f.organization_id = $2`,
    [variantId, req.organizationId]
  );
  
  if (variantCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Variant not found' });
  }
  
  await abTestService.deactivateVariant(parseInt(variantId));
  
  res.json({ success: true, message: 'Variant deactivated' });
}));

// Get flow performance comparison
router.get('/compare', authenticate, asyncHandler(async (req, res) => {
  const { flowIds } = req.query;
  
  if (!flowIds) {
    return res.status(400).json({ error: 'flowIds query parameter required (comma-separated)' });
  }
  
  const ids = flowIds.split(',').map(id => parseInt(id));
  const { query } = await import('../config/database.js');
  
  const results = [];
  
  for (const flowId of ids) {
    const stats = await query(
      `SELECT 
         f.id,
         f.name,
         COUNT(DISTINCT fj.contact_id) as total_users,
         COUNT(DISTINCT fj.contact_id) FILTER (WHERE fj.status = 'completed') as completed,
         AVG(fj.total_time_seconds) FILTER (WHERE fj.status = 'completed') as avg_time,
         SUM(fj.conversion_value) as total_revenue
       FROM flows f
       LEFT JOIN flow_journeys fj ON f.id = fj.flow_id
       WHERE f.id = $1 AND f.organization_id = $2
       GROUP BY f.id, f.name`,
      [flowId, req.organizationId]
    );
    
    if (stats.rows.length > 0) {
      const data = stats.rows[0];
      data.conversion_rate = data.total_users > 0 
        ? ((data.completed / data.total_users) * 100).toFixed(2) 
        : 0;
      results.push(data);
    }
  }
  
  res.json(results);
}));

// Get node performance across all flows
router.get('/node-performance', authenticate, asyncHandler(async (req, res) => {
  const { nodeType } = req.query;
  const { query } = await import('../config/database.js');
  
  let whereClause = 'WHERE f.organization_id = $1';
  const params = [req.organizationId];
  
  if (nodeType) {
    whereClause += ' AND na.node_type = $2';
    params.push(nodeType);
  }
  
  const result = await query(
    `SELECT 
       na.node_type,
       COUNT(*) as total_interactions,
       COUNT(*) FILTER (WHERE na.action = 'completed') as completions,
       COUNT(*) FILTER (WHERE na.action = 'dropped_off') as dropoffs,
       AVG(na.time_spent_seconds) as avg_time_spent
     FROM node_analytics na
     JOIN flows f ON na.flow_id = f.id
     ${whereClause}
     GROUP BY na.node_type
     ORDER BY total_interactions DESC`,
    params
  );
  
  res.json(result.rows);
}));

// Export analytics data (CSV)
router.get('/export/:flowId', authenticate, asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  const { query } = await import('../config/database.js');
  
  const result = await query(
    `SELECT 
       fj.contact_id,
       c.name,
       c.phone,
       fj.started_at,
       fj.completed_at,
       fj.status,
       fj.total_time_seconds,
       fj.conversion_value
     FROM flow_journeys fj
     JOIN contacts c ON fj.contact_id = c.id
     WHERE fj.flow_id = $1 AND c.organization_id = $2
     ORDER BY fj.started_at DESC`,
    [flowId, req.organizationId]
  );
  
  // Convert to CSV
  const headers = ['Contact ID', 'Name', 'Phone', 'Started At', 'Completed At', 'Status', 'Time (seconds)', 'Revenue'];
  const rows = result.rows.map(row => [
    row.contact_id,
    row.name || '',
    row.phone || '',
    row.started_at,
    row.completed_at || '',
    row.status,
    row.total_time_seconds || '',
    row.conversion_value || ''
  ]);
  
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="flow-${flowId}-analytics.csv"`);
  res.send(csv);
}));

// Get real-time analytics dashboard
router.get('/dashboard', authenticate, asyncHandler(async (req, res) => {
  const { query } = await import('../config/database.js');
  
  // Active flows
  const activeFlows = await query(
    `SELECT COUNT(*) as count FROM flows WHERE organization_id = $1 AND is_active = true`,
    [req.organizationId]
  );
  
  // Active journeys
  const activeJourneys = await query(
    `SELECT COUNT(*) as count FROM flow_journeys fj
     JOIN contacts c ON fj.contact_id = c.id
     WHERE c.organization_id = $1 AND fj.status = 'in_progress'`,
    [req.organizationId]
  );
  
  // Today's stats
  const todayStats = await query(
    `SELECT 
       COUNT(*) as journeys_started,
       COUNT(*) FILTER (WHERE status = 'completed') as journeys_completed,
       SUM(conversion_value) as revenue
     FROM flow_journeys fj
     JOIN contacts c ON fj.contact_id = c.id
     WHERE c.organization_id = $1 
     AND fj.started_at >= CURRENT_DATE`,
    [req.organizationId]
  );
  
  // Top performing flows
  const topFlows = await query(
    `SELECT 
       f.id,
       f.name,
       COUNT(DISTINCT fj.contact_id) as users,
       COUNT(DISTINCT CASE WHEN fj.status = 'completed' THEN fj.contact_id END) as completed,
       ROUND((COUNT(DISTINCT CASE WHEN fj.status = 'completed' THEN fj.contact_id END) / 
              NULLIF(COUNT(DISTINCT fj.contact_id), 0) * 100), 2) as conversion_rate
     FROM flows f
     LEFT JOIN flow_journeys fj ON f.id = fj.flow_id
     WHERE f.organization_id = $1 AND f.is_active = true
     GROUP BY f.id, f.name
     ORDER BY conversion_rate DESC
     LIMIT 5`,
    [req.organizationId]
  );
  
  res.json({
    activeFlows: parseInt(activeFlows.rows[0].count),
    activeJourneys: parseInt(activeJourneys.rows[0].count),
    today: todayStats.rows[0],
    topPerformingFlows: topFlows.rows
  });
}));

export default router;