-- ============================================
-- CONVERSA CLONE - INITIAL SCHEMA
-- Migration: 001
-- Description: Core tables for organizations, users, contacts, channels, messages, flows
-- Author: BaiseBaise886
-- Date: 2025-01-13
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable full text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- ORGANIZATIONS
-- ============================================
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_organizations_plan ON organizations(plan);

-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- USER ORGANIZATIONS (Many-to-Many)
-- ============================================
CREATE TABLE user_organizations (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'agent', 'viewer')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, organization_id)
);

CREATE INDEX idx_user_orgs_user ON user_organizations(user_id);
CREATE INDEX idx_user_orgs_org ON user_organizations(organization_id);

-- ============================================
-- CONTACTS
-- ============================================
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    instagram_username VARCHAR(255),
    channel_type VARCHAR(50) DEFAULT 'whatsapp' CHECK (channel_type IN ('whatsapp', 'instagram', 'telegram')),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    custom_fields JSONB DEFAULT '{}',
    last_message_at TIMESTAMP,
    last_message_preview TEXT,
    unread_count INTEGER DEFAULT 0,
    archived_at TIMESTAMP,
    pinned BOOLEAN DEFAULT FALSE,
    muted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contacts_org ON contacts(organization_id);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX idx_contacts_last_message ON contacts(last_message_at DESC);
CREATE INDEX idx_contacts_archived ON contacts(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX idx_contacts_search ON contacts USING GIN(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(phone, '') || ' ' || COALESCE(email, '')));

-- ============================================
-- CHANNELS
-- ============================================
CREATE TABLE channels (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('whatsapp', 'instagram', 'telegram')),
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    status VARCHAR(50) DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'pending_qr', 'error')),
    qr_code TEXT,
    credentials JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_channels_org ON channels(organization_id);
CREATE INDEX idx_channels_status ON channels(status);
CREATE INDEX idx_channels_type ON channels(type);

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL,
    content TEXT,
    type VARCHAR(50) DEFAULT 'inbound' CHECK (type IN ('inbound', 'outbound_bot', 'outbound_agent', 'outbound_flow')),
    message_id VARCHAR(255),
    media_type VARCHAR(50) CHECK (media_type IN ('text', 'image', 'video', 'audio', 'document', 'voice')),
    media_url TEXT,
    media_filename VARCHAR(255),
    media_mimetype VARCHAR(100),
    read_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_contact ON messages(contact_id, created_at DESC);
CREATE INDEX idx_messages_channel ON messages(channel_id);
CREATE INDEX idx_messages_type ON messages(type);
CREATE INDEX idx_messages_read ON messages(read_at) WHERE read_at IS NULL;
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- Full text search on message content
ALTER TABLE messages ADD COLUMN search_vector tsvector;
CREATE INDEX idx_messages_search ON messages USING GIN(search_vector);

CREATE OR REPLACE FUNCTION messages_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_search_update BEFORE INSERT OR UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION messages_search_trigger();

-- ============================================
-- FLOWS
-- ============================================
CREATE TABLE flows (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    keyword_triggers TEXT[] DEFAULT ARRAY[]::TEXT[],
    flow_definition JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_flows_org ON flows(organization_id);
CREATE INDEX idx_flows_active ON flows(is_active);
CREATE INDEX idx_flows_keywords ON flows USING GIN(keyword_triggers);

-- ============================================
-- FLOW STATES (Track user progress through flows)
-- ============================================
CREATE TABLE flow_states (
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    flow_id INTEGER REFERENCES flows(id) ON DELETE CASCADE,
    current_node_id VARCHAR(100),
    variables JSONB DEFAULT '{}',
    completed BOOLEAN DEFAULT FALSE,
    awaiting_input BOOLEAN DEFAULT FALSE,
    engagement_score INTEGER DEFAULT 50 CHECK (engagement_score >= 0 AND engagement_score <= 100),
    user_sentiment VARCHAR(50),
    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (contact_id, flow_id)
);

CREATE INDEX idx_flow_states_contact ON flow_states(contact_id);
CREATE INDEX idx_flow_states_flow ON flow_states(flow_id);
CREATE INDEX idx_flow_states_awaiting ON flow_states(awaiting_input) WHERE awaiting_input = TRUE;
CREATE INDEX idx_flow_states_completed ON flow_states(completed);

-- ============================================
-- LIVE CHAT SESSIONS
-- ============================================
CREATE TABLE live_chat_sessions (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
    assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'resolved')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE INDEX idx_live_chat_contact ON live_chat_sessions(contact_id);
CREATE INDEX idx_live_chat_assigned ON live_chat_sessions(assigned_user_id);
CREATE INDEX idx_live_chat_status ON live_chat_sessions(status);

-- ============================================
-- MESSAGE QUEUE (Anti-ban system)
-- ============================================
CREATE TABLE message_queue (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_message_queue_scheduled ON message_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_message_queue_status ON message_queue(status);
CREATE INDEX idx_message_queue_channel ON message_queue(channel_id);

-- ============================================
-- EVENT LOGS
-- ============================================
CREATE TABLE event_logs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    event_name VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_logs_org ON event_logs(organization_id);
CREATE INDEX idx_event_logs_contact ON event_logs(contact_id);
CREATE INDEX idx_event_logs_name ON event_logs(event_name);
CREATE INDEX idx_event_logs_created ON event_logs(created_at DESC);

-- ============================================
-- USER PRESENCE (For real-time features)
-- ============================================
CREATE TABLE user_presence (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    socket_id VARCHAR(255),
    active_chats INTEGER[] DEFAULT ARRAY[]::INTEGER[]
);

CREATE INDEX idx_user_presence_org ON user_presence(organization_id);
CREATE INDEX idx_user_presence_status ON user_presence(status);

-- ============================================
-- TYPING INDICATORS
-- ============================================
CREATE TABLE typing_indicators (
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_typing BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (contact_id, user_id)
);

-- ============================================
-- MATERIALIZED VIEW: Conversation List
-- ============================================
CREATE MATERIALIZED VIEW conversation_list AS
SELECT 
    c.id as contact_id,
    c.organization_id,
    c.name,
    c.phone,
    c.email,
    c.channel_type,
    c.last_message_at,
    c.last_message_preview,
    c.unread_count,
    c.pinned,
    c.muted,
    c.archived_at,
    lcs.status as chat_status,
    lcs.assigned_user_id,
    COUNT(m.id) as total_messages
FROM contacts c
LEFT JOIN messages m ON c.id = m.contact_id
LEFT JOIN live_chat_sessions lcs ON c.id = lcs.contact_id
GROUP BY c.id, lcs.status, lcs.assigned_user_id;

CREATE UNIQUE INDEX idx_conversation_list_contact ON conversation_list(contact_id);
CREATE INDEX idx_conversation_list_org ON conversation_list(organization_id);
CREATE INDEX idx_conversation_list_status ON conversation_list(chat_status);
CREATE INDEX idx_conversation_list_last_message ON conversation_list(last_message_at DESC NULLS LAST);

-- Function to refresh conversation list
CREATE OR REPLACE FUNCTION refresh_conversation_list() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY conversation_list;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flows_updated_at BEFORE UPDATE ON flows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flow_states_updated_at BEFORE UPDATE ON flow_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Create default organization
INSERT INTO organizations (name, plan) 
VALUES ('Demo Organization', 'pro')
ON CONFLICT DO NOTHING;

-- Create default admin user
INSERT INTO users (email, password_hash, name) 
VALUES ('admin@demo.com', '$2b$10$rKvVLZ1YhXpLZ4F.BqGz0eFE7HYk0qGXZFJFqZ4F.BqGz0eFE7HYk', 'Admin User')
ON CONFLICT (email) DO NOTHING;

-- Link admin to organization
INSERT INTO user_organizations (user_id, organization_id, role)
SELECT u.id, o.id, 'admin'
FROM users u, organizations o
WHERE u.email = 'admin@demo.com' AND o.name = 'Demo Organization'
ON CONFLICT DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE organizations IS 'Organizations/Companies using the platform';
COMMENT ON TABLE users IS 'User accounts with authentication';
COMMENT ON TABLE contacts IS 'Contacts/Leads for messaging';
COMMENT ON TABLE channels IS 'Communication channels (WhatsApp, Instagram, etc.)';
COMMENT ON TABLE messages IS 'All messages sent and received';
COMMENT ON TABLE flows IS 'Automated conversation flows';
COMMENT ON TABLE flow_states IS 'Track user progress through flows';
COMMENT ON TABLE live_chat_sessions IS 'Human agent chat sessions';
COMMENT ON TABLE message_queue IS 'Queued messages with anti-ban delays';
COMMENT ON TABLE event_logs IS 'System and user events for analytics';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================