-- ============================================
-- CONVERSA CLONE - AI FEATURES
-- Migration: 002
-- Description: Tables for AI-powered features (Marketing Brain, AI Conversations, Auto-tagging)
-- Author: BaiseBaise886
-- Date: 2025-01-13
-- ============================================

-- ============================================
-- MARKETING BRAIN (Product Knowledge Base)
-- ============================================
CREATE TABLE marketing_brain (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    product_description TEXT,
    price DECIMAL(10, 2),
    target_audience TEXT,
    marketing_angles TEXT[],
    pain_points TEXT[],
    benefits TEXT[],
    objections TEXT[],
    competitors TEXT[],
    unique_selling_points TEXT[],
    tone_of_voice VARCHAR(100) DEFAULT 'friendly',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_marketing_brain_org ON marketing_brain(organization_id);
CREATE INDEX idx_marketing_brain_product ON marketing_brain(product_name);

CREATE TRIGGER update_marketing_brain_updated_at BEFORE UPDATE ON marketing_brain
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- AI CONVERSATIONS (Chat History with AI)
-- ============================================
CREATE TABLE ai_conversations (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    message_role VARCHAR(50) NOT NULL CHECK (message_role IN ('user', 'assistant', 'system')),
    message_content TEXT NOT NULL,
    sentiment VARCHAR(50) CHECK (sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative')),
    intent VARCHAR(100),
    confidence DECIMAL(3, 2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_conversations_contact ON ai_conversations(contact_id, created_at DESC);
CREATE INDEX idx_ai_conversations_sentiment ON ai_conversations(sentiment);
CREATE INDEX idx_ai_conversations_intent ON ai_conversations(intent);

-- ============================================
-- CONTACT TAGS (Dynamic Tagging System)
-- ============================================
CREATE TABLE contact_tags (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    tag_name VARCHAR(100) NOT NULL,
    tag_value VARCHAR(255),
    auto_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contact_id, tag_name)
);

CREATE INDEX idx_contact_tags_contact ON contact_tags(contact_id);
CREATE INDEX idx_contact_tags_name ON contact_tags(tag_name);
CREATE INDEX idx_contact_tags_auto ON contact_tags(auto_generated);

-- ============================================
-- FLOW TEMPLATES (AI-Generated & Manual)
-- ============================================
CREATE TABLE flow_templates (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    flow_definition JSONB NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    generation_prompt TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_flow_templates_org ON flow_templates(organization_id);
CREATE INDEX idx_flow_templates_category ON flow_templates(category);
CREATE INDEX idx_flow_templates_public ON flow_templates(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_flow_templates_ai ON flow_templates(is_ai_generated);

CREATE TRIGGER update_flow_templates_updated_at BEFORE UPDATE ON flow_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- AI RESPONSE CACHE (Optimize API Calls)
-- ============================================
CREATE TABLE ai_response_cache (
    id SERIAL PRIMARY KEY,
    prompt_hash VARCHAR(64) UNIQUE NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    model VARCHAR(100),
    tokens_used INTEGER,
    cost DECIMAL(10, 4),
    hits INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_cache_hash ON ai_response_cache(prompt_hash);
CREATE INDEX idx_ai_cache_model ON ai_response_cache(model);
CREATE INDEX idx_ai_cache_last_used ON ai_response_cache(last_used_at DESC);

-- Function to clean old cache entries
CREATE OR REPLACE FUNCTION clean_ai_cache() RETURNS void AS $$
BEGIN
    DELETE FROM ai_response_cache 
    WHERE last_used_at < NOW() - INTERVAL '30 days' AND hits < 5;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- AI USAGE STATISTICS
-- ============================================
CREATE TABLE ai_usage_stats (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    feature VARCHAR(100) NOT NULL,
    api_calls INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    cost DECIMAL(10, 4) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, date, feature)
);

CREATE INDEX idx_ai_usage_org ON ai_usage_stats(organization_id);
CREATE INDEX idx_ai_usage_date ON ai_usage_stats(date DESC);
CREATE INDEX idx_ai_usage_feature ON ai_usage_stats(feature);

-- ============================================
-- SENTIMENT ANALYSIS HISTORY
-- ============================================
CREATE TABLE sentiment_analysis (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    sentiment_score DECIMAL(3, 2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
    sentiment_label VARCHAR(50),
    emotions JSONB DEFAULT '{}',
    keywords TEXT[],
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sentiment_contact ON sentiment_analysis(contact_id);
CREATE INDEX idx_sentiment_score ON sentiment_analysis(sentiment_score);
CREATE INDEX idx_sentiment_label ON sentiment_analysis(sentiment_label);

-- ============================================
-- AUTO-TAGGING RULES
-- ============================================
CREATE TABLE auto_tagging_rules (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    rule_name VARCHAR(255) NOT NULL,
    conditions JSONB NOT NULL,
    tag_to_apply VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auto_tagging_org ON auto_tagging_rules(organization_id);
CREATE INDEX idx_auto_tagging_active ON auto_tagging_rules(is_active);
CREATE INDEX idx_auto_tagging_priority ON auto_tagging_rules(priority DESC);

CREATE TRIGGER update_auto_tagging_rules_updated_at BEFORE UPDATE ON auto_tagging_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CUSTOMER JOURNEY MAPPING
-- ============================================
CREATE TABLE customer_journey (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    stage VARCHAR(100) NOT NULL,
    entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    exited_at TIMESTAMP,
    duration_seconds INTEGER,
    next_stage VARCHAR(100),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_customer_journey_contact ON customer_journey(contact_id, entered_at DESC);
CREATE INDEX idx_customer_journey_stage ON customer_journey(stage);

-- ============================================
-- VIEWS: AI Insights
-- ============================================

-- Most common intents
CREATE VIEW ai_intent_summary AS
SELECT 
    intent,
    COUNT(*) as count,
    AVG(CASE 
        WHEN sentiment = 'very_positive' THEN 5
        WHEN sentiment = 'positive' THEN 4
        WHEN sentiment = 'neutral' THEN 3
        WHEN sentiment = 'negative' THEN 2
        WHEN sentiment = 'very_negative' THEN 1
        ELSE 3
    END) as avg_sentiment_score
FROM ai_conversations
WHERE intent IS NOT NULL
GROUP BY intent
ORDER BY count DESC;

-- Contact engagement scores
CREATE VIEW contact_engagement AS
SELECT 
    c.id as contact_id,
    c.name,
    c.phone,
    COUNT(DISTINCT m.id) as total_messages,
    COUNT(DISTINCT CASE WHEN m.type = 'inbound' THEN m.id END) as inbound_messages,
    AVG(fs.engagement_score) as avg_engagement_score,
    MAX(m.created_at) as last_activity
FROM contacts c
LEFT JOIN messages m ON c.id = m.contact_id
LEFT JOIN flow_states fs ON c.id = fs.contact_id
GROUP BY c.id, c.name, c.phone;

-- ============================================
-- FUNCTIONS: AI Helpers
-- ============================================

-- Calculate contact engagement score
CREATE OR REPLACE FUNCTION calculate_engagement_score(p_contact_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_score INTEGER := 50;
    v_message_count INTEGER;
    v_response_rate DECIMAL;
    v_time_spent INTEGER;
BEGIN
    -- Get message count
    SELECT COUNT(*) INTO v_message_count
    FROM messages
    WHERE contact_id = p_contact_id;
    
    -- Get response rate
    SELECT 
        CASE WHEN COUNT(*) > 0 
        THEN COUNT(*) FILTER (WHERE type = 'inbound')::DECIMAL / COUNT(*)
        ELSE 0 END
    INTO v_response_rate
    FROM messages
    WHERE contact_id = p_contact_id;
    
    -- Calculate score
    v_score := v_score + (LEAST(v_message_count, 50) * 0.5)::INTEGER;
    v_score := v_score + (v_response_rate * 30)::INTEGER;
    
    -- Clamp between 0 and 100
    v_score := GREATEST(0, LEAST(100, v_score));
    
    RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE marketing_brain IS 'Product knowledge base for AI-powered marketing';
COMMENT ON TABLE ai_conversations IS 'Chat history with AI assistant';
COMMENT ON TABLE contact_tags IS 'Dynamic tagging system with auto-generation';
COMMENT ON TABLE flow_templates IS 'Reusable flow templates including AI-generated ones';
COMMENT ON TABLE ai_response_cache IS 'Cache for AI responses to reduce API costs';
COMMENT ON TABLE sentiment_analysis IS 'Sentiment analysis results for messages';
COMMENT ON TABLE auto_tagging_rules IS 'Rules for automatic contact tagging';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================