# Issue #1022: Migration Instructions

## 🔴 BLOCKER: Migration 030 Not Applied

**Issue:** Admin Tones integration tests fail because `roast_tones` table does not exist.

**Root Cause:**
- Migration `030_roast_tones_table.sql` has not been applied to the Supabase database
- Error: `relation "public.roast_tones" does not exist` (PostgreSQL error code 42P01)

**Discovered:** 2025-11-27 during Issue #1022 implementation

---

## ✅ Solution: Apply Migration 030

### Option 1: Supabase SQL Editor (Recommended)

1. **Open SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/rpkhiemljhncddmhrilk/sql/new

2. **Copy Migration SQL:**
   - Open file: `database/migrations/030_roast_tones_table.sql`
   - Copy entire contents (331 lines)

3. **Execute:**
   - Paste into SQL editor
   - Click "Run" button
   - Wait for confirmation

4. **Verify:**
   ```sql
   SELECT table_name, column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'roast_tones'
   ORDER BY ordinal_position;
   ```

   Expected: ~17 columns including `id`, `name`, `display_name`, `description`, `intensity`, etc.

### Option 2: Run Helper Script

```bash
# Display migration SQL and instructions
node scripts/apply-migration-030.js

# Then copy/paste SQL into Supabase SQL Editor
```

---

## 📊 Migration Details

**File:** `database/migrations/030_roast_tones_table.sql`
**Issue:** #876 - Dynamic Roast Tone Configuration System
**Created:** 2025-11-18
**Size:** 331 lines, 12,129 bytes

**Creates:**
- Table: `roast_tones` (17 columns)
- Indexes: 4 (active, sort_order, default, name)
- Triggers: 2 (ensure_at_least_one_active_tone, update_timestamp)
- Functions: 2 (ensure_at_least_one_active_tone, update_roast_tones_updated_at)

---

## 🔄 After Migration is Applied

**Re-run tests:**
```bash
npm test -- tests/integration/api/admin/tones.test.js
```

**Expected Result:** 19/19 tests passing (all green)

---

## 📝 Notes

- **Why not psql?** Direct PostgreSQL connections to Supabase are blocked for security
- **Why not automated?** Supabase JS client cannot execute raw DDL SQL
- **When to apply?** Before running any tests that depend on `roast_tones` table
- **Safe to re-run?** Yes - migration uses `CREATE TABLE IF NOT EXISTS`

---

**Related Files:**
- Migration: `database/migrations/030_roast_tones_table.sql`
- Test: `tests/integration/api/admin/tones.test.js`
- Routes: `src/routes/admin/tones.js`

**Status:** 🔴 PENDING - Waiting for migration to be applied
