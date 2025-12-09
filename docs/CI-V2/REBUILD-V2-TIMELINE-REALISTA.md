# Rebuild v2 desde Spec: Timeline Realista (10-12 días)

**Fecha:** 2025-12-09  
**Contexto:** v1 está roto (tests, UI, features incorrectas)  
**Objetivo:** Reconstruir Roastr según `SSOT-V2.md` y `system-map-v2.yaml`  
**Ritmo:** IA full-time (8-12h efectivas/día)

---

## 📊 Resumen Ejecutivo

**Veredicto:** ⚠️ **MUY ARRIESGADO EN 10 DÍAS, VIABLE EN 12-15**

El problema es que no es "migrar documentación", sino:

1. **Reconstruir backend** - Nuevo código siguiendo SSOT v2
2. **Reconstruir frontend** - UI coherente con shadcn/ui
3. **Tests desde cero** - Suite completa funcional
4. **Migrar datos** - De esquema v1 a v2
5. **Deprecar v1** - Sin romper producción si existe

**Complejidad real:**
- ~15 componentes core a construir desde cero
- ~50-80 endpoints API nuevos
- Suite de tests completa (unit + integration + E2E)
- UI completa (6+ vistas principales)
- Polar billing integration (desde cero)
- Worker system refactor completo

**Esfuerzo estimado:** 150-200 horas de trabajo efectivo  
**Timeline realista:** 15-20 días con IA  
**Timeline agresivo:** 12 días (scope mínimo MVP)

---

## 🔍 Análisis del Scope Real

### ✅ Lo que SÍ existe y funciona

**Documentación v2 (ROA-318):**
- ✅ SSOT-V2.md completo (~2000 líneas)
- ✅ system-map-v2.yaml con 15 nodos
- ✅ 16 archivos de nodos-v2/ con specs detalladas
- ✅ Scripts de validación v2 funcionando
- ✅ Reglas de desarrollo v2

**Infrastructure parcial:**
- ✅ Supabase setup (DB, Auth, RLS)
- ✅ OpenAI integration básica
- ✅ Redis/Upstash setup
- ✅ Vercel deployment config

### ❌ Lo que NO existe o está roto en v1

**Backend roto/obsoleto:**
- ❌ **Roast Engine** - Usa prompts v1, modelos incorrectos, no sigue SSOT
- ❌ **Shield Service** - 6/15 tests fallando, lógica incompleta
- ❌ **Billing** - Stripe (legacy), Polar no implementado
- ❌ **Credits System** - v2 diseñado pero no activo
- ❌ **Workers** - Lógica mixta v1/v2, tests failing
- ❌ **Queue System** - Flaky tests, timing issues
- ❌ **Auth** - OAuth test pollution, session issues
- ❌ **Platform Integrations** - 9 plataformas pero código legacy

**Frontend roto/obsoleto:**
- ❌ **UI inconsistente** - Mix de estilos, no sigue design system
- ❌ **Dashboard** - Widgets rotos, datos incorrectos
- ❌ **Billing UI** - Stripe hardcoded, no sigue v2 plans
- ❌ **Settings** - Persona config rota, tono personal missing
- ❌ **Admin Panel** - Features que no deberían existir
- ❌ **Onboarding** - Flow incompleto

**Tests rotos:**
- ❌ **178 test suites failing** (según analysis)
- ❌ **Coverage 1.48%** (prácticamente 0)
- ❌ **Flaky tests** - Timing issues, async problems
- ❌ **Test infrastructure** - Mocks no alineados con implementación

**Features incorrectas (fuera de spec v2):**
- ❌ Plan "free" (no existe en v2, solo starter/pro/plus)
- ❌ Plan "basic" (legacy)
- ❌ Plan "creator_plus" (legacy)
- ❌ Features admin que no están en spec
- ❌ Funcionalidades de analytics no especificadas

---

## 🎯 Scope Rebuild v2 (según SSOT-V2.md)

### Backend Core (~100h)

#### 1. Billing Integration - Polar (20h)

**Desde cero:**
- [ ] `src/services/polarService.js` - Cliente API Polar
- [ ] `src/webhooks/polarWebhooks.js` - Event handlers
- [ ] `src/services/billingStateMachine.js` - State machine de suscripción
- [ ] `database/migrations/polar_v2.sql` - Tablas y RLS
- [ ] Tests de integración Polar

**Estados:** trialing, active, canceled_pending, payment_retry, paused  
**Plans:** starter (30d trial), pro (7d trial), plus (no trial)

#### 2. Credits System v2 (12h)

**Activar y validar:**
- [ ] `src/services/creditsV2Service.js` - Ya existe, validar contra SSOT
- [ ] `database/migrations/credits_v2.sql` - Aplicar migration
- [ ] Middleware de consumo de créditos
- [ ] API endpoints `/api/credits/*`
- [ ] Tests completos

**Límites según SSOT:**
- starter: 1,000 analysis, 5 roasts
- pro: 10,000 analysis, 1,000 roasts
- plus: 100,000 analysis, 5,000 roasts

#### 3. Roast Engine v2 (16h)

**Rebuild siguiendo SSOT:**
- [ ] Prompt architecture v2 (según SSOT section 4)
- [ ] Modelos por tono (flanders→GPT-4 Turbo, resto→GPT-5 mini)
- [ ] Tone service refactor (3 tonos + personal)
- [ ] Style validator (SSOT-driven)
- [ ] Corrective replies generation
- [ ] Tests unitarios + integration

**CRÍTICO:** No usar prompts v1, seguir exactamente SSOT section 4.

#### 4. Shield Engine v2 (16h)

**Completar tests failing + refactor:**
- [ ] Cooling-off period logic
- [ ] Time window escalation
- [ ] Pattern recognition (habitual offender)
- [ ] Platform-specific actions
- [ ] Tests 15/15 passing
- [ ] Integration con Polar (paused users)

#### 5. Analysis Engine v2 (12h)

**Refactor siguiendo SSOT:**
- [ ] Perspective API integration (primary)
- [ ] OpenAI fallback (cuando Perspective falla)
- [ ] Gatekeeper service (prompt injection)
- [ ] Decision engine (SHIELD vs ROAST vs PUBLISH)
- [ ] Roastr Persona (encrypted, AES-256-GCM)
- [ ] Tests completos

#### 6. Workers v2 (12h)

**Refactor workers siguiendo SSOT:**
- [ ] `v2_FetchCommentsWorker` - Ingestión
- [ ] `v2_AnalyzeToxicityWorker` - Análisis
- [ ] `v2_GenerateRoastWorker` - Generación
- [ ] `v2_ShieldActionWorker` - Moderación
- [ ] `v2_BillingUpdateWorker` - Créditos
- [ ] Queue system estable (no flaky)
- [ ] Tests unitarios por worker

#### 7. Platform Integrations v2 (8h)

**Validar y limpiar 9 integraciones:**
- [ ] Twitter/X - OAuth + API
- [ ] YouTube - OAuth + API
- [ ] Instagram - OAuth + API
- [ ] Facebook - OAuth + API
- [ ] Discord - Bot integration
- [ ] Twitch - OAuth + API
- [ ] Reddit - OAuth + API
- [ ] TikTok - OAuth + API
- [ ] Bluesky - OAuth + API

**Límite:** 1 cuenta/plataforma (starter), 2 (pro/plus)

#### 8. Auth v2 (4h)

**Limpiar y estabilizar:**
- [ ] Supabase Auth integration
- [ ] OAuth providers (Twitter, Google, GitHub)
- [ ] Session management (no flaky tests)
- [ ] RLS policies per plan
- [ ] Onboarding flow

### Frontend Core (~50h)

#### 9. UI Design System (8h)

**Setup shadcn/ui + Tailwind v4:**
- [ ] Configurar shadcn/ui
- [ ] Tailwind v4 migration
- [ ] Design tokens (colors, spacing, typography)
- [ ] Component library base
- [ ] Dark mode support

#### 10. Dashboard User (12h)

**6 vistas principales:**
- [ ] `/dashboard` - Overview (cuentas, usage, alerts)
- [ ] `/accounts` - Gestión de cuentas por plataforma
- [ ] `/roasts` - Historial de roasts (pending, approved, rejected)
- [ ] `/shield` - Shield logs y analytics
- [ ] `/settings` - Persona, tono, preferencias
- [ ] `/billing` - Plan, usage, upgrade/cancel

**Componentes clave:**
- UsageWidget (análisis + roasts remaining)
- AccountsList (conexión OAuth)
- RoastsTable (pending approval)
- ShieldLogs (actions history)
- BillingCard (plan + trial status)

#### 11. Settings & Persona (8h)

**Roastr Persona UI:**
- [ ] Formulario de configuración (3 campos)
- [ ] Preview de tono según Persona
- [ ] Tone selector (flanders, balanceado, canalla, personal*)
- [ ] Personal tone (solo pro/plus)
- [ ] Encriptación client-side antes de enviar

#### 12. Billing UI (8h)

**Polar integration frontend:**
- [ ] Plan cards (starter/pro/plus)
- [ ] Trial countdown
- [ ] Upgrade/downgrade flow
- [ ] Cancel subscription
- [ ] Payment method management (via Polar)
- [ ] Invoice history

#### 13. Onboarding Flow (6h)

**First-time user experience:**
- [ ] Welcome screen
- [ ] Plan selection (starter free trial)
- [ ] Payment method (even for trial)
- [ ] Connect first account (OAuth)
- [ ] Set Persona + tone
- [ ] Dashboard redirect

#### 14. Admin Panel (8h)

**Feature flags + monitoring:**
- [ ] Feature flags UI (según SSOT section 3)
- [ ] User management (planes, credits override)
- [ ] Platform health dashboard
- [ ] Worker status monitoring
- [ ] Analytics overview

### Testing Infrastructure (~40h)

#### 15. Unit Tests (16h)

**Coverage objetivo: 80%+**
- [ ] Backend services (roast, shield, billing, credits)
- [ ] API endpoints (auth, roast, billing, admin)
- [ ] Workers (fetch, analyze, generate, shield, billing)
- [ ] Utils (encryption, validation, formatting)

#### 16. Integration Tests (12h)

**Flujos end-to-end backend:**
- [ ] Auth flow (signup → login → OAuth)
- [ ] Billing flow (trial → active → cancel)
- [ ] Roast generation (comment → analysis → roast → post)
- [ ] Shield escalation (violation → action → platform)
- [ ] Credits consumption (analysis → roast → reset)

#### 17. E2E Tests (Playwright) (12h)

**User journeys completos:**
- [ ] Signup + onboarding
- [ ] Connect account OAuth
- [ ] Generate first roast
- [ ] Approve/reject roast
- [ ] Upgrade plan
- [ ] Cancel subscription

---

## 📅 Timeline Propuesto: 12 Días (Scope Mínimo)

### Fase 1: Foundation (Días 1-3, 36h)

**Día 1 (12h):**
- [ ] Setup shadcn/ui + Tailwind v4 (4h)
- [ ] Polar service base + webhooks (8h)

**Día 2 (12h):**
- [ ] Billing state machine + tests (6h)
- [ ] Credits v2 activation + tests (6h)

**Día 3 (12h):**
- [ ] Auth cleanup + estabilización (4h)
- [ ] Roast Engine v2 base (8h)

**Checkpoint Día 3:** ✅ Billing + Credits funcional, Auth estable

### Fase 2: Core Features (Días 4-7, 48h)

**Día 4 (12h):**
- [ ] Roast Engine v2 completo (8h)
- [ ] Shield Engine v2 (4h focus en tests failing)

**Día 5 (12h):**
- [ ] Shield Engine v2 completo (8h)
- [ ] Analysis Engine v2 (4h base)

**Día 6 (12h):**
- [ ] Analysis Engine v2 completo (8h)
- [ ] Workers v2 refactor (4h base)

**Día 7 (12h):**
- [ ] Workers v2 completo (8h)
- [ ] Platform integrations cleanup (4h)

**Checkpoint Día 7:** ✅ Backend core funcional, workers estables

### Fase 3: Frontend (Días 8-10, 36h)

**Día 8 (12h):**
- [ ] Dashboard user (8h)
- [ ] Billing UI (4h)

**Día 9 (12h):**
- [ ] Settings + Persona UI (8h)
- [ ] Onboarding flow (4h)

**Día 10 (12h):**
- [ ] Admin Panel (8h)
- [ ] Integration frontend-backend (4h)

**Checkpoint Día 10:** ✅ UI completa, flujos conectados

### Fase 4: Testing & Deployment (Días 11-12, 24h)

**Día 11 (12h):**
- [ ] Unit tests suite (8h mínimo crítico)
- [ ] Integration tests (4h flujos clave)

**Día 12 (12h):**
- [ ] E2E tests (6h user journeys críticos)
- [ ] Deployment staging (2h)
- [ ] Validation completa (4h)

**Checkpoint Final:** ✅ Tests passing, staging funcional

---

## ⚠️ Riesgos Críticos

### R1: Scope demasiado grande (Probabilidad: ALTA)

**Timeline de 12 días solo es viable con scope MÍNIMO:**
- ✅ Planes: starter/pro/plus
- ✅ Billing: Polar básico (trial + active + cancel)
- ✅ Roasts: 3 tonos (sin personal)
- ✅ Shield: Lógica básica (sin features avanzadas)
- ✅ UI: 4 vistas core (dashboard, roasts, settings, billing)
- ❌ Analytics: DEFER
- ❌ Admin advanced: DEFER
- ❌ E2E completo: DEFER (solo smoke tests)

**Si scope crece → 15-20 días**

### R2: Tests infrastructure no se estabiliza (Probabilidad: MEDIA)

**Si tests siguen flaky:**
- Imposible validar features nuevas
- Regressions no detectadas
- Timeline se duplica

**Mitigación:**
- Primeros 3 días CRÍTICOS para estabilizar
- Si día 3 tests siguen rotos → STOP y re-planear

### R3: Polar integration más compleja de lo esperado (Probabilidad: MEDIA)

**Polar API puede tener:**
- Rate limits inesperados
- Webhooks con lógica compleja
- Testing difícil sin sandbox robusto

**Mitigación:**
- Mock Polar en desarrollo
- Feature flag para rollback a "billing desactivado"
- Documentar issues para post-v2

### R4: Frontend rebuild subestimado (Probabilidad: ALTA)

**UI coherente con shadcn/ui toma tiempo:**
- 6 vistas principales = 2h/vista mínimo
- Componentes custom = 1h/componente
- Integration con backend = 4h adicionales
- Responsive + dark mode = 4h adicionales

**Timeline real frontend: 50h (no 36h)**

### R5: Data migration v1→v2 (Probabilidad: CRÍTICA)

**Si hay usuarios en producción v1:**
- Migration de schema DB necesaria
- Backfill de datos legacy
- Testing exhaustivo de migration
- Rollback plan complejo

**Esto añade 8-12h al timeline**

---

## 💡 Estrategia Recomendada

### Opción A: MVP Mínimo (12 días, ARRIESGADO)

**Scope:**
- Backend: Billing (trial + active), Credits, Roasts (3 tonos), Shield básico
- Frontend: Dashboard, Roasts, Settings, Billing
- Tests: Unit (60%), Integration (3 flows), E2E (smoke tests)
- Deployment: Staging only

**Riesgos:**
- Features incompletas
- Tests mínimos
- Bugs probables

### Opción B: MVP Robusto (15 días, RECOMENDADO)

**Scope:**
- Backend: Todo lo de A + Workers estables + Platform integrations
- Frontend: Todo lo de A + Onboarding + Admin panel
- Tests: Unit (80%), Integration (6 flows), E2E (4 journeys)
- Deployment: Staging + Production (soft launch)

**Beneficios:**
- Features completas core
- Tests robustos
- Menor riesgo de bugs

### Opción C: v2 Completo (20 días, IDEAL)

**Scope:**
- Backend: Todo + Analytics + Advanced Shield
- Frontend: Todo + Advanced admin + Analytics dashboard
- Tests: Unit (90%), Integration (10 flows), E2E (8 journeys)
- Deployment: Production (full launch)

**Beneficios:**
- Feature parity con spec v2
- Tests exhaustivos
- Producto production-ready

---

## 📊 Estimación Realista por Opción

| Opción        | Timeline | Horas | Features       | Tests  | Riesgo |
| ------------- | -------- | ----- | -------------- | ------ | ------ |
| **A - MVP**   | 12 días  | 120h  | 60% de spec v2 | Básico | ALTO   |
| **B - Robusto** | 15 días  | 160h  | 85% de spec v2 | Bueno  | MEDIO  |
| **C - Completo** | 20 días  | 200h  | 100% de spec v2 | Exhaustivo | BAJO   |

---

## 🎯 Mi Recomendación

### Timeline: 15 días (Opción B)

**Por qué no 12 días:**
1. **Scope es MUCHO más grande** de lo que parece:
   - No es migrar docs, es rebuild completo
   - Frontend desde cero con shadcn/ui
   - Backend refactor completo
   - Tests desde cero (v1 está roto)
   - Polar integration (no existe)

2. **12 días solo viable con sacrificios inaceptables:**
   - Tests mínimos (60% coverage)
   - Features incompletas (sin personal tone, sin analytics)
   - UI básica (4 vistas vs 6+ necesarias)
   - Riesgo ALTO de bugs en production

3. **15 días da buffer razonable:**
   - 3 días extra para issues inesperados
   - Tests robustos (80% coverage)
   - Features core completas
   - UI coherente y pulida

**Por qué no 20 días:**
- 20 días es ideal pero puede no ser urgente
- Features avanzadas (analytics, admin advanced) pueden post-launch
- Si hay urgencia de negocio, 15 días es sweet spot

---

## 🚀 Plan de Acción (Opción B - 15 días)

### Setup Day 0 (Pre-inicio)

**Antes de comenzar rebuild:**
- [ ] Backup completo de v1 (código + DB)
- [ ] Branch `feature/rebuild-v2` desde main
- [ ] Feature flag `ENABLE_V2_REBUILD` en OFF
- [ ] Comunicar a stakeholders timeline de 15 días
- [ ] **SCOPE FREEZE** absoluto (zero changes durante rebuild)

### Daily Workflow

**Cada día:**
1. Morning standup (15min):
   - Review de métricas (tests passing, features complete)
   - Identificar blockers
   - Ajustar prioridades

2. Development (10h efectivas):
   - Focus en task del día
   - Commits pequeños y frecuentes
   - Tests después de cada feature

3. Evening checkpoint (30min):
   - Validar CI/CD passing
   - Update de progress report
   - Planear día siguiente

### Critical Milestones

**Día 3:** ✅ Billing + Credits + Auth funcional  
**Día 7:** ✅ Backend core completo (roast, shield, analysis, workers)  
**Día 10:** ✅ Frontend completo (6 vistas)  
**Día 13:** ✅ Tests passing (80% unit, 6 flows integration)  
**Día 15:** ✅ Staging deployed, validation completa

**Si algún milestone se retrasa >1 día → Re-evaluar scope**

---

## 📝 Conclusión

**Timeline realista: 15 días para MVP robusto**

**No recomiendo 12 días porque:**
- Scope es rebuild completo (150-200h de trabajo)
- v1 está completamente roto (no es punto de partida útil)
- Tests desde cero toma tiempo
- Frontend rebuild con shadcn/ui toma tiempo
- Polar integration es nueva feature

**Pero SI decides 12 días:**
- Scope MUST BE MINIMAL (Opción A)
- Acepta features incompletas
- Acepta tests básicos (60%)
- Acepta riesgo ALTO de bugs
- Ten plan de rollback listo

**Next Steps:**
1. Aprobar timeline (12/15/20 días)
2. Aprobar scope (A/B/C)
3. Crear branch `feature/rebuild-v2`
4. Ejecutar Setup Day 0
5. Comenzar Día 1

---

**Última actualización:** 2025-12-09  
**Recommendation:** Opción B - 15 días  
**Confidence:** ALTA (si scope se respeta)

