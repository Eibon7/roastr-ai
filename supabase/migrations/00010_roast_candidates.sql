-- ============================================================
-- roast_candidates — metadata-only tracking of generated roasts
-- GDPR: generated text is never persisted, only shown once to the user.
-- ============================================================
CREATE TABLE roast_candidates (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id),
  account_id              UUID NOT NULL REFERENCES accounts(id),
  platform                TEXT NOT NULL,
  tone                    TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending_review'
                          CHECK (status IN ('pending_review', 'published', 'discarded')),
  has_validation_errors   BOOLEAN NOT NULL DEFAULT false,
  violation_count         INTEGER NOT NULL DEFAULT 0,
  discarded_at            TIMESTAMPTZ,
  published_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE roast_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY roast_candidates_select ON roast_candidates
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_roast_candidates_user_status ON roast_candidates (user_id, status, created_at DESC);
