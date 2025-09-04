-- Migration: Add Stylecards System for Issue #293
-- Implements automatic style profile generation from social media content

-- ============================================================================
-- STYLECARDS TABLES
-- ============================================================================

-- Style profiles (stylecards) for users
CREATE TABLE stylecards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Profile metadata
    name VARCHAR(255) NOT NULL DEFAULT 'Auto-generated Style Profile',
    description TEXT,
    language VARCHAR(10) NOT NULL DEFAULT 'es',
    
    -- Style characteristics
    tone VARCHAR(50) NOT NULL, -- ligero, equilibrado, contundente
    formality_level INTEGER NOT NULL DEFAULT 5 CHECK (formality_level >= 1 AND formality_level <= 10),
    sarcasm_level INTEGER NOT NULL DEFAULT 5 CHECK (sarcasm_level >= 1 AND sarcasm_level <= 10),
    
    -- Generated profile data
    style_prompt TEXT NOT NULL, -- The actual prompt for AI generation
    examples JSONB DEFAULT '[]', -- Array of representative examples
    metadata JSONB DEFAULT '{}', -- Additional style metadata
    
    -- Source information
    source_platforms JSONB DEFAULT '{}', -- Which platforms were analyzed
    total_content_analyzed INTEGER DEFAULT 0,
    content_date_range JSONB DEFAULT '{}', -- {from: date, to: date}
    
    -- Embeddings for style matching
    style_embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimensions
    
    -- Status and lifecycle
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'regenerating', 'failed')),
    generation_method VARCHAR(20) NOT NULL DEFAULT 'auto' CHECK (generation_method IN ('auto', 'manual', 'hybrid')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    
    -- Constraints
    UNIQUE(user_id, language), -- One stylecard per user per language
    CONSTRAINT stylecards_tone_check CHECK (tone IN ('ligero', 'equilibrado', 'contundente', 'casual', 'formal', 'humorous', 'sarcastic', 'friendly'))
);

-- Content samples used for stylecard generation
CREATE TABLE stylecard_content_samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stylecard_id UUID REFERENCES stylecards(id) ON DELETE CASCADE,
    
    -- Content details
    platform VARCHAR(50) NOT NULL,
    platform_content_id VARCHAR(255), -- Original ID from platform
    content_type VARCHAR(20) NOT NULL DEFAULT 'post' CHECK (content_type IN ('post', 'reply', 'comment', 'tweet')),
    
    -- Content data (encrypted for privacy)
    content_text_encrypted TEXT, -- Encrypted original text
    content_metadata JSONB DEFAULT '{}', -- Non-sensitive metadata (length, language, etc.)
    
    -- Analysis results
    content_embedding VECTOR(1536), -- Embedding of the content
    language_detected VARCHAR(10),
    tone_analysis JSONB DEFAULT '{}', -- Tone analysis results
    
    -- Privacy and consent
    user_consented BOOLEAN DEFAULT FALSE,
    retention_until TIMESTAMPTZ, -- When to delete this content
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    content_date TIMESTAMPTZ, -- When the original content was posted
    
    CONSTRAINT stylecard_content_platform_check CHECK (platform IN ('twitter', 'youtube', 'bluesky', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok'))
);

-- Stylecard generation jobs and status
CREATE TABLE stylecard_generation_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Job configuration
    target_platforms JSONB NOT NULL DEFAULT '[]', -- Which platforms to analyze
    max_content_per_platform INTEGER DEFAULT 50,
    language_filter VARCHAR(10), -- Optional language filter
    
    -- Job status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    
    -- Results
    stylecard_id UUID REFERENCES stylecards(id),
    content_analyzed INTEGER DEFAULT 0,
    platforms_processed JSONB DEFAULT '{}',
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Cost tracking
    tokens_used INTEGER DEFAULT 0,
    api_calls_made INTEGER DEFAULT 0,
    estimated_cost_cents INTEGER DEFAULT 0
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Stylecards indexes
CREATE INDEX idx_stylecards_user_id ON stylecards(user_id);
CREATE INDEX idx_stylecards_organization_id ON stylecards(organization_id);
CREATE INDEX idx_stylecards_status ON stylecards(status);
CREATE INDEX idx_stylecards_language ON stylecards(language);
CREATE INDEX idx_stylecards_last_used ON stylecards(last_used_at DESC);

-- Content samples indexes
CREATE INDEX idx_stylecard_content_stylecard_id ON stylecard_content_samples(stylecard_id);
CREATE INDEX idx_stylecard_content_platform ON stylecard_content_samples(platform);
CREATE INDEX idx_stylecard_content_language ON stylecard_content_samples(language_detected);
CREATE INDEX idx_stylecard_content_date ON stylecard_content_samples(content_date DESC);
CREATE INDEX idx_stylecard_content_retention ON stylecard_content_samples(retention_until);

-- Generation jobs indexes
CREATE INDEX idx_stylecard_jobs_user_id ON stylecard_generation_jobs(user_id);
CREATE INDEX idx_stylecard_jobs_status ON stylecard_generation_jobs(status);
CREATE INDEX idx_stylecard_jobs_created_at ON stylecard_generation_jobs(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE stylecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE stylecard_content_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE stylecard_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Stylecards policies
CREATE POLICY stylecards_user_access ON stylecards FOR ALL USING (
    user_id = auth.uid() OR 
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

-- Content samples policies (more restrictive due to privacy)
CREATE POLICY stylecard_content_owner_only ON stylecard_content_samples FOR ALL USING (
    stylecard_id IN (SELECT id FROM stylecards WHERE user_id = auth.uid())
);

-- Generation jobs policies
CREATE POLICY stylecard_jobs_user_access ON stylecard_generation_jobs FOR ALL USING (
    user_id = auth.uid() OR 
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps
CREATE TRIGGER update_stylecards_updated_at 
    BEFORE UPDATE ON stylecards 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-cleanup expired content samples
CREATE OR REPLACE FUNCTION cleanup_expired_content_samples()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM stylecard_content_samples 
    WHERE retention_until IS NOT NULL 
    AND retention_until < NOW();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Run cleanup daily
CREATE OR REPLACE FUNCTION schedule_content_cleanup()
RETURNS void AS $$
BEGIN
    -- This would be called by a cron job
    PERFORM cleanup_expired_content_samples();
END;
$$ LANGUAGE plpgsql;
