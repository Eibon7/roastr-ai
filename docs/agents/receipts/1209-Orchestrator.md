# Receipt: Orchestrator

**PR:** #1209 - A1. Auth Error Handling (V2)  
**Date:** 2025-12-28  
**Issue:** ROA-405

## Trigger

**Why this agent was invoked:**

- [x] Diff match: `apps/backend-v2/src/**`, `frontend/src/**`, `docs/**`
- [x] Condition: Contrato compartido backend↔frontend para errores de Auth (slugs + retryable + request_id) con tests mínimos.

## Decisions/Artifacts

**Key decisions made:**

- Slug estable como identificador único del error (sin mensajes técnicos).
- `retryable` explícito por slug (nunca inferido por HTTP status).
- Contrato de respuesta de error uniforme: `{ success:false, error:{slug,retryable}, request_id }`.
- Fail-closed por defecto (`AUTH_UNKNOWN`).

**Artifacts produced (high level):**

- Backend: taxonomía + mappers + respuesta pública + `request_id` middleware.
- Frontend: parseo de contrato (`slug/retryable/request_id`) + handler por `slug`.
- Docs: SSOT v2 + contrato FE/BE + evento `auth_error_shown`.
- Tests: backend mapping/contract + frontend contract test (no UI).

## Guardrails Verified

- [x] No PII en respuestas/logs de auth.
- [x] No errores crudos de Supabase hacia frontend.
- [x] Frontend resuelve por `slug` (no por HTTP status).
- [x] Tests ejecutados antes de dar por finalizado.

## Result

**Outcome:** ✅ Success

**Agent Output (commands run):**

```shell
apps/backend-v2: npm test
frontend: npm run test:run
gdd: node scripts/validate-gdd-runtime.js --full
gdd: node scripts/score-gdd-health.js --ci
```

