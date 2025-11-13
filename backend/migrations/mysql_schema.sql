-- ============================================
-- CONVERSA CLONE - MySQL Native Schema
-- Description: Complete MySQL-compatible schema for all tables
-- Author: GitHub Copilot
-- Date: 2025-11-13
-- ============================================

-- Drop tables if they exist (for clean installation)
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- CORE TABLES
-- ============================================

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'starter',
    settings JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (plan IN ('starter', 'pro', 'enterprise'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Organizations
CREATE TABLE IF NOT EXISTS user_organizations (
    user_id INT NOT NULL,
    organization_id INT NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, organization_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CHECK (role IN ('owner', 'admin', 'agent', 'viewer'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    instagram_username VARCHAR(255),
    channel_type VARCHAR(50) DEFAULT 'whatsapp',
    tags JSON DEFAULT NULL,
    custom_fields JSON DEFAULT NULL,
    last_message_at TIMESTAMP NULL,
    last_message_preview TEXT,
    unread_count INT DEFAULT 0,
    archived_at TIMESTAMP NULL,
    pinned TINYINT(1) DEFAULT 0,
    muted TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    INDEX idx_contacts_org (organization_id),
    INDEX idx_contacts_phone (phone),
    INDEX idx_contacts_email (email),
    INDEX idx_contacts_last_message (last_message_at DESC),
    CHECK (channel_type IN ('whatsapp', 'instagram', 'telegram'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Channels
CREATE TABLE IF NOT EXISTS channels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    status VARCHAR(50) DEFAULT 'disconnected',
    qr_code TEXT,
    credentials JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    INDEX idx_channels_org (organization_id),
    INDEX idx_channels_type (type),
    CHECK (type IN ('whatsapp', 'instagram', 'telegram')),
    CHECK (status IN ('connected', 'disconnected', 'pending_qr', 'error'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact_id INT NOT NULL,
    channel_id INT,
    content TEXT,
    type VARCHAR(50) DEFAULT 'inbound',
    media_type VARCHAR(50),
    media_url TEXT,
    status VARCHAR(50) DEFAULT 'sent',
    error_message TEXT,
    external_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL,
    INDEX idx_messages_contact (contact_id),
    INDEX idx_messages_channel (channel_id),
    INDEX idx_messages_created (created_at DESC),
    INDEX idx_messages_type (type),
    CHECK (type IN ('inbound', 'outbound_api', 'outbound_agent', 'outbound_flow'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Flows
CREATE TABLE IF NOT EXISTS flows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50),
    trigger_config JSON DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    INDEX idx_flows_org (organization_id),
    INDEX idx_flows_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Flow Nodes
CREATE TABLE IF NOT EXISTS flow_nodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    flow_id INT NOT NULL,
    node_id VARCHAR(100) NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    node_data JSON DEFAULT NULL,
    position_x FLOAT,
    position_y FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
    INDEX idx_flow_nodes_flow (flow_id),
    UNIQUE KEY unique_flow_node (flow_id, node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Flow Edges
CREATE TABLE IF NOT EXISTS flow_edges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    flow_id INT NOT NULL,
    source_node_id VARCHAR(100) NOT NULL,
    target_node_id VARCHAR(100) NOT NULL,
    edge_data JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
    INDEX idx_flow_edges_flow (flow_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Live Chat Sessions
CREATE TABLE IF NOT EXISTS live_chat_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact_id INT NOT NULL,
    assigned_user_id INT,
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_live_chat_contact (contact_id),
    INDEX idx_live_chat_user (assigned_user_id),
    INDEX idx_live_chat_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Presence
CREATE TABLE IF NOT EXISTS user_presence (
    user_id INT PRIMARY KEY,
    organization_id INT,
    status VARCHAR(50) DEFAULT 'offline',
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    socket_id VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    INDEX idx_user_presence_org (organization_id),
    INDEX idx_user_presence_status (status),
    CHECK (status IN ('online', 'away', 'offline'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Typing Indicators
CREATE TABLE IF NOT EXISTS typing_indicators (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact_id INT NOT NULL,
    user_id INT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_typing_contact (contact_id),
    INDEX idx_typing_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Message Queue
CREATE TABLE IF NOT EXISTS message_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    channel_id INT NOT NULL,
    contact_id INT NOT NULL,
    content TEXT NOT NULL,
    media_type VARCHAR(50),
    media_url TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL,
    retry_count INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    INDEX idx_queue_status (status),
    INDEX idx_queue_scheduled (scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- AI FEATURES
-- ============================================

-- Marketing Brain
CREATE TABLE IF NOT EXISTS marketing_brain (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_description TEXT,
    price DECIMAL(10, 2),
    target_audience TEXT,
    marketing_angles JSON DEFAULT NULL,
    pain_points JSON DEFAULT NULL,
    benefits JSON DEFAULT NULL,
    objections JSON DEFAULT NULL,
    competitors JSON DEFAULT NULL,
    unique_selling_points JSON DEFAULT NULL,
    tone_of_voice VARCHAR(100) DEFAULT 'friendly',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    INDEX idx_marketing_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact_id INT NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    context JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    INDEX idx_ai_conv_contact (contact_id),
    INDEX idx_ai_conv_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ANALYTICS & A/B TESTING
-- ============================================

-- Flow Variants
CREATE TABLE IF NOT EXISTS flow_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    flow_id INT NOT NULL,
    variant_name VARCHAR(255) NOT NULL,
    flow_definition JSON NOT NULL,
    traffic_percentage INT DEFAULT 50,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
    INDEX idx_variants_flow (flow_id),
    CHECK (traffic_percentage >= 0 AND traffic_percentage <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Flow Journeys
CREATE TABLE IF NOT EXISTS flow_journeys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    flow_id INT NOT NULL,
    variant_id INT,
    contact_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'in_progress',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    total_time_seconds INT,
    conversion_value DECIMAL(10, 2),
    FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES flow_variants(id) ON DELETE SET NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    INDEX idx_journeys_flow (flow_id),
    INDEX idx_journeys_variant (variant_id),
    INDEX idx_journeys_contact (contact_id),
    INDEX idx_journeys_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AB Test Results
CREATE TABLE IF NOT EXISTS ab_test_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    flow_id INT NOT NULL,
    variant_id INT NOT NULL,
    metric_date DATE NOT NULL,
    total_starts INT DEFAULT 0,
    total_completions INT DEFAULT 0,
    conversion_rate DECIMAL(5, 2) DEFAULT 0,
    total_revenue DECIMAL(10, 2) DEFAULT 0,
    avg_revenue_per_user DECIMAL(10, 2) DEFAULT 0,
    FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES flow_variants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_metric (flow_id, variant_id, metric_date),
    INDEX idx_abtest_flow (flow_id),
    INDEX idx_abtest_date (metric_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- MEDIA & MULTIMEDIA
-- ============================================

-- Media Library
CREATE TABLE IF NOT EXISTS media_library (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT,
    duration_seconds INT,
    width INT,
    height INT,
    uploaded_by INT,
    tags JSON DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_media_org (organization_id),
    INDEX idx_media_type (file_type),
    CHECK (file_type IN ('image', 'video', 'audio', 'document'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PRODUCTION FEATURES
-- ============================================

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    `key` VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    permissions JSON DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_apikeys_org (organization_id),
    INDEX idx_apikeys_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conversation List (materialized view alternative)
CREATE TABLE IF NOT EXISTS conversation_list (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact_id INT NOT NULL,
    organization_id INT NOT NULL,
    last_message_at TIMESTAMP NULL,
    last_message_preview TEXT,
    unread_count INT DEFAULT 0,
    assigned_user_id INT,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_conv_list_org (organization_id),
    INDEX idx_conv_list_updated (last_message_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Node Analytics
CREATE TABLE IF NOT EXISTS node_analytics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    flow_id INT NOT NULL,
    variant_id INT,
    node_id VARCHAR(100) NOT NULL,
    contact_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES flow_variants(id) ON DELETE SET NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    INDEX idx_node_analytics_flow (flow_id),
    INDEX idx_node_analytics_node (node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- COMPLETED
-- ============================================
