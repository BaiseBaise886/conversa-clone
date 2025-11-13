-- ============================================
-- CONVERSA CLONE - PRODUCTION OPTIMIZATIONS
-- Migration: 005
-- Description: Performance indexes, partitioning, archiving, monitoring, and security
-- Author: BaiseBaise886
-- Date: 2025-01-13
-- ============================================

-- ============================================
-- API KEYS (For programmatic access)
-- ============================================
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    key VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    permissions TEXT[] DEFAULT ARRAY['read']::TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_key ON api_keys(key) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- ============================================
-- AUDIT LOGS (Compliance & Security)
-- ============================================
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Create partitions for audit logs (monthly)
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE audit_logs_2025_03 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Indexes on audit logs
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Function to create next month's partition
CREATE OR REPLACE FUNCTION create_audit_log_partition()
RETURNS void AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_partition_name TEXT;
BEGIN
    v_start_date := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
    v_end_date := v_start_date + INTERVAL '1 month';
    v_partition_name := 'audit_logs_' || TO_CHAR(v_start_date, 'YYYY_MM');
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
        v_partition_name, v_start_date, v_end_date
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SYSTEM SETTINGS
-- ============================================
CREATE TABLE system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_settings_public ON system_settings(is_public) WHERE is_public = TRUE;

-- Insert default settings
INSERT INTO system_settings (key, value, description, is_public) VALUES
('maintenance_mode', 'false', 'Enable/disable maintenance mode', TRUE),
('max_upload_size_mb', '16', 'Maximum file upload size in MB', TRUE),
('ai_enabled', 'true', 'Enable AI features globally', FALSE),
('rate_limit_enabled', 'true', 'Enable rate limiting', FALSE),
('analytics_enabled', 'true', 'Enable analytics tracking', FALSE)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- WEBHOOKS (External Integrations)
-- ============================================
CREATE TABLE webhooks (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    secret VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    retry_count INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,
    last_triggered_at TIMESTAMP,
    last_status INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhooks_org ON webhooks(organization_id);
CREATE INDEX idx_webhooks_active ON webhooks(is_active);

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- WEBHOOK LOGS
-- ============================================
CREATE TABLE webhook_logs (
    id BIGSERIAL PRIMARY KEY,
    webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
    event_name VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    response_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Create initial partition
CREATE TABLE webhook_logs_2025_01 PARTITION OF webhook_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE INDEX idx_webhook_logs_webhook ON webhook_logs(webhook_id, created_at DESC);
CREATE INDEX idx_webhook_logs_status ON webhook_logs(response_status);

-- ============================================
-- RATE LIMIT TRACKING
-- ============================================
CREATE TABLE rate_limit_tracking (
    id BIGSERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    window_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rate_limit_tracking_identifier ON rate_limit_tracking(identifier, endpoint, window_start);
CREATE INDEX idx_rate_limit_tracking_window ON rate_limit_tracking(window_end) WHERE window_end > NOW();

-- Auto-cleanup old rate limit entries
CREATE OR REPLACE FUNCTION cleanup_rate_limit_tracking()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limit_tracking
    WHERE window_end < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SYSTEM HEALTH CHECKS
-- ============================================
CREATE TABLE health_checks (
    id SERIAL PRIMARY KEY,
    check_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_health_checks_type ON health_checks(check_type, checked_at DESC);
CREATE INDEX idx_health_checks_status ON health_checks(status);

-- ============================================
-- BACKUP LOGS
-- ============================================
CREATE TABLE backup_logs (
    id SERIAL PRIMARY KEY,
    backup_type VARCHAR(50) NOT NULL CHECK (backup_type IN ('full', 'incremental', 'manual')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
    file_path TEXT,
    file_size BIGINT,
    duration_seconds INTEGER,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_backup_logs_type ON backup_logs(backup_type);
CREATE INDEX idx_backup_logs_status ON backup_logs(status);
CREATE INDEX idx_backup_logs_started ON backup_logs(started_at DESC);

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_contact_type_created 
    ON messages(contact_id, type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_channel_created 
    ON messages(channel_id, created_at DESC) WHERE type LIKE 'outbound%';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flow_states_flow_completed 
    ON flow_states(flow_id, completed, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_org_last_message 
    ON contacts(organization_id, last_message_at DESC NULLS LAST);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_logs_org_name_created 
    ON event_logs(organization_id, event_name, created_at DESC);

-- Partial indexes for specific scenarios
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_unread 
    ON contacts(organization_id, unread_count) WHERE unread_count > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_unread 
    ON messages(contact_id) WHERE read_at IS NULL AND type = 'inbound';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flow_journeys_active 
    ON flow_journeys(contact_id, flow_id) WHERE status = 'in_progress';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_queue_pending 
    ON message_queue(scheduled_at, channel_id) WHERE status = 'pending';

-- ============================================
-- ARCHIVAL TABLES (Old Data)
-- ============================================

-- Archived messages (older than 90 days)
CREATE TABLE archived_messages (
    LIKE messages INCLUDING ALL
);

CREATE INDEX idx_archived_messages_contact ON archived_messages(contact_id, created_at DESC);
CREATE INDEX idx_archived_messages_created ON archived_messages(created_at DESC);

-- Function to archive old messages
CREATE OR REPLACE FUNCTION archive_old_messages(p_days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    v_archived_count INTEGER;
BEGIN
    WITH archived AS (
        DELETE FROM messages
        WHERE created_at < NOW() - (p_days_old || ' days')::INTERVAL
        RETURNING *
    )
    INSERT INTO archived_messages SELECT * FROM archived;
    
    GET DIAGNOSTICS v_archived_count = ROW_COUNT;
    RETURN v_archived_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STATISTICS & MONITORING
-- ============================================

-- Database statistics view
CREATE VIEW database_stats AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    n_tup_ins AS inserts,
    n_tup_upd AS updates,
    n_tup_del AS deletes,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage statistics
CREATE VIEW index_usage_stats AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Slow queries tracking
CREATE TABLE slow_queries (
    id SERIAL PRIMARY KEY,
    query_text TEXT NOT NULL,
    execution_time_ms DECIMAL(10, 2) NOT NULL,
    rows_returned BIGINT,
    user_name VARCHAR(255),
    database_name VARCHAR(255),
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_slow_queries_time ON slow_queries(execution_time_ms DESC);
CREATE INDEX idx_slow_queries_occurred ON slow_queries(occurred_at DESC);

-- ============================================
-- MAINTENANCE FUNCTIONS
-- ============================================

-- Vacuum and analyze all tables
CREATE OR REPLACE FUNCTION vacuum_all_tables()
RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('VACUUM ANALYZE %I.%I', r.schemaname, r.tablename);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Reindex all tables
CREATE OR REPLACE FUNCTION reindex_all_tables()
RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('REINDEX TABLE %I.%I', r.schemaname, r.tablename);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Get table sizes
CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE(
    table_name TEXT,
    row_count BIGINT,
    total_size TEXT,
    table_size TEXT,
    indexes_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        schemaname || '.' || tablename AS table_name,
        n_live_tup AS row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - 
                      pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SECURITY ENHANCEMENTS
-- ============================================

-- Encrypt sensitive data (placeholder for future implementation)
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(p_data TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Placeholder for encryption logic
    -- In production, use pgcrypto or application-level encryption
    RETURN p_data;
END;
$$ LANGUAGE plpgsql;

-- Audit trigger for sensitive tables
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (organization_id, action, entity_type, entity_id, old_values)
        VALUES (OLD.organization_id, 'DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (organization_id, action, entity_type, entity_id, old_values, new_values)
        VALUES (NEW.organization_id, 'UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (organization_id, action, entity_type, entity_id, new_values)
        VALUES (NEW.organization_id, 'INSERT', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_contacts AFTER INSERT OR UPDATE OR DELETE ON contacts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_flows AFTER INSERT OR UPDATE OR DELETE ON flows
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_channels AFTER INSERT OR UPDATE OR DELETE ON channels
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================
-- SCHEDULED MAINTENANCE (Run via cron or pg_cron)
-- ============================================

-- Note: These are examples. Set up with pg_cron extension or external scheduler

-- Daily: Archive old messages
-- SELECT cron.schedule('archive-messages', '0 2 * * *', 'SELECT archive_old_messages(90)');

-- Daily: Cleanup rate limits
-- SELECT cron.schedule('cleanup-rate-limits', '0 3 * * *', 'SELECT cleanup_rate_limit_tracking()');

-- Daily: Cleanup AI cache
-- SELECT cron.schedule('cleanup-ai-cache', '0 4 * * *', 'SELECT clean_ai_cache()');

-- Weekly: Vacuum and analyze
-- SELECT cron.schedule('vacuum-tables', '0 1 * * 0', 'SELECT vacuum_all_tables()');

-- Monthly: Create new audit log partition
-- SELECT cron.schedule('create-audit-partition', '0 0 1 * *', 'SELECT create_audit_log_partition()');

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE api_keys IS 'API keys for programmatic access';
COMMENT ON TABLE audit_logs IS 'Audit trail for compliance and security';
COMMENT ON TABLE system_settings IS 'Global system configuration';
COMMENT ON TABLE webhooks IS 'Webhook endpoints for external integrations';
COMMENT ON TABLE webhook_logs IS 'Webhook delivery logs';
COMMENT ON TABLE health_checks IS 'System health monitoring';
COMMENT ON TABLE backup_logs IS 'Backup operation logs';
COMMENT ON TABLE archived_messages IS 'Archived messages older than 90 days';

-- ============================================
-- FINAL GRANTS (Adjust based on your security needs)
-- ============================================

-- Grant necessary permissions to application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO conversa_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO conversa_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO conversa_app_user;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Create migration tracking table if not exists
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- Record this migration
INSERT INTO schema_migrations (version, description) VALUES
('001', 'Initial schema - core tables'),
('002', 'AI features - Marketing Brain, AI conversations'),
('003', 'A/B testing and analytics'),
('004', 'Multimedia support'),
('005', 'Production optimizations')
ON CONFLICT (version) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CONVERSA CLONE DATABASE SETUP COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total Tables: %', (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public');
    RAISE NOTICE 'Total Indexes: %', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public');
    RAISE NOTICE 'Total Functions: %', (SELECT COUNT(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace);
    RAISE NOTICE 'Total Views: %', (SELECT COUNT(*) FROM pg_views WHERE schemaname = 'public');
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Default Admin: admin@demo.com';
    RAISE NOTICE 'Default Password: admin123 (CHANGE THIS!)';
    RAISE NOTICE '========================================';
END $$;