# Kill Switch Migration Pending

**Status:** ⚠️ Pendiente aplicación manual
**Priority:** P2 (Non-blocking for MVP)
**Issue:** #294

## Current State

✅ **Backend code ready:**

- Kill switch service funciona con graceful degradation
- Si la tabla `feature_flags` no existe, el servidor arranca correctamente
- Muestra warning claro: `⚠️ Kill switch table not found - feature disabled until migration applied`
- Defaults seguros: autopost deshabilitado por defecto

❌ **Database migration not applied:**

- Tabla `feature_flags` no existe en Supabase
- Migración: `database/migrations/add_feature_flags_and_audit_system.sql`
- 20 feature flags iniciales pendientes de crear

## Impact

**Sin impacto en flujos core MVP:**

- ✅ Signup/Login funcionan
- ✅ Roast generation funciona
- ✅ Analysis funciona
- ✅ Todos los flujos críticos operativos

**Funcionalidad deshabilitada:**

- ❌ Kill switch global (emergency stop)
- ❌ Feature flags dinámicos (admin panel)
- ❌ Audit logs de acciones admin
- ❌ Control granular de autopost por plataforma

## How to Apply Migration

### Option 1: Manual (Recommended - 2 minutes)

```bash
# 1. Run helper script for instructions
node scripts/apply-feature-flags-via-api.js

# 2. Follow the URL provided:
https://supabase.com/dashboard/project/rpkhiemljhncddmhrilk/sql/new

# 3. Copy SQL from:
database/migrations/add_feature_flags_and_audit_system.sql

# 4. Paste and Run

# 5. Verify:
SELECT COUNT(*) FROM feature_flags;
-- Should return ~20 rows
```

### Option 2: CLI (if supabase CLI installed)

```bash
supabase db push
# or
supabase migration apply add_feature_flags_and_audit_system
```

## After Migration Applied

```bash
# Restart server
npm run dev

# Expected output:
[INFO] Kill switch cache refreshed { flagsCount: 20, killSwitchActive: false }
✅ Kill switch service initialized

# Test endpoints:
GET /api/admin/feature-flags        # List all flags
POST /api/admin/feature-flags/:key  # Update flag
GET /api/admin/audit-logs           # View admin actions
```

## Files Modified

**Fix applied (2025-10-26):**

```
src/middleware/killSwitch.js
  - Added graceful degradation for missing table
  - Safe defaults when table doesn't exist
  - Clear warning message with migration path
```

**Documentation:**

```
scripts/apply-feature-flags-via-api.js         # Helper script
scripts/apply-feature-flags-migration-manual.md  # Manual instructions
docs/deployment/kill-switch-migration-pending.md # This file
```

## Testing Checklist (After Migration)

- [ ] Server starts without warnings
- [ ] `SELECT * FROM feature_flags LIMIT 5` returns data
- [ ] Admin panel shows feature flags UI
- [ ] Toggle KILL_SWITCH_AUTOPOST flag works
- [ ] Audit logs record admin actions
- [ ] Platform-specific autopost flags functional

## Related Issues

- Issue #294: Kill Switch global y panel de control
- GDD Node: `docs/nodes/admin.md`

---

**Last Updated:** 2025-10-26
**Status:** Backend ready, migration pending manual application
