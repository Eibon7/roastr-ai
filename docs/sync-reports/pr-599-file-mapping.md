# PR #599 - File Mapping Analysis

**PR:** #599 - Complete Login & Registration Flow
**Branch:** `feat/complete-login-registration-593`
**Base:** origin/main
**Total Files Changed:** 160

---

## File Categories

### 1. Source Code (src/) - 9 files

**Modified:**
- `src/services/costControl.js`
- `src/services/embeddingsService.js`
- `src/services/gatekeeperService.js`
- `src/services/modelAvailabilityService.js`
- `src/services/roastGeneratorReal.js`
- `src/workers/AnalyzeToxicityWorker.js`
- `src/workers/GenerateReplyWorker.js`
- `src/adapters/mock/DiscordShieldAdapter.js`
- `src/adapters/mock/TwitchShieldAdapter.js`
- `src/adapters/mock/TwitterShieldAdapter.js`
- `src/adapters/mock/YouTubeShieldAdapter.js`

**GDD Nodes Affected:**
- `docs/nodes/cost-control.md` (costControl.js)
- `docs/nodes/roast.md` (embeddingsService, roastGeneratorReal)
- `docs/nodes/guardian.md` (gatekeeperService, Shield adapters)
- `docs/nodes/queue-system.md` (workers)
- `docs/nodes/observability.md` (modelAvailabilityService)

### 2. Tests (tests/) - 3 files

**Modified:**
- `tests/e2e/auth-complete-flow.test.js` (NEW)
- `tests/unit/services/costControl.test.js`
- `tests/helpers/tenantTestUtils.js`

**GDD Nodes Affected:**
- `docs/nodes/multi-tenant.md` (tenantTestUtils)
- `docs/nodes/cost-control.md` (costControl.test.js)
- Testing coverage: auth flow E2E tests

### 3. Frontend (frontend/) - 2 files

**Modified:**
- `frontend/src/pages/auth/Login.jsx`
- `frontend/src/pages/auth/Register.jsx`

**GDD Nodes Affected:**
- Authentication/Auth flows (no specific GDD node yet - needs creation?)

### 4. Scripts (scripts/) - 14 files

**Modified:**
- `scripts/auto-repair-gdd.js`
- `scripts/deploy-supabase-schema.js`
- `scripts/predict-gdd-drift.js`
- `scripts/test-posts-table.js`
- `scripts/test-supabase-connection.js`
- `scripts/test-user-insert-minimal.js`
- `scripts/verify-openai-api.js`
- `scripts/verify-perspective-api.js`
- `scripts/verify-rls-policies.js`
- `scripts/verify-supabase-tables.js`
- `scripts/verify-twitter-api.js`
- `scripts/verify-youtube-api.js`

**GDD Nodes Affected:**
- `docs/nodes/observability.md` (verification scripts)
- `docs/nodes/multi-tenant.md` (RLS verification)
- `docs/nodes/social-platforms.md` (Twitter, YouTube verification)
- GDD infrastructure (auto-repair, drift prediction)

### 5. Database/Supabase (database/, supabase/) - 9 files

**Modified:**
- `database/add-missing-tables.sql`
- `supabase/.gitignore`
- `supabase/config.toml`
- `supabase/migrations/20251016000001_add_test_tables.sql`
- `supabase/migrations/20251016000002_fix_rls_policies.sql`
- `supabase/migrations/20251017000001_force_fix_rls.sql`
- `supabase/migrations/20251017000002_simple_rls.sql`
- `supabase/migrations/20251017070646_remote_schema.sql`

**GDD Nodes Affected:**
- `docs/nodes/multi-tenant.md` (RLS policies, schema)
- Database schema documentation

### 6. Documentation (docs/) - ~120 files

**Categories:**
- `docs/plan/*.md` - 15+ files (review plans, issue plans)
- `docs/test-evidence/*.md` - 20+ files (test results, summaries)
- `docs/nodes/*.md` - 11 files (GDD nodes updated)
- `docs/flows/*.md` - 6 files (NEW flow documentation)
- `docs/issues/*.md` - 6 files (NEW issue documentation)
- `docs/guardian/cases/*.json` - 20+ files (guardian audit logs)
- `docs/patterns/coderabbit-lessons.md`
- `docs/MVP-VALIDATION-PLAN.md`
- `docs/SUPABASE-JWT-SETUP.md`
- `docs/drift-report.md`
- `docs/auto-repair-changelog.md`
- `docs/auto-repair-report.md`

**GDD Nodes Documentation:**
- All 11 GDD nodes updated with latest info

### 7. CI/CD & Config (.github/, root) - 15+ files

**Modified:**
- `.github/workflows/agent-receipts.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/e2e-tests.yml`
- `.github/workflows/frontend-build-check.yml`
- `.github/workflows/gdd-*.yml` (multiple)
- `.github/workflows/guardian-check.yml`
- `.github/workflows/integration-tests.yml`
- `.github/workflows/runner-json-demo.yml`
- `.github/workflows/spec14-qa-test-suite.yml`
- `.github/workflows/stripe-validation.yml`
- `CLAUDE.md`

**GDD Nodes Affected:**
- `docs/nodes/observability.md` (CI/CD monitoring)
- Project configuration

### 8. Manual Testing (root) - 1 file

**Modified:**
- `manual-test-auth.sh` (NEW)

**GDD Nodes Affected:**
- Testing infrastructure

---

## GDD Nodes Mapping Summary

### Primary Nodes (Direct Changes)

| Node | Files Changed | Change Type |
|------|---------------|-------------|
| `cost-control.md` | costControl.js, costControl.test.js | Modified |
| `guardian.md` | gatekeeperService.js, Shield adapters | Modified |
| `roast.md` | embeddingsService.js, roastGeneratorReal.js | Modified |
| `queue-system.md` | Workers (Analyze, Generate) | Modified |
| `observability.md` | modelAvailabilityService.js, verify scripts, CI/CD | Modified |
| `multi-tenant.md` | tenantTestUtils.js, RLS policies, migrations | Modified |
| `social-platforms.md` | Twitter/YouTube verification scripts | Modified |

### Secondary Nodes (Transitive Dependencies)

| Node | Reason for Update |
|------|-------------------|
| `platform-constraints.md` | Auth flow changes may affect constraints |
| `persona.md` | User registration affects persona setup |
| `tone.md` | May be affected by auth flow |
| `trainer.md` | May be affected by new test patterns |

### Missing Nodes

| Area | Suggested Node | Status |
|------|----------------|--------|
| Authentication | `docs/nodes/authentication.md` | ❌ Does not exist |
| Frontend | `docs/nodes/frontend.md` | ❌ Does not exist |
| Database Migrations | `docs/nodes/database.md` | ❌ Does not exist |

---

## Dependency Analysis

### Direct Dependencies (nodes that use changed code)

```
cost-control.md → roast.md (cost tracking for generation)
multi-tenant.md → cost-control.md (per-tenant cost tracking)
queue-system.md → roast.md (roast generation via queue)
guardian.md → social-platforms.md (platform-specific moderation)
observability.md → ALL (monitoring all services)
```

### Reverse Dependencies (nodes that are used by changed code)

```
roast.md ← cost-control.md (called before generation)
social-platforms.md ← guardian.md (platform adapters used by shield)
multi-tenant.md ← queue-system.md (tenant-scoped jobs)
```

---

## Files Requiring Node Creation

1. **Authentication Flow**
   - Files: `frontend/src/pages/auth/*.jsx`, `tests/e2e/auth-complete-flow.test.js`
   - Suggested node: `docs/nodes/authentication.md`
   - Priority: HIGH

2. **Frontend Architecture**
   - Files: `frontend/src/**/*.jsx`
   - Suggested node: `docs/nodes/frontend.md`
   - Priority: MEDIUM

3. **Database Schema**
   - Files: `database/**/*.sql`, `supabase/migrations/*.sql`
   - Suggested node: `docs/nodes/database.md`
   - Priority: MEDIUM

---

## Next Steps (FASE 2)

### Nodes to Synchronize (11 existing)

1. ✅ `docs/nodes/cost-control.md` - Update: testing, coverage, last_updated
2. ✅ `docs/nodes/guardian.md` - Update: adapters, testing, coverage
3. ✅ `docs/nodes/roast.md` - Update: services, testing, coverage
4. ✅ `docs/nodes/queue-system.md` - Update: workers, testing, coverage
5. ✅ `docs/nodes/observability.md` - Update: scripts, CI/CD, coverage
6. ✅ `docs/nodes/multi-tenant.md` - Update: RLS, migrations, testing
7. ✅ `docs/nodes/social-platforms.md` - Update: verification scripts
8. ⏳ `docs/nodes/platform-constraints.md` - Review: May need auth constraints
9. ⏳ `docs/nodes/persona.md` - Review: May need registration flow updates
10. ⏳ `docs/nodes/tone.md` - Review: Check dependencies
11. ⏳ `docs/nodes/trainer.md` - Review: Check test pattern updates

### Nodes to Create (3 missing)

1. ❌ `docs/nodes/authentication.md` - Create issue: Missing authentication node
2. ❌ `docs/nodes/frontend.md` - Create issue: Missing frontend node
3. ❌ `docs/nodes/database.md` - Create issue: Missing database node

---

**Analysis Complete:** Ready for FASE 2 (Node Synchronization)
