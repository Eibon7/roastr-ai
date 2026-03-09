-- ============================================================
-- Roastr v3 — Initial Schema
-- Tables: profiles, accounts, subscriptions_usage,
--         shield_logs, offenders, admin_settings, admin_logs
-- ============================================================

-- Custom types
CREATE TYPE account_status AS ENUM ('active', 'paused', 'revoked', 'error');
CREATE TYPE status_reason AS ENUM ('user_action', 'token_expired', 'rate_limited', 'platform_error', 'billing_paused');
CREATE TYPE integration_health AS ENUM ('ok', 'degraded', 'failing');

-- ============================================================
-- 1. profiles (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                   TEXT NOT NULL,
  role                    TEXT NOT NULL DEFAULT 'user'
                          CHECK (role IN ('user', 'admin', 'superadmin')),
  username                TEXT,
  roastr_persona_config   BYTEA,
  onboarding_state        TEXT NOT NULL DEFAULT 'welcome'
                          CHECK (onboarding_state IN (
                            'welcome', 'select_plan', 'payment',
                            'persona_setup', 'connect_accounts', 'done'
                          )),
  language_preference     TEXT DEFAULT 'es',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_update ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. accounts (social platform connections)
-- ============================================================
CREATE TABLE accounts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id),
  platform                    TEXT NOT NULL,
  platform_user_id            TEXT NOT NULL,
  username                    TEXT NOT NULL,
  status                      account_status NOT NULL DEFAULT 'active',
  status_reason               status_reason,
  integration_health          integration_health NOT NULL DEFAULT 'ok',
  access_token_encrypted      BYTEA NOT NULL,
  refresh_token_encrypted     BYTEA,
  access_token_expires_at     TIMESTAMPTZ,
  shield_aggressiveness       FLOAT NOT NULL DEFAULT 0.95,
  auto_approve                BOOLEAN NOT NULL DEFAULT false,
  tone                        TEXT DEFAULT 'balanceado',
  ingestion_cursor            TEXT,
  last_successful_ingestion   TIMESTAMPTZ,
  consecutive_errors          INTEGER NOT NULL DEFAULT 0,
  retention_until             TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform, platform_user_id)
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_select ON accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY accounts_insert ON accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY accounts_update ON accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY accounts_delete ON accounts
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 3. subscriptions_usage (billing state + limits)
-- ============================================================
CREATE TABLE subscriptions_usage (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id),
  plan                  TEXT NOT NULL CHECK (plan IN ('starter', 'pro', 'plus')),
  billing_state         TEXT NOT NULL DEFAULT 'trialing'
                        CHECK (billing_state IN (
                          'trialing', 'expired_trial_pending_payment',
                          'payment_retry', 'active', 'canceled_pending', 'paused'
                        )),
  analysis_limit        INTEGER NOT NULL,
  roasts_limit          INTEGER NOT NULL DEFAULT 0,
  analysis_used         INTEGER NOT NULL DEFAULT 0,
  roasts_used           INTEGER NOT NULL DEFAULT 0,
  polar_subscription_id TEXT,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  trial_end             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_usage_select ON subscriptions_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY subscriptions_usage_update ON subscriptions_usage
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 4. shield_logs (GDPR compliant — no comment text stored)
-- ============================================================
CREATE TABLE shield_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id),
  account_id            UUID NOT NULL REFERENCES accounts(id),
  platform              TEXT NOT NULL,
  comment_id            TEXT NOT NULL,
  offender_id           TEXT,
  action_taken          TEXT NOT NULL,
  severity_score        FLOAT NOT NULL,
  matched_red_line      TEXT,
  using_aggressiveness  FLOAT,
  platform_fallback     BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shield_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY shield_logs_select ON shield_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_shield_logs_user_created ON shield_logs (user_id, created_at DESC);
CREATE INDEX idx_shield_logs_account ON shield_logs (account_id, created_at DESC);

-- ============================================================
-- 5. offenders (strike tracking per user+account)
-- ============================================================
CREATE TABLE offenders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  account_id      UUID NOT NULL REFERENCES accounts(id),
  platform        TEXT NOT NULL,
  offender_id     TEXT NOT NULL,
  strike_level    INTEGER NOT NULL DEFAULT 0 CHECK (strike_level >= 0),
  last_strike     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, account_id, platform, offender_id)
);

ALTER TABLE offenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY offenders_select ON offenders
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 6. admin_settings (SSOT key-value store)
-- ============================================================
CREATE TABLE admin_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       JSONB NOT NULL,
  updated_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write (enforced by service role key in backend)
CREATE POLICY admin_settings_select ON admin_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- Seed default SSOT values
INSERT INTO admin_settings (key, value) VALUES
  ('thresholds', '{"tau_low": 0.35, "tau_shield": 0.60, "tau_critical": 0.85}'::jsonb),
  ('weights', '{"linea_roja": 1.15, "identidad": 1.10, "tolerancia": 0.95}'::jsonb),
  ('recurrence_factors', '{"none": 1.00, "strike1": 1.10, "strike2": 1.25, "critical": 1.50}'::jsonb),
  ('flag:roasting_enabled', '{"enabled": false, "description": "Global roasting module", "category": "core"}'::jsonb),
  ('flag:enable_shield', '{"enabled": true, "description": "Shield per-account toggle", "category": "shield"}'::jsonb),
  ('flag:kill_switch_autopost', '{"enabled": false, "description": "Emergency autopost kill switch", "category": "shield"}'::jsonb),
  ('flag:enable_magic_links_user', '{"enabled": false, "description": "Magic link login for users", "category": "auth"}'::jsonb);

-- ============================================================
-- 7. admin_logs (audit trail)
-- ============================================================
CREATE TABLE admin_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_logs_select ON admin_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE INDEX idx_admin_logs_admin ON admin_logs (admin_id, created_at DESC);
CREATE INDEX idx_admin_logs_action ON admin_logs (action, created_at DESC);
