# Plan: Issue #485 - Fix Unit Test Suite (15 files)

**Issue:** #485  
**Epic:** #480  
**Priority:** P1  
**Labels:** test:unit, complementary-flow, epic:test-stabilization  
**Estimated Effort:** 8-10 hours

---

## Estado Actual

15 archivos de tests fallando en diferentes áreas:
- Routes: 6 archivos
- Middleware: 1 archivo
- Services: 2 archivos
- Utils: 1 archivo
- Workers: 1 archivo
- Components: 1 archivo
- Integration: 2 archivos

**Common Failure Patterns:**
- Mock data mismatches
- API contract changes
- Missing environment variables
- Database state issues
- Async timing issues

---

## Estrategia de Fix

### Grupo 1: Routes (6 archivos) - 3 horas
1. `tests/unit/routes/style-profile.test.js` - Verificar mensaje de error esperado
2. `tests/unit/routes/roastr-persona.test.js` - Revisar mocks y validaciones
3. `tests/unit/routes/integrations-new.test.js` - Verificar contratos de API
4. `tests/unit/routes/admin-plan-limits.test.js` - Revisar mocks de admin
5. `tests/unit/routes/roastr-persona-tolerance.test.js` - Validar tolerancias
6. `tests/unit/routes/account-deletion.test.js` - Verificar flujo de eliminación

### Grupo 2: Services (2 archivos) - 2 horas
7. `tests/unit/services/logBackupService.test.js` - Revisar mocks de backup
8. `tests/unit/services/stripeWebhookService.test.js` - Verificar webhooks de Stripe

### Grupo 3: Middleware + Utils (2 archivos) - 2 horas
9. `tests/unit/middleware/inputValidation.test.js` - Validar validaciones de input
10. `tests/unit/utils/logMaintenance.test.js` - Revisar utilidades de logs

### Grupo 4: Workers + Components (2 archivos) - 2 horas
11. `tests/unit/workers/BaseWorker.healthcheck.test.js` - Verificar healthchecks
12. `tests/unit/components/AjustesSettings.test.jsx` - Revisar componente React

### Grupo 5: Integration (2 archivos) - 2 horas
13. `tests/integration/autoApprovalSecurityV2.test.js` - Validar seguridad
14. `tests/integration/oauth-mock.test.js` - Verificar OAuth mocks

---

## Pasos de Implementación

### FASE 1: Diagnóstico (30 min)
1. Ejecutar cada test individualmente para identificar error exacto
2. Documentar patrón de error por archivo
3. Identificar si es mock, contrato API, o timing issue

### FASE 2: Fix por Grupo (2-3 horas por grupo)
Para cada test:
1. Leer código fuente relacionado
2. Verificar mocks y fixtures
3. Ajustar test según código actual
4. Ejecutar test individual
5. Verificar que pasa
6. Commit por archivo o grupo pequeño

### FASE 3: Validación (30 min)
1. Ejecutar todos los tests juntos: `npm test -- tests/unit/`
2. Verificar coverage: `npm run test:coverage`
3. Asegurar >=90% coverage
4. Verificar 0 tests fallando

---

## Agentes Relevantes

- **TestEngineer** - Generación y fix de tests
- **Back-end-dev** - Revisar contratos API y servicios
- **Front-end-dev** - Fix componente React

---

## Archivos Afectados

### Tests a Arreglar
- `tests/unit/routes/style-profile.test.js`
- `tests/unit/routes/roastr-persona.test.js`
- `tests/unit/routes/integrations-new.test.js`
- `tests/unit/routes/admin-plan-limits.test.js`
- `tests/unit/routes/roastr-persona-tolerance.test.js`
- `tests/unit/routes/account-deletion.test.js`
- `tests/unit/middleware/inputValidation.test.js`
- `tests/unit/services/logBackupService.test.js`
- `tests/unit/services/stripeWebhookService.test.js`
- `tests/unit/utils/logMaintenance.test.js`
- `tests/unit/workers/BaseWorker.healthcheck.test.js`
- `tests/unit/components/AjustesSettings.test.jsx`
- `tests/integration/autoApprovalSecurityV2.test.js`
- `tests/integration/oauth-mock.test.js`

### Código Fuente (posiblemente)
- `src/routes/style-profile.js`
- `src/routes/persona.js`
- `src/routes/integrations-new.js`
- `src/routes/admin-plan-limits.js`
- `src/middleware/inputValidation.js`
- `src/services/logBackupService.js`
- `src/services/stripeWebhookService.js`
- `src/utils/logMaintenance.js`
- `src/workers/BaseWorker.js`
- `src/components/AjustesSettings.jsx`

---

## Validación Requerida

### Tests
- ✅ Todos los 15 archivos pasando
- ✅ 0 tests fallando
- ✅ Coverage >=90%
- ✅ Sin console.errors o warnings

### GDD
- ✅ Health score >=87
- ✅ Actualizar nodos afectados si hay cambios en código fuente
- ✅ Coverage Source: auto (NUNCA manual)

### CodeRabbit
- ✅ 0 comentarios pendientes
- ✅ Seguir patrones de coderabbit-lessons.md

---

## Notas

- Estos son tests de **lower priority** que no bloquean funcionalidad core
- Reducen confianza general en la suite de tests
- Fix sistemático por grupo para mantener contexto
- Commit frecuente por archivo/grupo pequeño


