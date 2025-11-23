# Implementation Plan - Issue #841

## Actualizar planes de suscripción (eliminar Free y ajustar límites)

**Issue:** #841  
**Priority:** 🟡 Media  
**Effort:** 3-4 días  
**Agents:** Orchestrator, Backend Dev, Frontend Dev, Test Engineer, Guardian  
**Status:** Borrador inicial

---

## 🎯 Acceptance Criteria

1. Ninguna referencia al plan Free en código, pruebas o documentación.
2. Plan Starter: 5 roasts/mes y 1 plataforma en toda la plataforma.
3. Plan Pro: 1 000 roasts/mes, 2 plataformas; sin menciones a analíticas especiales.
4. Plan Plus: 5 000 roasts/mes, 2 plataformas; sin soporte prioritario ni perks extra.
5. UI/Docs reflejan los nuevos valores y textos, y los tests pasan.

---

## 📊 Estado Actual

- `plan-features`, `cost-control`, `entitlementsService`, `pricing` frontend y docs describen 4 planes (Free/Starter/Pro/Plus) e incluso un plan Starter Trial.
- Base de datos (`plan_limits`, `organizations.plan_id`) todavía acepta `free`; costControl aplica límites antiguos (100/500/1000/∞ roasts, hasta 10 plataformas).
- Pricing UI (`frontend/src/components/PolarPricingExample.jsx`, páginas de marketing) y documentación (`docs/flows/payment-polar.md`, `CLAUDE.md`, `docs/nodes/plan-features.md`, etc.) muestran datos obsoletos (analíticas, soporte prioritario, custom styles).
- Tests (unit/integration) cubren escenarios con Free/Starter Trial y validan límites actuales; fixtures y helpers (`tests/helpers/tenantTestUtils.js`) generan organizaciones con plan `free`.

---

## 🛠️ Plan de Implementación

### Fase 1 — Limpieza de modelos y constantes

- Actualizar seeds/migraciones (`plan_limits`, `organizations.plan_id`, enums) eliminando `free` y `starter_trial`.
- Ajustar `src/services/costControl.js`, `entitlementsService`, `planFeatures` constants y cualquier `PLAN_MAP` para reflejar solo Starter/Pro/Plus.
- Revisar `database/schema.sql`, migraciones y scripts (`scripts/apply-rls-policies.js`, `scripts/ensure-rls-test-tables.js`) para eliminar `free`.

### Fase 2 — Lógica de negocio y workers

- Actualizar servicios y workers que consultan límites (CostControlService, Shield, queue, workers) con los nuevos máximos (5/1000/5000 roasts; plataformas 1/2/2).
- Ajustar validaciones de plataformas permitidas en `integration_configs`, `queue` y `persona` gating (Plus deja de tener perks exclusivos, revisar flags).
- Confirmar que reglas de plan en `src/config/constants.js`, `src/services/planFeaturesService.js`, `entitlementsService`, etc. reflejen nuevos permisos.

### Fase 3 — Tests y helpers

- Actualizar fixtures y utilidades (`tests/helpers/tenantTestUtils.js`, seeds mock) para usar los nuevos límites/planes.
- Modificar tests unitarios/integración que hagan assertions sobre Free o perks eliminados.
- Asegurar cobertura para los nuevos límites (tests en `tests/unit/services/costControl.test.js`, `tests/unit/services/planFeaturesService.test.js`, etc.).

### Fase 4 — Frontend/UI y documentación

- Actualizar pricing UI (`frontend/src/components/PolarPricingExample.jsx`, páginas públicas, docs del admin panel).
- Revisar `docs/flows/payment-polar.md`, `CLAUDE.md`, `docs/nodes/plan-features.md`, `docs/issues/*` y cualquier material comercial para alinear la narrativa.
- Eliminar mención a soporte prioritario, analíticas especiales y custom styles (Plus ahora solo extiende límites).

### Fase 5 — Validación y sincronización

- Ejecutar `npm test`, `npm run test:coverage`.
- Actualizar nodos GDD afectados (plan-features, cost-control, roast, social-platforms, etc.) y validar con `node scripts/validate-gdd-runtime.js --full` y `node scripts/score-gdd-health.js --ci`.
- Generar recibos de agentes invocados (TestEngineer, FrontendDev, Guardian, etc.) y evidencia de tests/UI.

---

## 📁 Archivos/Áreas a tocar

- `src/services/costControl.js`, `src/services/entitlementsService.js`, `src/config/constants.js`
- `src/services/planFeaturesService.js`, `src/services/costControl/constants.js`
- `frontend/src/components/PolarPricingExample.jsx`, `frontend/src/pages/*`, materiales marketing/docs
- `database/migrations/*`, `plan_limits` seeds, `scripts/*` relacionados con planes
- Tests: `tests/unit/services/costControl.test.js`, `tests/helpers/tenantTestUtils.js`, integración billing/queue
- Documentación: `docs/flows/payment-polar.md`, `docs/nodes/plan-features.md`, `CLAUDE.md`, `README`, etc.

---

## ✅ Validación requerida

- `npm test`, `npm run test:coverage` ≥90%
- `node scripts/validate-gdd-runtime.js --full`
- `node scripts/score-gdd-health.js --ci` (≥87)
- Visual validation (pricing UI) + reporte en `docs/test-evidence/issue-841/`
- Receipts: Orchestrator (este plan), FrontendDev (UI), TestEngineer (tests), Guardian (cost-control/billing)

---

## 🚧 Riesgos / Preguntas Abiertas

1. Migraciones: ¿Necesitamos migración para organizaciones existentes con plan `free`? (posible script que reasigne a Starter con límites nuevos).
2. `Starter Trial`: decidir si se mantiene como modalidad interna o se elimina junto al Free (recomendado eliminar para evitar confusión).
3. Validar impacto en billing (Polar/Stripe) para asegurar que precios/product IDs coinciden con nueva oferta.
