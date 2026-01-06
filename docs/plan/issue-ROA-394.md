# Plan de Implementación - ROA-394: Account Status Policy v2

**Issue:** ROA-394  
**Título:** Account Status Policy v2  
**Fecha:** 2025-01-06  
**Estado:** En progreso

---

## 1. Estado Actual

### Contexto

El **Ingestion Eligibility Gate (IG1)** en `docs/nodes-v2/05-motor-analisis.md` actualmente evalúa 6 políticas antes de permitir ingestion:

1. **UserStatusPolicy** - Usuario activo (no suspendido ni eliminado)
2. **SubscriptionPolicy** - Suscripción activa
3. **TrialPolicy** - Trial válido (si aplica)
4. **CreditPolicy** - Créditos de análisis disponibles
5. **FeatureFlagPolicy** - Feature flag `ingestion_enabled` activado
6. **RateLimitPolicy** - Límites de rate no excedidos

### Problema

**Falta evaluar el estado de la cuenta conectada (connected_account)** antes de intentar ingestion.

Actualmente, el sistema solo verifica:
- ✅ Si el **usuario** está activo (UserStatusPolicy)
- ❌ Si la **cuenta conectada específica** (X/YouTube) está activa y válida

**Casos no cubiertos:**
- Cuenta conectada desconectada (`connection_status != 'connected'`)
- Cuenta conectada con errores de OAuth (`oauth_error != null`)
- Cuenta conectada eliminada o suspendida
- Cuenta conectada con tokens inválidos/expirados

**Consecuencias:**
- Workers intentan fetch con cuentas inválidas → error innecesario
- Consumo de recursos en intentos fallidos
- Falta de observabilidad sobre por qué falló la ingestion
- Experiencia de usuario degradada (no se muestra claramente que la cuenta está desconectada)

---

## 2. Objetivo

Crear **AccountStatusPolicy** para IG1 que verifique el estado de la cuenta conectada antes de permitir ingestion.

### Acceptance Criteria (inferidos)

1. ✅ Crear `AccountStatusPolicy` en `src/services/ingestion/policies/`
2. ✅ Integrar en `IngestionEligibilityGate` como 7ª policy (después de UserStatusPolicy)
3. ✅ Verificar que `connected_accounts.connection_status = 'connected'`
4. ✅ Verificar que `connected_accounts.oauth_error IS NULL`
5. ✅ Fail-safe: bloquear si no se puede verificar el estado
6. ✅ Emitir evento `ingestion_blocked` cuando se bloquee por cuenta
7. ✅ Agregar razones específicas:
   - `account_disconnected` (connection_status != 'connected')
   - `account_oauth_error` (oauth_error != null)
   - `account_not_found` (cuenta no existe)
   - `account_status_unknown` (error al verificar)
8. ✅ Tests unitarios con ≥90% coverage
9. ✅ Actualizar documentación en `docs/nodes-v2/05-motor-analisis.md`
10. ✅ Validar con scripts v2

---

## 3. Pasos de Implementación

### 3.1 Crear AccountStatusPolicy

**Archivo:** `src/services/ingestion/policies/AccountStatusPolicy.js`

**Responsabilidades:**
- Verificar existencia de connected_account
- Verificar connection_status = 'connected'
- Verificar oauth_error IS NULL
- Fail-safe en errores de DB
- Logging estructurado sin PII
- Retornar PolicyResult consistente

**Consulta DB:**
```sql
SELECT connection_status, oauth_error
FROM connected_accounts
WHERE user_id = ? AND account_id = ? AND platform = ?
```

**Reglas:**
- `connection_status != 'connected'` → `allowed: false, reason: 'account_disconnected'`
- `oauth_error != null` → `allowed: false, reason: 'account_oauth_error'`
- Cuenta no encontrada → `allowed: false, reason: 'account_not_found'`
- Error de DB → `allowed: false, reason: 'account_status_unknown'` (fail-safe)

### 3.2 Integrar en IngestionEligibilityGate

**Archivo:** `src/services/ingestion/IngestionEligibilityGate.js`

**Cambios:**
- Importar `AccountStatusPolicy`
- Añadir al array de policies **después de UserStatusPolicy** (orden: UserStatus → AccountStatus → Subscription → ...)
- Pasar contexto completo con `accountId` y `platform`

**Orden final de policies:**
1. UserStatusPolicy
2. **AccountStatusPolicy** ← NUEVO
3. SubscriptionPolicy
4. TrialPolicy
5. CreditPolicy
6. FeatureFlagPolicy
7. RateLimitPolicy

### 3.3 Actualizar Tabla de Razones de Bloqueo

**Archivo:** `docs/nodes-v2/05-motor-analisis.md`

**Añadir a tabla de razones:**

| Reason | Policy | Retryable | Descripción |
|--------|--------|-----------|-------------|
| `account_disconnected` | AccountStatusPolicy | No | Cuenta conectada desconectada |
| `account_oauth_error` | AccountStatusPolicy | No | Cuenta con error de OAuth |
| `account_not_found` | AccountStatusPolicy | No | Cuenta no existe en DB |
| `account_status_unknown` | AccountStatusPolicy | No | Error al verificar estado |

**Actualizar lista de policies evaluadas:**
- Añadir AccountStatusPolicy en posición 2

### 3.4 Tests

**Archivo:** `tests/services/ingestion/policies/AccountStatusPolicy.test.js`

**Casos de prueba:**
1. ✅ Cuenta conectada y válida → allowed: true
2. ✅ Cuenta desconectada → blocked con `account_disconnected`
3. ✅ Cuenta con oauth_error → blocked con `account_oauth_error`
4. ✅ Cuenta no encontrada → blocked con `account_not_found`
5. ✅ Error de DB → blocked con `account_status_unknown` (fail-safe)
6. ✅ Logging sin PII

**Archivo:** `tests/services/ingestion/IngestionEligibilityGate.test.js`

**Actualizar tests existentes:**
- Añadir AccountStatusPolicy al setup de mocks
- Verificar que se evalúa después de UserStatusPolicy
- Verificar que bloquea correctamente cuando corresponde
- Verificar evento `ingestion_blocked` emitido con metadata correcta

### 3.5 Validación v2

**Scripts a ejecutar:**
```bash
node scripts/validate-v2-doc-paths.js --ci
node scripts/validate-ssot-health.js --ci
node scripts/check-system-map-drift.js --ci
node scripts/validate-strong-concepts.js --ci
```

---

## 4. Archivos Afectados

### Nuevos
- `src/services/ingestion/policies/AccountStatusPolicy.js`
- `tests/services/ingestion/policies/AccountStatusPolicy.test.js`

### Modificados
- `src/services/ingestion/IngestionEligibilityGate.js`
- `tests/services/ingestion/IngestionEligibilityGate.test.js`
- `docs/nodes-v2/05-motor-analisis.md`

---

## 5. Agentes Relevantes

### Agents a usar

**Según `detect-triggers.js`:**
- **TestEngineer** - Tests unitarios y coverage
- **Guardian** - Cambios en analysis-engine (nodo crítico)

### Receipts esperados
- `docs/agents/receipts/cursor-test-engineer-[timestamp].md`
- `docs/agents/receipts/cursor-guardian-[timestamp].md`

---

## 6. Dependencias de SSOT

**Referencias SSOT necesarias:**
- `docs/SSOT-V2.md` Sección 2.2: Estados de suscripción (para entender connection_status)
- `docs/SSOT-V2.md` Sección 8: Integraciones (estructura de connected_accounts)

**No se requieren cambios en SSOT** - Esta policy usa datos ya definidos en la estructura de connected_accounts.

---

## 7. Validación Final

### Pre-commit Checklist

- [ ] AccountStatusPolicy implementado y testeado
- [ ] IngestionEligibilityGate integrado
- [ ] Documentación actualizada en motor-analisis.md
- [ ] Tests unitarios ≥90% coverage
- [ ] Tests de integración pasando
- [ ] Scripts v2 pasando sin errores
- [ ] Logging estructurado sin PII
- [ ] Fail-safe verificado
- [ ] Razones de bloqueo documentadas

### Comandos de validación

```bash
# 1. Tests
npm test tests/services/ingestion/policies/AccountStatusPolicy.test.js
npm test tests/services/ingestion/IngestionEligibilityGate.test.js
npm run test:coverage

# 2. Validación v2
node scripts/validate-v2-doc-paths.js --ci
node scripts/validate-ssot-health.js --ci
node scripts/check-system-map-drift.js --ci
node scripts/validate-strong-concepts.js --ci

# 3. Linting
npm run lint
```

---

## 8. Riesgos y Mitigación

### Riesgo 1: Orden de evaluación incorrecto
**Mitigación:** Colocar AccountStatusPolicy después de UserStatusPolicy pero antes de SubscriptionPolicy. Lógica: primero verificamos usuario, luego cuenta específica, luego billing.

### Riesgo 2: Fail-safe demasiado restrictivo
**Mitigación:** Solo bloquear en fail-safe si realmente no podemos verificar. Loggear detalladamente para diagnosticar.

### Riesgo 3: Breaking change en workers existentes
**Mitigación:** No hay breaking change - IG1 ya requiere accountId y platform en contexto. Solo añadimos una policy adicional.

### Riesgo 4: Performance de consulta adicional
**Mitigación:** Consulta simple con índices existentes en connected_accounts (user_id, account_id, platform). Impacto mínimo.

---

## 9. Criterios de Éxito

✅ **Funcional:**
- AccountStatusPolicy bloquea ingestion cuando cuenta está desconectada
- AccountStatusPolicy permite ingestion cuando cuenta está conectada y válida
- Eventos de observabilidad emitidos correctamente

✅ **Calidad:**
- Coverage ≥90% en nuevos archivos
- 0 tests fallando
- 0 comentarios CodeRabbit
- Scripts v2 pasando sin errores

✅ **Documentación:**
- Nodo analysis-engine actualizado con nueva policy
- Razones de bloqueo documentadas
- Plan de implementación completo

---

**Siguiente paso:** Implementar AccountStatusPolicy siguiendo este plan.

