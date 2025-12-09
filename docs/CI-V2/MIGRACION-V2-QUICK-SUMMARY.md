# Rebuild v2: Resumen Ejecutivo

**Scope:** Rebuild completo según SSOT-V2  
**Timeline:** 15 días (recomendado) | 12 días (mínimo arriesgado)  
**Ritmo:** IA full-time | **Viabilidad:** ⚠️ MEDIA-ALTA

---

## 📊 En Números

| Métrica                       | v1 (Roto)         | v2 Target            | Esfuerzo |
| ----------------------------- | ----------------- | -------------------- | -------- |
| **Billing System**            | Stripe (legacy)   | Polar v2             | 20h      |
| **Credits System**            | Diseñado no activo| v2 funcional         | 12h      |
| **Roast Engine**              | Prompts v1 rotos  | SSOT-driven v2       | 16h      |
| **Shield Engine**             | 9/15 tests        | 15/15 + refactor     | 16h      |
| **Analysis Engine**           | Lógica mixta      | SSOT-driven v2       | 12h      |
| **Workers**                   | Flaky tests       | Estables v2          | 12h      |
| **Platform Integrations**     | 9 legacy          | 9 limpias v2         | 8h       |
| **Auth**                      | OAuth pollution   | Estable v2           | 4h       |
| **Frontend UI**               | Inconsistente     | shadcn/ui completo   | 50h      |
| **Tests**                     | 178 suites failing| Suite completa 80%+  | 40h      |
| **Total Backend**             | -                 | -                    | **100h** |
| **Total Frontend**            | -                 | -                    | **50h**  |
| **Total Tests**               | -                 | -                    | **40h**  |
| **TOTAL EFFORT**              | -                 | -                    | **190h** |

---

## 🎯 Timeline Visual (Opción B - 15 días recomendada)

```
Día 1-3  [████████████] Foundation (36h)
         ├─ Polar billing base + webhooks
         ├─ Credits v2 activation
         ├─ Auth cleanup
         └─ Roast Engine v2 base

Día 4-7  [████████████] Backend Core (48h)
         ├─ Roast Engine v2 completo
         ├─ Shield Engine v2 (15/15 tests)
         ├─ Analysis Engine v2
         ├─ Workers v2 refactor
         └─ Platform integrations cleanup

Día 8-10 [████████████] Frontend (36h)
         ├─ shadcn/ui setup + Design system
         ├─ Dashboard user (6 vistas)
         ├─ Billing UI (Polar)
         ├─ Settings + Persona
         ├─ Onboarding flow
         └─ Admin Panel

Día 11-13 [████████████] Testing (32h)
          ├─ Unit tests (80% coverage)
          ├─ Integration tests (6 flows)
          └─ E2E tests (4 journeys)

Día 14-15 [████░░░░░░░░] Deploy + Buffer (16h)
          ├─ Staging deployment
          ├─ Validation completa
          ├─ Buffer para issues
          └─ Production soft launch

Total: 168h efectivas / 15 días = 11.2h/día (intensivo pero sostenible)

⚠️  Opción 12 días: Solo viable con scope mínimo (120h, features 60%)
✅  Opción 20 días: Ideal para features 100% + analytics + admin advanced
```

---

## ✅ Lo que YA funciona (Specs v2)

**Documentación completa:**
- ✅ SSOT-V2.md (~2000 líneas) - Fuente única de verdad
- ✅ system-map-v2.yaml (15 nodos)
- ✅ 16 nodos en docs/nodes-v2/ con specs detalladas
- ✅ GDD Health v2: 98.67%
- ✅ 9 scripts v2 de validación sin hardcodes
- ✅ 3 reglas v2 en .cursor/rules/

**Infrastructure parcial:**
- ✅ Supabase (DB, Auth, RLS)
- ✅ OpenAI integration
- ✅ Redis/Upstash
- ✅ Vercel deployment

---

## ❌ Lo que está ROTO en v1 (Rebuild necesario)

**Backend roto/obsoleto:**
- ❌ **Roast Engine** - Prompts v1, modelos incorrectos, no sigue SSOT
- ❌ **Shield Service** - 9/15 tests passing (60%), lógica incompleta
- ❌ **Billing** - Stripe (legacy), **Polar NO implementado**
- ❌ **Credits System** - v2 diseñado pero **NO activo**
- ❌ **Workers** - Lógica mixta v1/v2, tests flaky
- ❌ **Queue System** - Tests con timing issues
- ❌ **Auth** - OAuth test pollution, session issues
- ❌ **Platform Integrations** - 9 plataformas con código legacy

**Frontend roto/obsoleto:**
- ❌ **UI inconsistente** - Mix de estilos, no design system
- ❌ **Dashboard** - Widgets rotos, datos incorrectos
- ❌ **Billing UI** - Stripe hardcoded, no sigue v2 plans
- ❌ **Settings** - Persona config rota, tono personal missing
- ❌ **Admin Panel** - Features fuera de spec v2
- ❌ **Onboarding** - Flow incompleto

**Tests completamente rotos:**
- ❌ **178 test suites failing** (casi todo roto)
- ❌ **Coverage 1.48%** (prácticamente 0)
- ❌ **Test infrastructure** - Mocks no alineados, flaky tests

**Features incorrectas (fuera de spec v2):**
- ❌ Plans legacy: "free", "basic", "creator_plus"
- ❌ Features admin no especificadas
- ❌ Funcionalidades de analytics fuera de scope

---

## 🎲 Factores de Riesgo

| Riesgo                          | Probabilidad | Impacto  | Mitigación                        |
| ------------------------------- | ------------ | -------- | --------------------------------- |
| **Romper CI/CD**                | Alta         | Crítico  | Testing exhaustivo + rollback     |
| **IDs legacy → features rotas** | Media        | Alto     | Tests automáticos por cambio      |
| **Scope creep**                 | Alta         | Medio    | **SCOPE FREEZE** absoluto         |
| **Health <100%**                | Media        | Bajo     | Threshold temporal 95% aceptable  |
| **Features incompletas**        | Media        | Medio    | Feature flags + defer a post-v2   |

---

## 💰 Cost-Benefit

### Beneficios de completar v2

✅ **CI/CD 100% consistente** - Un solo sistema de health
✅ **Codebase limpia** - Zero referencias legacy
✅ **Mantenibilidad** - Sistema v2 SSOT-driven sin hardcodes
✅ **Escalabilidad** - Nodos v2 modulares y extensibles
✅ **Developer Experience** - Documentación clara y actualizada

### Costo de NO completar v2

❌ **Deuda técnica acumulada** - Dos sistemas paralelos
❌ **Confusión continua** - ¿Usar v1 o v2?
❌ **CI/CD frágil** - Workflows mixtos v1/v2
❌ **Onboarding lento** - Nuevos devs confundidos
❌ **Bugs sutiles** - Inconsistencias entre v1 y v2

---

## 🚦 Go / No-Go Decision

### ✅ GO si:

- Tienes 12 días disponibles sin interrupciones
- Puedes hacer **scope freeze** estricto (zero new features)
- Automated testing está al día (CI passing)
- Hay rollback plan para cada cambio crítico
- Buffer days son respetados (no comprimir timeline)

### ❌ NO-GO si:

- Timeline <10 días (muy arriesgado)
- Hay features críticas bloqueadas por migración
- CI/CD no funciona actualmente (arreglar primero)
- No hay testing automatizado robusto
- Team no puede hacer scope freeze

---

## 🎯 Success Metrics

**Must-Have (Bloqueadores):**
1. ✅ 0 workflows ejecutando scripts v1
2. ✅ 0 IDs legacy en código crítico
3. ✅ GDD Health v2 ≥95%
4. ✅ CI passing al 100%

**Nice-to-Have (Post-v2 OK):**
5. ⭐ Shield Phase 2 completo (15/15)
6. ⭐ Credits v2 activado
7. ⭐ Health v2 al 100%
8. ⭐ Kill switch activo

---

## 💡 Recomendación Final

**⚠️ IMPORTANTE: Esto NO es migración de docs, es REBUILD COMPLETO**

### Opción A: MVP Mínimo (12 días) - ARRIESGADO ⚠️

**Scope:**
- Backend: Billing (trial+active), Credits, Roasts (3 tonos básicos), Shield básico
- Frontend: 4 vistas core (dashboard, roasts, settings, billing)
- Tests: Unit (60%), Integration (3 flows), E2E (smoke tests)

**Riesgos:**
- Features incompletas (sin tono personal, sin admin avanzado)
- Tests mínimos (60% coverage)
- Bugs probables en producción
- **NO recomendado** a menos que urgencia crítica

### Opción B: MVP Robusto (15 días) - RECOMENDADO ✅

**Scope:**
- Backend: Todo de A + Workers estables + Platform integrations completas
- Frontend: 6 vistas (+ onboarding + admin panel)
- Tests: Unit (80%), Integration (6 flows), E2E (4 journeys)
- Deployment: Staging + Production soft launch

**Beneficios:**
- Features core completas según SSOT v2
- Tests robustos (80% coverage)
- Menor riesgo de bugs
- Buffer para imprevistos (3 días)

### Opción C: v2 Completo (20 días) - IDEAL ⭐

**Scope:**
- Backend: Todo + Analytics + Advanced Shield features
- Frontend: Todo + Analytics dashboard + Admin advanced
- Tests: Unit (90%), Integration (10 flows), E2E (8 journeys)
- Deployment: Production full launch

**Beneficios:**
- Feature parity 100% con spec v2
- Tests exhaustivos
- Producto production-ready sin deuda técnica

---

## 🚀 Next Steps

1. **Aprobar timeline** - Elegir opción (10/12/15 días)
2. **Crear branch** - `feature/complete-v2-migration`
3. **Scope freeze** - Comunicar a team
4. **Día 1:** Migrar workflows (12h)
5. **Daily checkpoint:** Review metrics + blockers

---

## 🎬 Conclusión

**El problema real:** v1 está completamente roto (tests, UI, features incorrectas)  
**La solución:** Rebuild completo siguiendo SSOT-V2.md y system-map-v2.yaml  
**Timeline realista:** **15 días** para MVP robusto (Opción B)

**Por qué NO 12 días:**
1. Scope es rebuild completo (~190h), no migración de docs
2. Frontend desde cero con shadcn/ui (50h)
3. Backend refactor completo según SSOT (100h)
4. Tests desde cero, v1 tiene 178 suites failing (40h)
5. Polar billing NO existe, hay que construir (20h)

**Por qué 15 días:**
- Buffer razonable para imprevistos (20% extra)
- Tests robustos (80% vs 60%)
- Features core completas
- Menor riesgo de bugs en production

**Si decides 12 días:**
- ⚠️ Scope DEBE ser mínimo (Opción A)
- ⚠️ Acepta features incompletas
- ⚠️ Acepta tests básicos (60%)
- ⚠️ Acepta riesgo ALTO de bugs
- ⚠️ Ten plan de rollback listo

---

**Documentos completos:**
- `docs/CI-V2/REBUILD-V2-TIMELINE-REALISTA.md` - Análisis detallado
- `docs/CI-V2/MIGRACION-V1-V2-TIMELINE-ANALISIS.md` - Primera versión (obsoleta)

**Fecha:** 2025-12-09  
**Veredicto:** ⚠️ **12 días ARRIESGADO, 15 días RECOMENDADO**

