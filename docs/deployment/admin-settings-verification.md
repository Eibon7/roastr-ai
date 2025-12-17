# Admin Settings Verification

## Overview

The admin settings verification is part of the generic infrastructure prerequisites verifier (`scripts/verify-infra-prerequisites.js`). This check ensures that the `admin_settings` table exists and is correctly configured in Supabase.

## Current Status

Currently, the infrastructure prerequisites verifier only validates the `admin_settings` table. Additional prerequisite checks may be added in the future as needed.

## What is Verified

The `admin_settings` check verifies:

1. **Table Existence**: The `admin_settings` table exists in Supabase
2. **Column Structure**: All expected columns are present:
   - `key` (text, primary key)
   - `value` (jsonb)
   - `created_at` (timestamp with time zone)
   - `updated_at` (timestamp with time zone)
3. **RLS Enabled**: Row Level Security is enabled on the table
4. **Policies Exist**: Required RLS policies for service_role access are present

## Usage

### Manual Verification

Run the verification script locally:

```bash
node scripts/verify-infra-prerequisites.js
```

### CI Integration

The verification runs automatically in CI on:
- Pull requests to `main`
- Manual workflow dispatch

The CI workflow is located at `.github/workflows/verify-infra-prerequisites.yml`.

## Important Notes

- **Read-Only**: This verification is read-only and does NOT modify the database
- **No Migrations**: The script does NOT apply migrations automatically
- **Manual Migration Required**: If the table does not exist, the migration must be applied manually via:
  - Supabase Dashboard
  - Supabase CLI
  - See: `database/migrations/031_create_admin_settings.sql`

## Related

- Issue: ROA-268
- Migration: `database/migrations/031_create_admin_settings.sql`
- Script: `scripts/verify-infra-prerequisites.js`
- Check Implementation: `scripts/infra-checks/admin-settings.check.js`
