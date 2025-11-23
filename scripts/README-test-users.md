# Test Users Setup for Issue #237

This directory contains scripts to set up admin and test users for backoffice development.

## Overview

As per Issue #237, this setup creates:

- **1 Admin user**: `emiliopostigo@gmail.com` with admin privileges
- **6 Test users** with different plans and usage patterns
- **Realistic social media integrations** for paid users
- **Usage data and activity logs** for testing

## Quick Start

```bash
# Preview what will be created (recommended first)
npm run setup:test-users:dry

# Execute the setup
npm run setup:test-users
```

## What Gets Created

### 👤 Admin User

- **Email**: `emiliopostigo@gmail.com`
- **Plan**: Creator Plus
- **Role**: Admin (`is_admin = true`)
- **Purpose**: Access to backoffice panel

### 🧪 Test Users

| Email                    | Plan         | Usage Pattern          | Integrations                            | Purpose                     |
| ------------------------ | ------------ | ---------------------- | --------------------------------------- | --------------------------- |
| `test.free@roastr.ai`    | Free         | 0% (no usage)          | None                                    | Test free plan limits       |
| `test.starter@roastr.ai` | Pro          | 3% usage (30/1000)     | Twitter                                 | Test low usage pro user     |
| `test.pro@roastr.ai`     | Pro          | 80% usage (800/1000)   | Twitter + YouTube                       | Test high usage pro user    |
| `test.plus@roastr.ai`    | Creator Plus | 50% usage (2500/5000)  | Twitter + Instagram                     | Test moderate creator usage |
| `test.heavy@roastr.ai`   | Creator Plus | 100% usage (5000/5000) | Twitter + YouTube + Instagram + Discord | Test limit-reached user     |
| `test.empty@roastr.ai`   | Free         | 0% (inactive)          | None                                    | Test inactive user          |

### 🔗 Social Media Integrations

**Realistic handles created for testing**:

- Twitter: `@test_starter`, `@test_pro_user`, `@test_plus_creator`, `@test_heavy_user`
- YouTube: `UCTestProChannel`, `UCTestHeavyChannel`
- Instagram: `test_plus_creator`, `test_heavy_creator`
- Discord: Server with test bot integration

### 📊 Data Created

- **Organizations**: Auto-created for each user
- **User Subscriptions**: Matching their plans
- **Monthly Usage**: Realistic usage patterns
- **Activity Logs**: Login and message sending activities
- **Usage Records**: Platform-specific usage tracking

## File Structure

```
scripts/
├── setup-test-users.js          # Main setup script (Node.js)
├── setup-test-users.sql         # SQL commands for data creation
└── README-test-users.md         # This documentation

database/migrations/
└── 015_add_test_flag_to_users.sql # Migration to add test flag
```

## Plan Mapping

The issue mentioned plans differ from the current system:

| Issue Plan | Actual Plan       | Monthly Limit | Features                 |
| ---------- | ----------------- | ------------- | ------------------------ |
| Free       | `free`            | 100           | Basic integrations       |
| Starter    | `pro` (low usage) | 1000          | Shield mode, analytics   |
| Pro        | `pro`             | 1000          | Shield mode, analytics   |
| Plus       | `creator_plus`    | 5000          | Custom tones, API access |

## Environment Requirements

Ensure these environment variables are set:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Service role key for admin operations

## Testing & Cleanup

### Verify Setup

After running the script, verify in your database:

```sql
-- Check admin user
SELECT email, name, plan, is_admin, is_test FROM users
WHERE email = 'emiliopostigo@gmail.com';

-- Check test users
SELECT email, plan, monthly_messages_sent, is_test FROM users
WHERE is_test = true ORDER BY email;

-- Check organizations
SELECT o.name, o.plan_id, o.monthly_responses_used, u.email
FROM organizations o
JOIN users u ON u.id = o.owner_id
WHERE u.is_test = true;
```

### Cleanup Test Data

When you're done testing, clean up with:

```sql
-- Remove all test users and their related data
DELETE FROM users WHERE is_test = true;
-- Organizations, integrations, and usage records will be cascade-deleted
```

## Backoffice Integration

These test users enable testing of:

- **User filtering** by plan, usage, activity
- **Plan change operations**
- **Usage limit visualization**
- **Integration management**
- **Admin navigation and permissions**

## Support

For issues with this setup:

1. Check environment variables are set correctly
2. Verify database connection and permissions
3. Run with `--dry-run` first to preview changes
4. Check Supabase logs for any RLS policy issues

---

**Issue #237 Requirements ✅**

- Admin user for backoffice access
- Multiple test users with varied patterns
- Platform integrations for paid users
- Usage tracking and limits
- Easy cleanup with test flag
