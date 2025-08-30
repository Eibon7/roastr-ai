-- ============================================================================
-- SHOP ADDONS SCHEMA
-- Issue #260: Settings → Shop functionality for addon purchases
-- ============================================================================

-- Shop addons table - defines available addons for purchase
CREATE TABLE shop_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Addon identification
    addon_key VARCHAR(50) UNIQUE NOT NULL, -- 'roasts_100', 'analysis_10k', 'rqc_monthly'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- 'roasts', 'analysis', 'features'
    
    -- Pricing
    price_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    stripe_price_id VARCHAR(255), -- Stripe Price ID for checkout
    
    -- Addon configuration
    addon_type VARCHAR(20) NOT NULL, -- 'credits', 'feature'
    credit_amount INTEGER DEFAULT 0, -- For credit-based addons (roasts, analysis)
    feature_key VARCHAR(50), -- For feature addons (rqc, etc.)
    
    -- Availability
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT shop_addons_type_check CHECK (addon_type IN ('credits', 'feature')),
    CONSTRAINT shop_addons_category_check CHECK (category IN ('roasts', 'analysis', 'features'))
);

-- User addon purchases table - tracks user purchases and current balances
CREATE TABLE user_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    addon_key VARCHAR(50) NOT NULL,
    
    -- Purchase tracking
    stripe_payment_intent_id VARCHAR(255),
    stripe_checkout_session_id VARCHAR(255),
    purchase_price_cents INTEGER NOT NULL,
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Credit tracking (for credit-based addons)
    credits_purchased INTEGER DEFAULT 0,
    credits_used INTEGER DEFAULT 0,
    credits_remaining INTEGER GENERATED ALWAYS AS (credits_purchased - credits_used) STORED,
    
    -- Feature tracking (for feature addons)
    feature_active BOOLEAN DEFAULT FALSE,
    feature_expires_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'expired', 'consumed'
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT user_addons_status_check CHECK (status IN ('active', 'expired', 'consumed'))
);

-- Purchase history table - detailed log of all addon purchases
CREATE TABLE addon_purchase_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    addon_key VARCHAR(50) NOT NULL,
    
    -- Purchase details
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_checkout_session_id VARCHAR(255),
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Purchase status
    status VARCHAR(20) NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
    
    -- Timestamps
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    
    -- Error tracking
    error_message TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT addon_purchase_status_check CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
);

-- Indexes for performance
CREATE INDEX idx_shop_addons_category_active ON shop_addons(category, is_active, sort_order);
CREATE INDEX idx_user_addons_user_id_status ON user_addons(user_id, status);
CREATE INDEX idx_user_addons_addon_key_active ON user_addons(addon_key) WHERE status = 'active';
CREATE INDEX idx_addon_purchase_history_user_id ON addon_purchase_history(user_id, created_at DESC);
CREATE INDEX idx_addon_purchase_history_stripe_payment ON addon_purchase_history(stripe_payment_intent_id);

-- Insert default shop addons
INSERT INTO shop_addons (addon_key, name, description, category, price_cents, addon_type, credit_amount, sort_order) VALUES
-- Roasts extra packs
('roasts_100', 'Roasts Pack 100', 'Pack de 100 roasts extra para ampliar tu límite mensual', 'roasts', 499, 'credits', 100, 1),
('roasts_500', 'Roasts Pack 500', 'Pack de 500 roasts extra para ampliar tu límite mensual', 'roasts', 1999, 'credits', 500, 2),
('roasts_1000', 'Roasts Pack 1000', 'Pack de 1000 roasts extra para ampliar tu límite mensual', 'roasts', 3499, 'credits', 1000, 3),

-- Analysis extra packs
('analysis_10k', 'Análisis Pack 10K', 'Pack de 10,000 análisis de comentarios extra', 'analysis', 999, 'credits', 10000, 4),
('analysis_50k', 'Análisis Pack 50K', 'Pack de 50,000 análisis de comentarios extra', 'analysis', 3999, 'credits', 50000, 5),
('analysis_100k', 'Análisis Pack 100K', 'Pack de 100,000 análisis de comentarios extra', 'analysis', 6999, 'credits', 100000, 6),

-- Feature addons
('rqc_monthly', 'RQC (Roastr Quality Check)', 'Filtro de calidad automático para tus roasts durante el ciclo actual', 'features', 1499, 'feature', 0, 7);

-- Update addon with feature key for RQC
UPDATE shop_addons SET feature_key = 'rqc_enabled' WHERE addon_key = 'rqc_monthly';

-- Add user addon credit tracking functions
CREATE OR REPLACE FUNCTION get_user_addon_credits(p_user_id UUID, p_addon_category VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    total_credits INTEGER := 0;
BEGIN
    SELECT COALESCE(SUM(credits_remaining), 0)
    INTO total_credits
    FROM user_addons ua
    JOIN shop_addons sa ON ua.addon_key = sa.addon_key
    WHERE ua.user_id = p_user_id
    AND sa.category = p_addon_category
    AND ua.status = 'active'
    AND ua.credits_remaining > 0;
    
    RETURN total_credits;
END;
$$ LANGUAGE plpgsql;

-- Function to consume addon credits
CREATE OR REPLACE FUNCTION consume_addon_credits(p_user_id UUID, p_addon_category VARCHAR, p_amount INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    addon_record RECORD;
    remaining_to_consume INTEGER := p_amount;
BEGIN
    -- Get user addons with remaining credits, ordered by oldest first
    FOR addon_record IN
        SELECT ua.id, ua.credits_remaining
        FROM user_addons ua
        JOIN shop_addons sa ON ua.addon_key = sa.addon_key
        WHERE ua.user_id = p_user_id
        AND sa.category = p_addon_category
        AND ua.status = 'active'
        AND ua.credits_remaining > 0
        ORDER BY ua.created_at ASC
    LOOP
        IF remaining_to_consume <= 0 THEN
            EXIT;
        END IF;
        
        IF addon_record.credits_remaining >= remaining_to_consume THEN
            -- This addon has enough credits to fulfill the request
            UPDATE user_addons
            SET credits_used = credits_used + remaining_to_consume,
                updated_at = NOW()
            WHERE id = addon_record.id;
            
            remaining_to_consume := 0;
        ELSE
            -- Consume all remaining credits from this addon
            UPDATE user_addons
            SET credits_used = credits_used + addon_record.credits_remaining,
                status = 'consumed',
                updated_at = NOW()
            WHERE id = addon_record.id;
            
            remaining_to_consume := remaining_to_consume - addon_record.credits_remaining;
        END IF;
    END LOOP;
    
    RETURN remaining_to_consume = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has active feature addon
CREATE OR REPLACE FUNCTION user_has_feature_addon(p_user_id UUID, p_feature_key VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    has_feature BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM user_addons ua
        JOIN shop_addons sa ON ua.addon_key = sa.addon_key
        WHERE ua.user_id = p_user_id
        AND sa.feature_key = p_feature_key
        AND ua.status = 'active'
        AND ua.feature_active = TRUE
        AND (ua.feature_expires_at IS NULL OR ua.feature_expires_at > NOW())
    ) INTO has_feature;
    
    RETURN has_feature;
END;
$$ LANGUAGE plpgsql;

-- Function to execute addon purchase transaction atomically
CREATE OR REPLACE FUNCTION execute_addon_purchase_transaction(
    p_user_id UUID,
    p_addon_key VARCHAR,
    p_stripe_payment_intent_id VARCHAR,
    p_stripe_checkout_session_id VARCHAR,
    p_amount_cents INTEGER,
    p_addon_type VARCHAR,
    p_credit_amount INTEGER DEFAULT 0,
    p_feature_key VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}';
    feature_expires_at TIMESTAMPTZ := NULL;
BEGIN
    -- Start transaction
    BEGIN
        -- Update purchase history to completed
        UPDATE addon_purchase_history
        SET status = 'completed',
            stripe_payment_intent_id = p_stripe_payment_intent_id,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE stripe_checkout_session_id = p_stripe_checkout_session_id
        AND user_id = p_user_id;

        -- For feature addons, set expiration (30 days for monthly features)
        IF p_addon_type = 'feature' AND p_feature_key IS NOT NULL THEN
            feature_expires_at := NOW() + INTERVAL '30 days';
        END IF;

        -- Insert user addon record
        INSERT INTO user_addons (
            user_id,
            addon_key,
            stripe_payment_intent_id,
            stripe_checkout_session_id,
            purchase_price_cents,
            credits_purchased,
            credits_used,
            feature_active,
            feature_expires_at,
            status,
            purchased_at
        ) VALUES (
            p_user_id,
            p_addon_key,
            p_stripe_payment_intent_id,
            p_stripe_checkout_session_id,
            p_amount_cents,
            p_credit_amount,
            0,
            CASE WHEN p_addon_type = 'feature' THEN TRUE ELSE FALSE END,
            feature_expires_at,
            'active',
            NOW()
        );

        -- Build result
        result := jsonb_build_object(
            'success', true,
            'addon_key', p_addon_key,
            'addon_type', p_addon_type,
            'credits_added', p_credit_amount,
            'feature_activated', CASE WHEN p_addon_type = 'feature' THEN TRUE ELSE FALSE END,
            'feature_expires_at', feature_expires_at
        );

        RETURN result;

    EXCEPTION WHEN OTHERS THEN
        -- Rollback and return error
        RAISE EXCEPTION 'Addon purchase transaction failed: %', SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql;
