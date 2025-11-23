# Issue #485 - Tests Pendientes (Follow-up)

## Estado Actual

**Archivos completados (7):**

- ✅ `logMaintenance.test.js`: 22/22
- ✅ `roastr-persona.test.js`: 18/18
- ✅ `roastr-persona-tolerance.test.js`: 9/9
- ✅ `account-deletion.test.js`: 13/13
- ✅ `inputValidation.test.js`: 32/32
- ✅ `BaseWorker.healthcheck.test.js`: 18/18
- ✅ `oauth-mock.test.js`: 30/30

**Total completado:** 142 tests pasando

---

## Archivos Pendientes (3)

### 1. `tests/unit/services/logBackupService.test.js`

- **Estado**: ~14/16 tests pasando (87.5%)
- **Tests fallando**:
  - `should handle upload errors with retry`
  - `should fail after max retries`

**Problemas identificados:**

- Tests de retry logic requieren mocks más complejos
- Mocks de `fs.createReadStream` y `fs.pathExists` necesitan ajuste
- Tests de `backupLogsForDate` requieren mocks de S3 `headObject`
- Validación de formato de respuesta (Location vs location, ETag vs etag, size)

**Acciones necesarias:**

1. Revisar implementación real de `retryOperation` en `logBackupService.js`
2. Ajustar mocks para que coincidan con el comportamiento real
3. Verificar formato exacto de respuestas de AWS S3
4. Añadir mocks faltantes para `headObject` y `pathExists`

---

### 2. `tests/unit/services/stripeWebhookService.test.js`

- **Estado**: ~18/26 tests pasando (69.2%)
- **Tests fallando**:
  - `should handle subscription update successfully`
  - `should handle subscription without price (canceled)`
  - `should fail when customer not found`
  - `should handle subscription deletion successfully`
  - `should handle payment success for unknown customer gracefully`
  - Tests de integración con payloads reales de Stripe

**Problemas identificados:**

- Tests de `_handleSubscriptionUpdated` requieren mocks de `prices.list`
- Tests de `_handleSubscriptionDeleted` requieren mocks de RPC `execute_subscription_deleted_transaction`
- Tests de `_handleCheckoutCompleted` requieren mocks completos de subscription con fechas (`current_period_start`, `current_period_end`, etc.)
- Tests de integración requieren payloads reales de Stripe

**Acciones necesarias:**

1. Revisar implementación real de `_handleSubscriptionUpdated` para entender qué mocks necesita
2. Añadir mock de `mockStripeWrapper.prices.list`
3. Completar mocks de Supabase RPC para transacciones atómicas
4. Añadir todas las propiedades requeridas a mocks de subscription (fechas, status, etc.)
5. Revisar tests de integración y añadir payloads reales o mocks más completos

---

### 3. `tests/unit/routes/admin-plan-limits.test.js`

- **Estado**: 1/12 tests pasando
- **Problema principal**: Middleware `isAdminMiddleware` retorna 403 Forbidden

**Problemas identificados:**

- `NODE_ENV='test'` y token `mock-admin-token-for-testing` no están siendo reconocidos correctamente
- Mocks de Supabase (`supabaseServiceClient`, `getUserFromToken`) no están funcionando
- Mocks de middleware (`isAdminMiddleware`, `csrf`, `adminRateLimiter`) necesitan revisión
- Orden de carga de módulos puede estar afectando los mocks

**Acciones necesarias:**

1. Revisar implementación de `isAdminMiddleware` para entender el bypass de test
2. Verificar que `NODE_ENV='test'` se establece ANTES de cualquier import
3. Ajustar mocks de Supabase para que coincidan con el comportamiento real
4. Considerar mockear directamente los middlewares en lugar de usar el bypass
5. Verificar orden de imports y mocks en Jest

---

## Plan de Acción

### Fase 1: Investigación

1. Leer código fuente completo de cada servicio/ruta problemático
2. Entender flujos reales y dependencias
3. Identificar qué mocks son realmente necesarios

### Fase 2: Ajuste de Mocks

1. Crear mocks que coincidan exactamente con el comportamiento real
2. Asegurar que todos los mocks están en el lugar correcto (antes de imports)
3. Verificar que los mocks cubren todos los casos de uso

### Fase 3: Validación

1. Ejecutar tests individualmente para debugging
2. Verificar que todos los tests pasan
3. Verificar coverage >=90%
4. Ejecutar suite completa para asegurar no hay regresiones

---

## Referencias

- Issue original: #485
- Epic: #480
- Plan original: `docs/plan/issue-485.md`

---

## Notas

- Estos tests requieren investigación más profunda del código fuente
- Los mocks deben coincidir exactamente con el comportamiento real
- Algunos tests pueden requerir ajustes en el código fuente si los mocks son demasiado complejos
