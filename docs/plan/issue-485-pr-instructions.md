# Instrucciones para crear Issue y PR - Issue #485

## Crear Issue de Seguimiento

```bash
gh issue create \
  --title "Issue #485 - Tests pendientes: logBackupService, stripeWebhookService, admin-plan-limits" \
  --body "Tests pendientes de Issue #485. Ver \`docs/plan/issue-485-followup.md\` para detalles completos.

## Resumen

**Archivos completados (7):**
- ✅ logMaintenance.test.js: 22/22
- ✅ roastr-persona.test.js: 18/18  
- ✅ roastr-persona-tolerance.test.js: 9/9
- ✅ account-deletion.test.js: 13/13
- ✅ inputValidation.test.js: 32/32
- ✅ BaseWorker.healthcheck.test.js: 18/18
- ✅ oauth-mock.test.js: 30/30

**Archivos pendientes (3):**
1. logBackupService.test.js - 2 tests de retry pendientes
2. stripeWebhookService.test.js - 8 tests pendientes (mocks Stripe/Supabase)
3. admin-plan-limits.test.js - 11 tests pendientes (problema middleware)

Ver \`docs/plan/issue-485-followup.md\` para plan de acción detallado." \
  --label "test:unit,complementary-flow"
```

## Crear PR para trabajo completado

```bash
# Obtener nombre de rama actual
BRANCH=$(git branch --show-current)

# Crear PR
gh pr create \
  --title "Issue #485 - Fix Unit Test Suite (7 archivos completados)" \
  --body "## Resumen

Esta PR completa 7 de los 15 archivos de tests de la Issue #485.

### Archivos completados ✅
- \`tests/unit/utils/logMaintenance.test.js\`: 22/22 tests pasando
- \`tests/unit/routes/roastr-persona.test.js\`: 18/18 tests pasando
- \`tests/unit/routes/roastr-persona-tolerance.test.js\`: 9/9 tests pasando
- \`tests/unit/routes/account-deletion.test.js\`: 13/13 tests pasando
- \`tests/unit/middleware/inputValidation.test.js\`: 32/32 tests pasando
- \`tests/unit/workers/BaseWorker.healthcheck.test.js\`: 18/18 tests pasando
- \`tests/integration/oauth-mock.test.js\`: 30/30 tests pasando

**Total: 142 tests pasando**

### Archivos pendientes ⚠️
Los siguientes archivos requieren más investigación y se han movido a una issue de seguimiento:
- \`tests/unit/services/logBackupService.test.js\` (2 tests pendientes)
- \`tests/unit/services/stripeWebhookService.test.js\` (8 tests pendientes)
- \`tests/unit/routes/admin-plan-limits.test.js\` (11 tests pendientes)

Ver \`docs/plan/issue-485-followup.md\` para detalles.

### Cambios principales
- Ajustes en mocks de Supabase RPC para transacciones atómicas
- Corrección de estructuras de respuesta esperadas en tests
- Ajustes en mocks de servicios externos (Stripe, S3)
- Corrección de validaciones de input y middleware

### Referencias
- Issue original: #485
- Issue de seguimiento: (se creará automáticamente)
- Epic: #480" \
  --base main \
  --head "$BRANCH"
```

## Archivos modificados en esta sesión

Los siguientes archivos fueron modificados para completar los tests:

1. `tests/unit/utils/logMaintenance.test.js` - Completado (22/22)
2. `tests/unit/routes/roastr-persona.test.js` - Completado (18/18)
3. `tests/unit/routes/roastr-persona-tolerance.test.js` - Completado (9/9)
4. `tests/unit/routes/account-deletion.test.js` - Completado (13/13)
5. `tests/unit/middleware/inputValidation.test.js` - Completado (32/32)
6. `tests/unit/workers/BaseWorker.healthcheck.test.js` - Completado (18/18)
7. `tests/integration/oauth-mock.test.js` - Completado (30/30)
8. `docs/plan/issue-485-followup.md` - Documento de seguimiento creado

## Notas

- Asegúrate de hacer commit de todos los cambios antes de crear la PR
- Verifica que los tests pasen antes de crear la PR
- La issue de seguimiento se puede crear después de la PR si es necesario


