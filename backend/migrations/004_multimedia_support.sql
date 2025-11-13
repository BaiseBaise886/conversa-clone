-- ============================================
-- CONVERSA CLONE - MULTIMEDIA SUPPORT
-- Migration: 004
-- Description: Media library, sequences, voice notes, and multimedia message support
-- Author: BaiseBaise886
-- Date: 2025-01-13
-- ============================================

-- ============================================
-- MEDIA LIBRARY
-- ============================================
CREATE TABLE media_library (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('image', 'video', 'audio', 'document')),
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT,
    duration_seconds INTEGER,
    width INTEGER,
    height INTEGER,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_library_org ON media_library(organization_id);
CREATE INDEX idx_media_library_type ON media_library(file_type);
CREATE INDEX idx_media_library_uploaded_by ON media_library(uploaded_by);
CREATE INDEX idx_media_library_tags ON media_library USING GIN(tags);
CREATE INDEX idx_media_library_created ON media_library(created_at DESC);
CREATE INDEX idx_media_library_search ON media_library USING GIN(to_tsvector('english', file_name));

CREATE TRIGGER update_media_library_updated_at BEFORE UPDATE ON media_library
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MESSAGE SEQUENCES (Multi-message campaigns)
-- ============================================
CREATE TABLE message_sequences (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    sequence_name VARCHAR(255) NOT NULL,
    description TEXT,
    items JSONB NOT NULL,
    delay_between_ms INTEGER DEFAULT 2000,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_message_sequences_org ON message_sequences(organization_id);
CREATE INDEX idx_message_sequences_active ON message_sequences(is_active);

CREATE TRIGGER update_message_sequences_updated_at BEFORE UPDATE ON message_sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEQUENCE EXECUTIONS (Track sequence sends)
-- ============================================
CREATE TABLE sequence_executions (
    id SERIAL PRIMARY KEY,
    sequence_id INTEGER REFERENCES message_sequences(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    current_item_index INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sequence_executions_sequence ON sequence_executions(sequence_id);
CREATE INDEX idx_sequence_executions_contact ON sequence_executions(contact_id);
CREATE INDEX idx_sequence_executions_status ON sequence_executions(status);

-- ============================================
-- VOICE NOTE TEMPLATES
-- ============================================
CREATE TABLE voice_note_templates (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    media_id INTEGER REFERENCES media_library(id) ON DELETE CASCADE,
    duration_seconds INTEGER,
    transcript TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_voice_note_templates_org ON voice_note_templates(organization_id);
CREATE INDEX idx_voice_note_templates_media ON voice_note_templates(media_id);

CREATE TRIGGER update_voice_note_templates_updated_at BEFORE UPDATE ON voice_note_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MEDIA USAGE TRACKING
-- ============================================
CREATE TABLE media_usage (
    id SERIAL PRIMARY KEY,
    media_id INTEGER REFERENCES media_library(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    flow_id INTEGER REFERENCES flows(id) ON DELETE SET NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_usage_media ON media_usage(media_id);
CREATE INDEX idx_media_usage_contact ON media_usage(contact_id);
CREATE INDEX idx_media_usage_flow ON media_usage(flow_id);
CREATE INDEX idx_media_usage_date ON media_usage(used_at DESC);

-- ============================================
-- IMAGE VARIANTS (Optimized sizes)
-- ============================================
CREATE TABLE image_variants (
    id SERIAL PRIMARY KEY,
    original_media_id INTEGER REFERENCES media_library(id) ON DELETE CASCADE,
    variant_type VARCHAR(50) NOT NULL CHECK (variant_type IN ('thumbnail', 'small', 'medium', 'large', 'original')),
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(original_media_id, variant_type)
);

CREATE INDEX idx_image_variants_original ON image_variants(original_media_id);
CREATE INDEX idx_image_variants_type ON image_variants(variant_type);

-- ============================================
-- MEDIA FOLDERS (Organization)
-- ============================================
CREATE TABLE media_folders (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    parent_folder_id INTEGER REFERENCES media_folders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_folders_org ON media_folders(organization_id);
CREATE INDEX idx_media_folders_parent ON media_folders(parent_folder_id);

CREATE TRIGGER update_media_folders_updated_at BEFORE UPDATE ON media_folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add folder reference to media_library
ALTER TABLE media_library ADD COLUMN folder_id INTEGER REFERENCES media_folders(id) ON DELETE SET NULL;
CREATE INDEX idx_media_library_folder ON media_library(folder_id);

-- ============================================
-- MEDIA SHARES (External sharing)
-- ============================================
CREATE TABLE media_shares (
    id SERIAL PRIMARY KEY,
    media_id INTEGER REFERENCES media_library(id) ON DELETE CASCADE,
    share_token UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    expires_at TIMESTAMP,
    max_downloads INTEGER,
    download_count INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_shares_media ON media_shares(media_id);
CREATE INDEX idx_media_shares_token ON media_shares(share_token);
CREATE INDEX idx_media_shares_expires ON media_shares(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- MULTIMEDIA NODE CONFIGURATIONS
-- ============================================
CREATE TABLE multimedia_node_configs (
    id SERIAL PRIMARY KEY,
    flow_id INTEGER REFERENCES flows(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    media_id INTEGER REFERENCES media_library(id) ON DELETE CASCADE,
    caption TEXT,
    send_as_voice BOOLEAN DEFAULT FALSE,
    compress_quality INTEGER CHECK (compress_quality >= 0 AND compress_quality <= 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(flow_id, node_id)
);

CREATE INDEX idx_multimedia_configs_flow ON multimedia_node_configs(flow_id);
CREATE INDEX idx_multimedia_configs_media ON multimedia_node_configs(media_id);

CREATE TRIGGER update_multimedia_configs_updated_at BEFORE UPDATE ON multimedia_node_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS: Media Analytics
-- ============================================

-- Media usage statistics
CREATE VIEW media_usage_stats AS
SELECT 
    ml.id as media_id,
    ml.file_name,
    ml.file_type,
    ml.file_size,
    ml.organization_id,
    COUNT(mu.id) as total_uses,
    COUNT(DISTINCT mu.contact_id) as unique_contacts,
    MAX(mu.used_at) as last_used,
    ml.created_at
FROM media_library ml
LEFT JOIN media_usage mu ON ml.id = mu.media_id
GROUP BY ml.id, ml.file_name, ml.file_type, ml.file_size, ml.organization_id, ml.created_at;

-- Storage usage by organization
CREATE VIEW storage_usage_by_org AS
SELECT 
    organization_id,
    COUNT(*) as total_files,
    SUM(file_size) as total_bytes,
    ROUND(SUM(file_size) / 1024.0 / 1024.0, 2) as total_mb,
    COUNT(*) FILTER (WHERE file_type = 'image') as image_count,
    COUNT(*) FILTER (WHERE file_type = 'video') as video_count,
    COUNT(*) FILTER (WHERE file_type = 'audio') as audio_count,
    COUNT(*) FILTER (WHERE file_type = 'document') as document_count,
    SUM(file_size) FILTER (WHERE file_type = 'image') as image_bytes,
    SUM(file_size) FILTER (WHERE file_type = 'video') as video_bytes,
    SUM(file_size) FILTER (WHERE file_type = 'audio') as audio_bytes,
    SUM(file_size) FILTER (WHERE file_type = 'document') as document_bytes
FROM media_library
GROUP BY organization_id;

-- Popular media files
CREATE VIEW popular_media AS
SELECT 
    ml.id,
    ml.file_name,
    ml.file_type,
    ml.organization_id,
    COUNT(mu.id) as usage_count,
    COUNT(DISTINCT mu.contact_id) as reach,
    MAX(mu.used_at) as last_used
FROM media_library ml
INNER JOIN media_usage mu ON ml.id = mu.media_id
GROUP BY ml.id, ml.file_name, ml.file_type, ml.organization_id
HAVING COUNT(mu.id) > 0
ORDER BY usage_count DESC;

-- ============================================
-- FUNCTIONS: Media Helpers
-- ============================================

-- Track media usage
CREATE OR REPLACE FUNCTION track_media_usage(
    p_media_id INTEGER,
    p_contact_id INTEGER,
    p_message_id INTEGER DEFAULT NULL,
    p_flow_id INTEGER DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO media_usage (media_id, contact_id, message_id, flow_id)
    VALUES (p_media_id, p_contact_id, p_message_id, p_flow_id);
END;
$$ LANGUAGE plpgsql;

-- Get media file info
CREATE OR REPLACE FUNCTION get_media_info(p_media_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_info JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', ml.id,
        'file_name', ml.file_name,
        'file_type', ml.file_type,
        'mime_type', ml.mime_type,
        'file_size', ml.file_size,
        'file_path', ml.file_path,
        'thumbnail_path', ml.thumbnail_path,
        'duration_seconds', ml.duration_seconds,
        'width', ml.width,
        'height', ml.height,
        'usage_count', COUNT(mu.id),
        'created_at', ml.created_at
    ) INTO v_info
    FROM media_library ml
    LEFT JOIN media_usage mu ON ml.id = mu.media_id
    WHERE ml.id = p_media_id
    GROUP BY ml.id, ml.file_name, ml.file_type, ml.mime_type, ml.file_size, 
             ml.file_path, ml.thumbnail_path, ml.duration_seconds, ml.width, ml.height, ml.created_at;
    
    RETURN v_info;
END;
$$ LANGUAGE plpgsql;

-- Clean up old media files
CREATE OR REPLACE FUNCTION cleanup_unused_media(p_days_old INTEGER DEFAULT 90)
RETURNS TABLE(deleted_count INTEGER, freed_bytes BIGINT) AS $$
DECLARE
    v_deleted_count INTEGER;
    v_freed_bytes BIGINT;
BEGIN
    WITH deleted AS (
        DELETE FROM media_library
        WHERE created_at < NOW() - (p_days_old || ' days')::INTERVAL
        AND id NOT IN (SELECT DISTINCT media_id FROM media_usage)
        AND id NOT IN (SELECT DISTINCT media_id FROM multimedia_node_configs)
        RETURNING id, file_size
    )
    SELECT COUNT(*), COALESCE(SUM(file_size), 0)
    INTO v_deleted_count, v_freed_bytes
    FROM deleted;
    
    RETURN QUERY SELECT v_deleted_count, v_freed_bytes;
END;
$$ LANGUAGE plpgsql;

-- Generate share token for media
CREATE OR REPLACE FUNCTION generate_media_share(
    p_media_id INTEGER,
    p_created_by INTEGER,
    p_expires_hours INTEGER DEFAULT NULL,
    p_max_downloads INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_token UUID;
    v_expires_at TIMESTAMP;
BEGIN
    v_token := uuid_generate_v4();
    
    IF p_expires_hours IS NOT NULL THEN
        v_expires_at := NOW() + (p_expires_hours || ' hours')::INTERVAL;
    END IF;
    
    INSERT INTO media_shares (media_id, share_token, expires_at, max_downloads, created_by)
    VALUES (p_media_id, v_token, v_expires_at, p_max_downloads, p_created_by);
    
    RETURN v_token;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS: Auto-update usage counts
-- ============================================

-- Update sequence usage count
CREATE OR REPLACE FUNCTION update_sequence_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' THEN
        UPDATE message_sequences
        SET usage_count = usage_count + 1
        WHERE id = NEW.sequence_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sequence_execution_completed
AFTER UPDATE ON sequence_executions
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
EXECUTE FUNCTION update_sequence_usage_count();

-- Update voice note template usage
CREATE OR REPLACE FUNCTION update_voice_template_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE voice_note_templates
    SET usage_count = usage_count + 1
    WHERE media_id = NEW.media_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voice_template_used
AFTER INSERT ON media_usage
FOR EACH ROW
EXECUTE FUNCTION update_voice_template_usage();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE media_library IS 'Central repository for all media files';
COMMENT ON TABLE message_sequences IS 'Pre-defined sequences of multimedia messages';
COMMENT ON TABLE sequence_executions IS 'Track execution of message sequences';
COMMENT ON TABLE voice_note_templates IS 'Reusable voice note templates';
COMMENT ON TABLE media_usage IS 'Track when and where media is used';
COMMENT ON TABLE image_variants IS 'Optimized image sizes for different use cases';
COMMENT ON TABLE media_folders IS 'Organization folders for media library';
COMMENT ON TABLE media_shares IS 'External sharing links for media files';
COMMENT ON TABLE multimedia_node_configs IS 'Media configurations for flow nodes';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================