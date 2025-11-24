# Plan: Issue #932 - Tests para Routes de Admin

## Información del Issue

- **Título:** [Coverage] Fase 4.2: Tests para Routes de Admin (0-39% → 70%+)
- **Labels:** enhancement, medium priority, backend
- **AC Count:** 9 (requiere TaskAssessor)
- **Prioridad:** 🟡 MEDIA

## Estado Actual

### Archivos Target

| Archivo                    | Cobertura Actual | Objetivo | Tests Existentes     |
| -------------------------- | ---------------- | -------- | -------------------- |
| `src/routes/admin.js`      | 38.9%            | 70%+     | 8 archivos parciales |
| `src/routes/monitoring.js` | 0%               | 70%+     | ❌ No existen        |
| `src/routes/revenue.js`    | 0%               | 70%+     | ❌ No existen        |

### Tests Existentes para admin.js

- `tests/unit/routes/admin.test.js`
- `tests/unit/routes/admin-user-dashboard-issue241.test.js`
- `tests/unit/routes/admin-plan-upgrade.test.js`
- `tests/unit/routes/admin-plan-upgrade-issue126.test.js`
- `tests/unit/routes/admin-plan-limits.test.js`
- `tests/unit/middleware/adminRateLimiter.test.js`
- `tests/rls/admin.test.js`
- `tests/integration/admin-rls.test.js`

## Acceptance Criteria

- [ ] `admin.js` tiene ≥70% cobertura
- [ ] `monitoring.js` tiene ≥70% cobertura
- [ ] `revenue.js` tiene ≥70% cobertura
- [ ] Todos los tests pasan (0 failures)
- [ ] Tests cubren endpoints principales
- [ ] Tests cubren casos de éxito y error
- [ ] Tests validan permisos de admin
- [ ] Tests validan respuestas HTTP correctas
- [ ] Tests usan mocks apropiados

## Plan de Implementación

### FASE 1: Tests para monitoring.js (0% → 70%+)

**Endpoints a cubrir:**

1. `GET /api/monitoring/health` - Health status
2. `GET /api/monitoring/metrics` - Tier validation metrics
3. `GET /api/monitoring/cache` - Cache performance metrics
4. `POST /api/monitoring/cache/clear` - Clear caches (admin)
5. `GET /api/monitoring/alerts/config` - Alert configuration
6. `PUT /api/monitoring/alerts/config` - Update alert thresholds (admin)
7. `POST /api/monitoring/alerts/test` - Send test alert (admin)
8. `GET /api/monitoring/performance` - Performance analytics

**Tests a crear:**

- Casos éxito para cada endpoint
- Casos error (auth fallido, params inválidos)
- Validación permisos admin

### FASE 2: Tests para revenue.js (0% → 70%+)

**Endpoints a cubrir:**

1. `GET /api/admin/revenue/overview` - Revenue overview
2. `GET /api/admin/revenue/churn` - Churn metrics
3. `GET /api/admin/revenue/trends` - Revenue trends

**Tests a crear:**

- Casos éxito con datos mock
- Casos error (no admin, DB error)
- Validación cálculos MRR/churn
- Integración Stripe opcional

### FASE 3: Expandir tests para admin.js (38.9% → 70%+)

**Endpoints sin cobertura completa:**

1. `POST /api/admin/csrf-test`
2. `GET /api/admin/dashboard`
3. `GET /api/admin/config`
4. `GET /api/admin/logs`
5. `GET /api/admin/logs/download`
6. `POST /api/admin/integrations/test`
7. `GET /api/admin/usage`
8. `GET /api/admin/usage/export`
9. `POST /api/admin/usage/reset`
10. `PUT /api/admin/backoffice/thresholds`

## Archivos a Crear

```
tests/unit/routes/
├── monitoring.test.js        # NUEVO - Tests para monitoring.js
├── revenue.test.js           # NUEVO - Tests para revenue.js
└── admin-extended.test.js    # NUEVO - Tests adicionales para admin.js
```

## Agentes Relevantes

- TestEngineer - Generación de tests

## Validación

```bash
# Tests pasando
npm test -- tests/unit/routes/monitoring.test.js
npm test -- tests/unit/routes/revenue.test.js
npm test -- tests/unit/routes/admin*.test.js

# Coverage check
npm run test:coverage -- --collectCoverageFrom='src/routes/admin.js' --collectCoverageFrom='src/routes/monitoring.js' --collectCoverageFrom='src/routes/revenue.js'
```

## Notas CodeRabbit

Siguiendo `docs/patterns/coderabbit-lessons.md`:

- ✅ Usar mocks apropiados (patron #11 Supabase Mock)
- ✅ Cubrir happy path + error cases + edge cases
- ✅ Usar `logger.js` mock para evitar winston issues
- ✅ Verificar mock calls: `expect(mock).toHaveBeenCalledWith(...)`

---

**Fecha creación:** 2025-11-24
**Issue:** #932
**Autor:** TestEngineer Agent
