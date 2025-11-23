# Issue #868 - Complete Cleanup Plan

## Estado Actual (Commit 5baa8f59)

✅ Completado: 18-25 referencias eliminadas
❌ Pendiente: 55+ referencias en production

---

## FASE 1: Workers & Core Routes (CRÍTICO) ⚠️

### 1.1 Workers (8 archivos)

- [ ] `src/workers/GenerateReplyWorker.js` (8 humor_type, 1 intensity) - **PRIORITY 1**

### 1.2 Routes Core (6 archivos)

- [ ] `src/routes/user.js` - User config
- [ ] `src/routes/approval.js` - Approval system
- [ ] `src/routes/analytics.js` - Analytics
- [ ] `src/routes/oauth.js` - OAuth flow
- [ ] `src/routes/config.js` - Config management

### 1.3 Lib & Services (2 archivos)

- [ ] `src/lib/prompts/roastPrompt.js` - Prompt builder
- [ ] `src/services/rqcService.js` - Quality control

---

## FASE 2: Integrations (5 archivos)

- [ ] `src/integrations/base/BaseIntegration.js` - Base class
- [ ] `src/integrations/discord/discordService.js`
- [ ] `src/integrations/twitch/twitchService.js`
- [ ] `src/services/twitter.js` (verification)
- [ ] `src/config/integrations.js`

---

## FASE 3: Database Migrations (3 archivos)

- [ ] `database/migrations/XXXX_remove_free_plan.sql`
- [ ] `database/migrations/XXXX_remove_humor_type_column.sql`
- [ ] `database/migrations/XXXX_remove_intensity_level_column.sql`

---

## FASE 4: Frontend (4 archivos críticos)

- [ ] `frontend/src/pages/Settings.jsx` - Settings UI
- [ ] `frontend/src/pages/Configuration.jsx` - Config UI
- [ ] `frontend/src/components/StyleSelector.jsx` - Style selector
- [ ] `frontend/src/pages/Approval.jsx` - Approval UI

---

## FASE 5: Tests Update (Selective)

### 5.1 Critical Tests (8 archivos)

- [ ] `tests/unit/workers/GenerateReplyWorker.test.js`
- [ ] `tests/unit/routes/roast.test.js`
- [ ] `tests/unit/routes/user.test.js`
- [ ] `tests/unit/routes/approval.test.js`
- [ ] `tests/unit/services/roastPromptTemplate.test.js`
- [ ] `tests/unit/lib/prompts/roastPrompt.test.js`
- [ ] `tests/integration/roast.test.js`
- [ ] `tests/integration/complete-roast-flow.test.js`

### 5.2 Integration Tests (Mark as deprecated/skip)

- Resto de tests con referencias obsoletas

---

## FASE 6: Verification & Cleanup

- [ ] Ejecutar búsqueda final: `grep -r "humor_type\|humorType" src/`
- [ ] Ejecutar búsqueda final: `grep -r "intensity_level\|intensityLevel" src/`
- [ ] Verificar frontend: `grep -r "humorType" frontend/src/`
- [ ] Tests pasando: `npm test`
- [ ] Linter pasando: `npm run lint`

---

## Commits Planeados

1. `refactor(workers): Remove humor_type/intensity from GenerateReplyWorker` (FASE 1.1)
2. `refactor(routes): Clean humor_type from user/approval/analytics` (FASE 1.2)
3. `refactor(services): Clean prompts and integrations` (FASE 1.3 + FASE 2)
4. `feat(migrations): Add DB migrations to remove deprecated columns` (FASE 3)
5. `refactor(frontend): Remove humor_type/intensity from UI` (FASE 4)
6. `test: Update tests for removed configs` (FASE 5)
7. `docs: Update documentation and verify cleanup` (FASE 6)

---

## Estimación de Tiempo

- FASE 1: ~30-45 min (crítico)
- FASE 2: ~20 min
- FASE 3: ~15 min (migrations)
- FASE 4: ~30 min (frontend)
- FASE 5: ~45 min (tests)
- FASE 6: ~15 min (verification)

**Total:** ~2.5-3 horas de trabajo continuo

---

## Criterio de Éxito

✅ 0 referencias a `humor_type`/`humorType` en `src/`
✅ 0 referencias a `intensity_level`/`intensityLevel` en `src/`
✅ 0 referencias en frontend crítico
✅ Migraciones DB creadas
✅ Tests críticos actualizados y pasando
✅ CI/CD passing

---

**Status:** IN PROGRESS
**Started:** 2025-11-18
**Current Phase:** FASE 1.1 (Workers)
