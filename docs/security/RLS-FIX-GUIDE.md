# RLS Security Fix Guide

**Issue:** Supabase security alert - RLS disabled on 3 public schema tables  
**Severity:** 🔴 HIGH - Tables exposed without access control  
**Created:** 2025-12-02  
**Status:** ✅ FIXED (pending migration)

---

## 🚨 Problem

Supabase detected **3 tables without Row Level Security (RLS)** enabled:

| Table                    | Risk      | Impact                                  |
| ------------------------ | --------- | --------------------------------------- |
| `public.plans`           | 🟡 Medium | Plan data readable/writable by anyone   |
| `public.user_activities` | 🔴 HIGH   | User activity logs exposed (audit data) |
| `public.roast_tones`     | 🟡 Medium | Tone configuration modifiable by anyone |

**Why this is critical:**

- ❌ Any authenticated user can read/modify these tables
- ❌ Sensitive audit data (user_activities) is exposed
- ❌ System configuration (plans, tones) can be tampered with
- ❌ Violates principle of least privilege

---

## ✅ Solution

### Migration Created

**File:** `database/migrations/057_enable_rls_missing_tables.sql`

**What it does:**

1. ✅ Enables RLS on all 3 tables
2. ✅ Creates appropriate policies for each table
3. ✅ Grants necessary permissions
4. ✅ Includes verification checks

### Policy Summary

#### 📋 `plans` Table

- **Read:** Everyone (needed for plan selection UI)
- **Write:** Admins only
- **Rationale:** Plans are public info, but only admins manage them

#### 📊 `user_activities` Table

- **Read:** Admins only (sensitive audit data)
- **Insert:** Users can log their own activities, admins can log any
- **Update/Delete:** Admins only
- **Rationale:** Audit logs must be protected

#### 🎨 `roast_tones` Table

- **Read:** Everyone (needed for tone selection in roast generation)
- **Write:** Admins only
- **Rationale:** Tones are public config, but only admins modify them

---

## 📝 How to Apply

⚠️ **IMPORTANT:** Always test migrations in staging/dev environment before applying to production.

### Option 1: Supabase CLI (Recommended)

```bash
# 1. Login to Supabase
npx supabase login

# 2. Link to your project
npx supabase link --project-ref YOUR_PROJECT_REF

# 3. Apply migration
npx supabase db push

# 4. Verify
npm run verify:rls
```

### Option 2: Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Open file: `database/migrations/057_enable_rls_missing_tables.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click "Run"
6. Verify success message in console

### Option 3: Direct psql (Advanced)

```bash
# Connect to your database
psql $DATABASE_URL

# Run migration
\i database/migrations/057_enable_rls_missing_tables.sql

# Verify
\dt+ plans user_activities roast_tones
```

---

## 🧪 Verification

### Automated Check

```bash
npm run verify:rls
```

**Expected output:**

```
✅ plans: RLS enabled (4 policies)
✅ user_activities: RLS enabled (4 policies)
✅ roast_tones: RLS enabled (4 policies)
✅ ALL RLS CHECKS PASSED
```

### Manual Check (Supabase Dashboard)

1. Go to: **Database → Tables**
2. Click each table:
   - `plans`
   - `user_activities`
   - `roast_tones`
3. Verify **"RLS enabled"** badge is visible
4. Go to **Policies** tab
5. Verify policies exist:
   - Select (read)
   - Insert
   - Update
   - Delete

---

## 🔍 Testing After Migration

### Test 1: Public Read Access (plans, roast_tones)

```javascript
// Should work: Read plans as authenticated user
const { data, error } = await supabase.from('plans').select('*');
// ✅ Expected: Returns all plans

// Should work: Read roast_tones as authenticated user
const { data, error } = await supabase.from('roast_tones').select('*');
// ✅ Expected: Returns all tones
```

### Test 2: Admin-Only Write Access

```javascript
// Should fail: Non-admin tries to modify plan
const { data, error } = await supabase
  .from('plans')
  .update({ monthly_price_cents: 0 })
  .eq('id', 'pro');
// ❌ Expected: Policy violation error

// Should work: Admin modifies plan
// (When logged in as admin with is_admin=true)
const { data, error } = await supabase
  .from('plans')
  .update({ monthly_price_cents: 2900 })
  .eq('id', 'pro');
// ✅ Expected: Update succeeds
```

### Test 3: User Activities Protection

```javascript
// Should fail: Non-admin tries to read user activities
const { data, error } = await supabase.from('user_activities').select('*');
// ❌ Expected: Policy violation error (unless you're admin)

// Should work: User logs their own activity
const { data, error } = await supabase.from('user_activities').insert({
  user_id: currentUser.id,
  activity_type: 'login',
  platform: 'web'
});
// ✅ Expected: Insert succeeds
```

---

## 🛡️ Security Best Practices

### ✅ DO

- Always enable RLS on tables in `public` schema
- Create explicit policies for each operation (SELECT, INSERT, UPDATE, DELETE)
- Use `auth.uid()` to check current user
- Verify user roles (is_admin, active) in policies
- Test policies with different user roles

### ❌ DON'T

- Don't use `USING (true)` for sensitive data (audit logs)
- Don't grant blanket permissions without RLS
- Don't mix service role and authenticated role permissions
- Don't forget to test policies after creation

---

## 📊 Impact Assessment

### Before Fix

- 🔴 **Risk:** HIGH
- ❌ 3 tables unprotected
- ❌ Audit data exposed
- ❌ System config tamperable

### After Fix

- 🟢 **Risk:** LOW
- ✅ All tables protected by RLS
- ✅ Audit data restricted to admins
- ✅ System config read-only for users
- ✅ Follows least privilege principle

---

## 🔗 Related Documentation

- **Supabase RLS Guide:** https://supabase.com/docs/guides/auth/row-level-security
- **PostgreSQL RLS:** https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- **Multi-Tenant RLS:** `docs/nodes/multi-tenant.md`
- **Database Schema:** `database/schema.sql`

---

## 🆘 Troubleshooting

### Issue: Migration fails with "policy already exists"

**Solution:**

```sql
-- Drop existing policies first
DROP POLICY IF EXISTS plans_read_policy ON plans;
DROP POLICY IF EXISTS plans_insert_policy ON plans;
-- ... (repeat for all policies)

-- Then re-run migration
```

### Issue: "permission denied" after enabling RLS

**Cause:** Missing GRANT statements  
**Solution:** Ensure migration includes:

```sql
GRANT SELECT ON plans TO authenticated;
GRANT ALL ON plans TO service_role;
```

### Issue: Service role cannot bypass RLS

**Cause:** Service role should always bypass RLS  
**Solution:** Verify you're using `SUPABASE_SERVICE_KEY`, not `SUPABASE_ANON_KEY` for backend operations

---

## 📅 Timeline

- **2025-12-02:** Issue detected (Supabase alert email)
- **2025-12-02:** Migration created (`057_enable_rls_missing_tables.sql`)
- **2025-12-02:** Verification script added (`verify-rls-security.js`)
- **Pending:** Migration deployment to production

---

## ✅ Checklist

- [ ] Review migration: `database/migrations/057_enable_rls_missing_tables.sql`
- [ ] Test migration in local environment
- [ ] Apply migration to staging
- [ ] Verify RLS with `npm run verify:rls`
- [ ] Test user permissions manually
- [ ] Apply migration to production
- [ ] Monitor logs for permission errors
- [ ] Reply to Supabase security email with fix confirmation

---

**Status:** ✅ Ready to deploy  
**Reviewed by:** Cursor AI  
**Approved by:** [Pending]  
**Deployed:** [Pending]
