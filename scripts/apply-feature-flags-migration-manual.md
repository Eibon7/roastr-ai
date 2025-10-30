# Apply Feature Flags Migration

**Migration:** `database/migrations/add_feature_flags_and_audit_system.sql`

## Option 1: Via Supabase Dashboard (Recommended - 2 minutes)

1. Go to: https://supabase.com/dashboard/project/rpkhiemljhncddmhrilk/sql/new

2. Copy the entire SQL from: `database/migrations/add_feature_flags_and_audit_system.sql`

3. Paste into the SQL Editor

4. Click "Run" (bottom right)

5. Verify success:
   ```sql
   SELECT COUNT(*) FROM feature_flags;
   -- Should return ~20 rows
   ```

## Option 2: Via Node.js Script (Alternative)

```bash
node scripts/apply-feature-flags-via-api.js
```

## What this migration creates:

- `feature_flags` table: Dynamic feature management
- `admin_audit_logs` table: Track admin actions
- Initial feature flags (20 entries):
  - Kill switches (KILL_SWITCH_AUTOPOST)
  - Platform autopost controls (AUTOPOST_TWITTER, etc.)
  - UI features toggles
  - Safety features

## After applying:

```bash
# Restart server
npm run dev

# You should see:
# ✅ Kill switch cache refreshed { flagsCount: 20 }
# (instead of the warning)
```
