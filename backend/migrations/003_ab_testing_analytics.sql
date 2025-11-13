-- ============================================
-- CONVERSA CLONE - A/B TESTING & ANALYTICS
-- Migration: 003
-- Description: Advanced analytics, A/B testing, funnel analysis, and performance tracking
-- Author: BaiseBaise886
-- Date: 2025-01-13
-- ============================================

-- ============================================
-- FLOW VARIANTS (A/B Testing)
-- ============================================
CREATE TABLE flow_variants (
    id SERIAL PRIMARY KEY,
    flow_id INTEGER REFERENCES flows(id) ON DELETE CASCADE,
    variant_name VARCHAR(255) NOT NULL,
    flow_definition JSONB NOT NULL,
    traffic_percentage INTEGER DEFAULT 50 CHECK (traffic_percentage >= 0 AND traffic_percentage <= 100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_flow_variants_flow ON flow_variants(flow_id);
CREATE INDEX idx_flow_variants_active ON flow_variants(is_active);

CREATE TRIGGER update_flow_variants_updated_at BEFORE UPDATE ON flow_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CONTACT VARIANT ASSIGNMENTS
-- ============================================
CREATE TABLE contact_variant_assignments (
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    flow_id INTEGER REFERENCES flows(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES flow_variants(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (contact_id, flow_id)
);

CREATE INDEX idx_variant_assignments_variant ON contact_variant_assignments(variant_id);
CREATE INDEX idx_variant_assignments_flow ON contact_variant_assignments(flow_id);

-- ============================================
-- FLOW JOURNEYS (Detailed Flow Execution Tracking)
-- ============================================
CREATE TABLE flow_journeys (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    flow_id INTEGER REFERENCES flows(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES flow_variants(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    total_time_seconds INTEGER,
    path JSONB DEFAULT '[]',
    last_node_id VARCHAR(100),
    conversion_value DECIMAL(10, 2),
    UNIQUE(contact_id, flow_id)
);

CREATE INDEX idx_flow_journeys_contact ON flow_journeys(contact_id);
CREATE INDEX idx_flow_journeys_flow ON flow_journeys(flow_id);
CREATE INDEX idx_flow_journeys_variant ON flow_journeys(variant_id);
CREATE INDEX idx_flow_journeys_status ON flow_journeys(status);
CREATE INDEX idx_flow_journeys_started ON flow_journeys(started_at DESC);

-- ============================================
-- NODE ANALYTICS (Per-Node Performance)
-- ============================================
CREATE TABLE node_analytics (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    flow_id INTEGER REFERENCES flows(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES flow_variants(id) ON DELETE SET NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('entered', 'completed', 'dropped_off', 'skipped')),
    user_response TEXT,
    time_spent_seconds INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_node_analytics_flow ON node_analytics(flow_id, node_id);
CREATE INDEX idx_node_analytics_variant ON node_analytics(variant_id);
CREATE INDEX idx_node_analytics_contact ON node_analytics(contact_id);
CREATE INDEX idx_node_analytics_action ON node_analytics(action);
CREATE INDEX idx_node_analytics_created ON node_analytics(created_at DESC);

-- ============================================
-- RESPONSE PATTERNS (User Response Analysis)
-- ============================================
CREATE TABLE response_patterns (
    id SERIAL PRIMARY KEY,
    flow_id INTEGER REFERENCES flows(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    response_text TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    led_to_conversion BOOLEAN DEFAULT FALSE,
    avg_time_to_next_node INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_response_patterns_flow ON response_patterns(flow_id, node_id);
CREATE INDEX idx_response_patterns_count ON response_patterns(count DESC);

CREATE TRIGGER update_response_patterns_updated_at BEFORE UPDATE ON response_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNNEL ANALYTICS
-- ============================================
CREATE TABLE funnel_analytics (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    flow_id INTEGER REFERENCES flows(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    stage VARCHAR(100) NOT NULL,
    entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    exited_at TIMESTAMP,
    converted BOOLEAN DEFAULT FALSE,
    revenue DECIMAL(10, 2),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_funnel_analytics_flow ON funnel_analytics(flow_id, stage);
CREATE INDEX idx_funnel_analytics_contact ON funnel_analytics(contact_id);
CREATE INDEX idx_funnel_analytics_converted ON funnel_analytics(converted);

-- ============================================
-- A/B TEST RESULTS (Aggregated Daily)
-- ============================================
CREATE TABLE ab_test_results (
    id SERIAL PRIMARY KEY,
    flow_id INTEGER REFERENCES flows(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES flow_variants(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    total_starts INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,
    total_drop_offs INTEGER DEFAULT 0,
    avg_completion_time_seconds DECIMAL(10, 2),
    conversion_rate DECIMAL(5, 4),
    total_revenue DECIMAL(10, 2),
    avg_revenue_per_user DECIMAL(10, 2),
    avg_messages_sent DECIMAL(5, 2),
    avg_response_rate DECIMAL(5, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(flow_id, variant_id, metric_date)
);

CREATE INDEX idx_ab_test_results_flow ON ab_test_results(flow_id);
CREATE INDEX idx_ab_test_results_variant ON ab_test_results(variant_id);
CREATE INDEX idx_ab_test_results_date ON ab_test_results(metric_date DESC);

CREATE TRIGGER update_ab_test_results_updated_at BEFORE UPDATE ON ab_test_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- A/B TEST WINNERS (Historical Record)
-- ============================================
CREATE TABLE ab_test_winners (
    id SERIAL PRIMARY KEY,
    flow_id INTEGER REFERENCES flows(id) ON DELETE CASCADE,
    winning_variant_id INTEGER REFERENCES flow_variants(id) ON DELETE SET NULL,
    confidence_level DECIMAL(3, 2),
    improvement_percentage DECIMAL(5, 2),
    sample_size INTEGER,
    test_duration_days INTEGER,
    reason TEXT,
    declared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ab_test_winners_flow ON ab_test_winners(flow_id);
CREATE INDEX idx_ab_test_winners_declared ON ab_test_winners(declared_at DESC);

-- ============================================
-- CONVERSION TRACKING
-- ============================================
CREATE TABLE conversions (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    flow_id INTEGER REFERENCES flows(id) ON DELETE SET NULL,
    conversion_type VARCHAR(100) NOT NULL,
    conversion_value DECIMAL(10, 2),
    metadata JSONB DEFAULT '{}',
    converted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversions_org ON conversions(organization_id);
CREATE INDEX idx_conversions_contact ON conversions(contact_id);
CREATE INDEX idx_conversions_flow ON conversions(flow_id);
CREATE INDEX idx_conversions_type ON conversions(conversion_type);
CREATE INDEX idx_conversions_date ON conversions(converted_at DESC);

-- ============================================
-- ANALYTICS VIEWS
-- ============================================

-- Flow Performance Overview
CREATE VIEW flow_performance AS
SELECT 
    f.id as flow_id,
    f.name as flow_name,
    f.organization_id,
    COUNT(DISTINCT fj.contact_id) as total_users,
    COUNT(DISTINCT fj.contact_id) FILTER (WHERE fj.status = 'completed') as completed_users,
    COUNT(DISTINCT fj.contact_id) FILTER (WHERE fj.status = 'abandoned') as abandoned_users,
    ROUND(
        CASE WHEN COUNT(DISTINCT fj.contact_id) > 0 
        THEN (COUNT(DISTINCT fj.contact_id) FILTER (WHERE fj.status = 'completed')::DECIMAL / COUNT(DISTINCT fj.contact_id)) * 100
        ELSE 0 END, 2
    ) as conversion_rate,
    ROUND(AVG(fj.total_time_seconds) FILTER (WHERE fj.status = 'completed'), 0) as avg_completion_time,
    SUM(fj.conversion_value) as total_revenue,
    ROUND(AVG(fj.conversion_value), 2) as avg_revenue_per_user
FROM flows f
LEFT JOIN flow_journeys fj ON f.id = fj.flow_id
GROUP BY f.id, f.name, f.organization_id;

-- Variant Comparison
CREATE VIEW variant_comparison AS
SELECT 
    fv.flow_id,
    fv.id as variant_id,
    fv.variant_name,
    fv.traffic_percentage,
    COUNT(DISTINCT fj.contact_id) as total_users,
    COUNT(DISTINCT fj.contact_id) FILTER (WHERE fj.status = 'completed') as completed_users,
    ROUND(
        CASE WHEN COUNT(DISTINCT fj.contact_id) > 0 
        THEN (COUNT(DISTINCT fj.contact_id) FILTER (WHERE fj.status = 'completed')::DECIMAL / COUNT(DISTINCT fj.contact_id)) * 100
        ELSE 0 END, 2
    ) as conversion_rate,
    ROUND(AVG(fj.total_time_seconds) FILTER (WHERE fj.status = 'completed'), 0) as avg_completion_time,
    SUM(fj.conversion_value) as total_revenue
FROM flow_variants fv
LEFT JOIN flow_journeys fj ON fv.id = fj.variant_id
GROUP BY fv.flow_id, fv.id, fv.variant_name, fv.traffic_percentage;

-- Node Drop-off Analysis
CREATE VIEW node_dropoff_analysis AS
SELECT 
    na.flow_id,
    na.node_id,
    na.node_type,
    COUNT(DISTINCT na.contact_id) FILTER (WHERE na.action = 'entered') as entered,
    COUNT(DISTINCT na.contact_id) FILTER (WHERE na.action = 'completed') as completed,
    COUNT(DISTINCT na.contact_id) FILTER (WHERE na.action = 'dropped_off') as dropped_off,
    ROUND(
        CASE WHEN COUNT(DISTINCT na.contact_id) FILTER (WHERE na.action = 'entered') > 0
        THEN (COUNT(DISTINCT na.contact_id) FILTER (WHERE na.action = 'dropped_off')::DECIMAL / 
              COUNT(DISTINCT na.contact_id) FILTER (WHERE na.action = 'entered')) * 100
        ELSE 0 END, 2
    ) as dropoff_rate
FROM node_analytics na
GROUP BY na.flow_id, na.node_id, na.node_type;

-- ============================================
-- FUNCTIONS: Analytics Helpers
-- ============================================

-- Calculate statistical significance for A/B tests
CREATE OR REPLACE FUNCTION calculate_ab_significance(
    p_control_conversions INTEGER,
    p_control_total INTEGER,
    p_variant_conversions INTEGER,
    p_variant_total INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_p1 DECIMAL;
    v_p2 DECIMAL;
    v_p_pool DECIMAL;
    v_se DECIMAL;
    v_z_score DECIMAL;
    v_is_significant BOOLEAN;
BEGIN
    -- Calculate conversion rates
    v_p1 := p_control_conversions::DECIMAL / NULLIF(p_control_total, 0);
    v_p2 := p_variant_conversions::DECIMAL / NULLIF(p_variant_total, 0);
    
    -- Pooled probability
    v_p_pool := (p_control_conversions + p_variant_conversions)::DECIMAL / 
                NULLIF(p_control_total + p_variant_total, 0);
    
    -- Standard error
    v_se := SQRT(v_p_pool * (1 - v_p_pool) * ((1.0 / p_control_total) + (1.0 / p_variant_total)));
    
    -- Z-score
    v_z_score := ABS((v_p2 - v_p1) / NULLIF(v_se, 0));
    
    -- Is significant at 95% confidence (z > 1.96)
    v_is_significant := v_z_score > 1.96;
    
    RETURN jsonb_build_object(
        'control_rate', ROUND(v_p1 * 100, 2),
        'variant_rate', ROUND(v_p2 * 100, 2),
        'z_score', ROUND(v_z_score, 2),
        'is_significant', v_is_significant,
        'confidence', '95%',
        'improvement', ROUND(((v_p2 / NULLIF(v_p1, 0)) - 1) * 100, 2)
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE flow_variants IS 'A/B test variants for flows';
COMMENT ON TABLE flow_journeys IS 'Detailed tracking of user journey through flows';
COMMENT ON TABLE node_analytics IS 'Per-node performance metrics';
COMMENT ON TABLE response_patterns IS 'Analysis of user response patterns';
COMMENT ON TABLE funnel_analytics IS 'Funnel stage tracking and conversion';
COMMENT ON TABLE ab_test_results IS 'Aggregated A/B test results by day';
COMMENT ON TABLE conversions IS 'Conversion event tracking';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================