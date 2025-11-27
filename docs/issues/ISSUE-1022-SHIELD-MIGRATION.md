# Issue #1022 - Shield Migration Instructions

**Status:** 🔴 ACTION REQUIRED - Apply Shield Columns to Organizations Table
**Priority:** P1 (HIGH)
**Related:** Migration 001, Issue #362

---

## Problem Summary

Shield toggle endpoint is failing because the Supabase `organizations` table is missing columns:

**Missing Columns in `organizations` table:**

- `shield_enabled` (BOOLEAN DEFAULT FALSE NOT NULL)
- `shield_disabled_at` (TIMESTAMPTZ)
- `shield_disabled_reason` (TEXT)

**Error:**

```
Could not find the 'shield_disabled_at' column of 'organizations' in the schema cache
```

**Failing Tests:**

- POST /api/shield/toggle (all shield tests - 7 tests)

---

## Root Cause

The shield toggle endpoint (src/routes/shield.js:734) tries to update the `organizations` table with shield columns, but these columns were never added to the table.

Migration 001 creates `organization_settings` table (separate table), but the endpoint expects columns directly on `organizations`.

---

## Solution: Apply Shield Columns Migration

### Option 1: Supabase SQL Editor (Recommended) ⭐

1. **Open Supabase SQL Editor:**
   https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new

2. **Copy and paste the following SQL:**

```sql
-- Migration: Add Shield Control to Organizations Table
-- Description: Adds shield enable/disable toggle columns directly to organizations table
-- Related: Migration 001, Issue #362, Issue #1022

-- Add shield_enabled column to organizations table (default FALSE for backward compatibility)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS shield_enabled BOOLEAN DEFAULT FALSE NOT NULL;

-- Add audit trail columns for shield control
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS shield_disabled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shield_disabled_reason TEXT;

-- Create index for fast shield_enabled lookups
CREATE INDEX IF NOT EXISTS idx_organizations_shield_enabled
ON organizations(shield_enabled) WHERE shield_enabled = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN organizations.shield_enabled IS 'Global toggle for Shield automated moderation. When FALSE, Shield is disabled for this organization.';
COMMENT ON COLUMN organizations.shield_disabled_at IS 'Timestamp when Shield was disabled. Used for audit trail.';
COMMENT ON COLUMN organizations.shield_disabled_reason IS 'Optional reason for disabling Shield (e.g., user_request, testing, etc.).';

-- Set default values for existing organizations
UPDATE organizations
SET shield_enabled = FALSE
WHERE shield_enabled IS NULL;
```

3. **Click "Run" button**

4. **Verify success:** Run this query:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'organizations' AND column_name LIKE 'shield%'
ORDER BY column_name;
```

**Expected result:** 3 rows

- `shield_disabled_at` | `timestamp with time zone` | YES | NULL
- `shield_disabled_reason` | `text` | YES | NULL
- `shield_enabled` | `boolean` | NO | `false`

### Option 2: psql Command Line

```bash
# Set password from environment variable (NEVER hardcode passwords)
export PGPASSWORD="${SUPABASE_DB_PASSWORD}"

# Apply migration (copy SQL above to a file first)
psql -h db.${SUPABASE_PROJECT_ID}.supabase.co \
     -U postgres \
     -d postgres \
     -c "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS shield_enabled BOOLEAN DEFAULT FALSE NOT NULL, ADD COLUMN IF NOT EXISTS shield_disabled_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS shield_disabled_reason TEXT;"

# Verify
psql -h db.${SUPABASE_PROJECT_ID}.supabase.co \
     -U postgres \
     -d postgres \
     -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'organizations' AND column_name LIKE 'shield%';"
```

---

## After Applying Migration

### 1. Verify Schema

Run tests to confirm schema is correct:

```bash
npm test -- tests/integration/toggle-endpoints.test.js --testNamePattern="shield"
```

**Expected:** All 7 shield toggle tests should pass ✅

### 2. Run Full Toggle Tests

```bash
npm test -- tests/integration/toggle-endpoints.test.js
```

**Expected:** All 20 tests (roasting + shield) should pass ✅

---

## Status Tracking

- [x] Problem identified (missing shield columns on organizations)
- [x] `schema.sql` updated with shield columns
- [x] Migration SQL created
- [x] Instructions documented
- [ ] **Shield columns applied to Supabase** ⬅️ **ACTION REQUIRED**
- [ ] Tests verified passing
- [ ] Continue with remaining integration tests

---

## Next Steps

1. **Apply Shield migration SQL** using one of the options above
2. Verify schema with verification query
3. Run shield toggle tests
4. If successful, continue with remaining ~30 integration tests
5. Document all changes

---

## Questions?

- **Schema file:** `database/schema.sql` (lines 147-150)
- **Endpoint:** `src/routes/shield.js:734`
- **Test file:** `tests/integration/toggle-endpoints.test.js`
- **Related Issues:** #362 (Shield System), #1022 (Test Failures)

---

**Last Updated:** 2025-11-26
**Author:** Claude Code (AI Agent)
**Issue Tracker:** https://github.com/roastr-ai/roastr-ai/issues/1022
