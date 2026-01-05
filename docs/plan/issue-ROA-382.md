# Plan — Issue ROA-382: B4 Password Recovery Tests v2

**Issue:** ROA-382  
**Título:** B4-password-recovery-tests-v2  
**Prioridad:** TBD  
**Labels:** type:backend, area:auth, test:integration  
**Fecha:** 2026-01-04  

---

## Estado Actual

### Contexto

La implementación de password recovery v2 (ROA-379) está completa pero **falta test coverage comprehensivo**. Los tests existentes son:

1. **Backend legacy (v1):** `tests/unit/services/authPasswordRecovery.test.js` - Tests básicos
2. **Backend analytics (B3):** `apps/backend-v2/tests/unit/lib/password-recovery-events.test.ts` - Tests de analytics
3. **E2E legacy:** `tests/e2e/auth-complete-flow.test.js` - Password reset flow (3 tests)

### Gaps Identificados

Según `docs/nodes-v2/auth/password-recovery.md`, faltan tests para:

1. **Integration tests completos** para `/password-recovery` y `/update-password`
2. **Unit tests** para anti-enumeration (email no existe, admin, usuario válido → mismo mensaje)
3. **Unit tests** para rate limiting específico de password recovery
4. **Unit tests** para token validation (expirado, inválido, ya usado)
5. **Unit tests** para feature flags (auth_enable_password_recovery, auth_enable_emails)
6. **Unit tests** para fail-closed semantics
7. **Unit tests** para PII protection en analytics

### Nodos GDD Relevantes

- **auth:** `docs/nodes-v2/auth/password-recovery.md` (contrato completo)
- **testing-v2:** `docs/nodes-v2/13-testing.md` (framework y estructura)

---

## Pasos de Implementación

### Paso 1: Estructura de Tests

**Objetivo:** Crear estructura de directorios para tests v2

**Archivos a crear:**
```
apps/backend-v2/tests/
├── integration/
│   └── auth/
│       └── password-recovery.spec.ts (NUEVO)
└── unit/
    └── services/
        ├── authService-passwordRecovery.spec.ts (NUEVO - anti-enumeration, feature flags)
        └── authService-passwordRecovery.privacy.test.ts (YA EXISTE en otro path - mover si aplica)
```

**Referencia:** SSOT v2 sección 11 (Testing)

**Validación:**
- [ ] Estructura de directorios creada
- [ ] Vitest configurado correctamente en backend-v2

---

### Paso 2: Integration Tests - POST /api/v2/auth/password-recovery

**Objetivo:** Tests de integración completos para password recovery request

**Archivo:** `apps/backend-v2/tests/integration/auth/password-recovery.spec.ts`

**Test Cases (AC del contrato):**

#### Happy Path
1. **✅ Request exitoso con email válido:**
   - Input: `{ email: "user@example.com" }`
   - Expected: `200 OK`, mensaje genérico anti-enumeration
   - Verifica: Email enviado, analytics tracked

2. **✅ Email no existe (anti-enumeration):**
   - Input: `{ email: "nonexistent@example.com" }`
   - Expected: `200 OK`, **mismo mensaje que caso válido**
   - Verifica: NO se envía email, analytics NO trackeado

3. **✅ Email es admin (anti-enumeration):**
   - Input: `{ email: "admin@roastr.ai" }` (role=admin)
   - Expected: `200 OK`, **mismo mensaje que caso válido**
   - Verifica: NO se envía email (admins no pueden usar password recovery)

#### Feature Flags
4. **✅ Feature flag auth_enable_password_recovery=false:**
   - Expected: `403 AUTH_EMAIL_DISABLED`
   - Verifica: NO se procesa request, fail-closed

5. **✅ Feature flag auth_enable_emails=false:**
   - Expected: `403 AUTH_EMAIL_DISABLED`
   - Verifica: NO se envía email, fail-closed incluso si email no existe

#### Rate Limiting
6. **✅ Rate limit excedido (3 intentos / 1 hora):**
   - Hacer 3 requests válidos
   - 4to request Expected: `429 POLICY_RATE_LIMITED`, `Retry-After` header
   - Verifica: Progressive blocking aplicado

#### Validaciones
7. **✅ Email vacío:**
   - Input: `{ email: "" }`
   - Expected: `400 POLICY_INVALID_REQUEST`

8. **✅ Email null/undefined:**
   - Input: `{}`
   - Expected: `400 POLICY_INVALID_REQUEST`

#### Error Handling
9. **✅ Email service falla (provider error):**
   - Mock Resend para fallar
   - Expected: `500 AUTH_EMAIL_SEND_FAILED` o `502 AUTH_EMAIL_PROVIDER_ERROR`
   - Verifica: Analytics tracked con error_slug

10. **✅ DB error:**
    - Mock Supabase para fallar
    - Expected: `500 AUTH_UNKNOWN`
    - Verifica: NO revela si email existe

**Herramientas:**
- Vitest con Supabase Test (BD real con rollback)
- Mocks para Resend email service
- Mocks para SettingsLoader (feature flags)

**Validación:**
- [ ] 10 integration tests pasando
- [ ] Coverage ≥90% en endpoint `/password-recovery`

---

### Paso 3: Integration Tests - POST /api/v2/auth/update-password

**Objetivo:** Tests de integración completos para password update

**Archivo:** `apps/backend-v2/tests/integration/auth/password-recovery.spec.ts` (mismo archivo)

**Test Cases:**

#### Happy Path
11. **✅ Password update exitoso con token válido:**
    - Input: `{ access_token: "valid_token", password: "NewPassword123!" }`
    - Expected: `200 OK`, mensaje de éxito
    - Verifica: Password actualizado, token invalidado

#### Token Validation
12. **✅ Token expirado:**
    - Input: `{ access_token: "expired_token", password: "NewPassword123!" }`
    - Expected: `401 TOKEN_INVALID`, mensaje específico de expiración
    - Verifica: Password NO actualizado

13. **✅ Token inválido:**
    - Input: `{ access_token: "invalid_token", password: "NewPassword123!" }`
    - Expected: `401 TOKEN_INVALID`
    - Verifica: Password NO actualizado

14. **✅ Token ya usado (single-use):**
    - Usar mismo token 2 veces
    - 2da vez Expected: `401 TOKEN_INVALID`

#### Password Validation
15. **✅ Password < 8 caracteres:**
    - Input: `{ access_token: "valid_token", password: "short" }`
    - Expected: `400 POLICY_INVALID_REQUEST`

16. **✅ Password > 128 caracteres:**
    - Input: `{ access_token: "valid_token", password: "a".repeat(129) }`
    - Expected: `400 POLICY_INVALID_REQUEST`

17. **✅ Password null/undefined:**
    - Input: `{ access_token: "valid_token" }`
    - Expected: `400 POLICY_INVALID_REQUEST`

#### Rate Limiting
18. **✅ Rate limit excedido en update-password:**
    - Hacer 3 requests
    - 4to Expected: `429 POLICY_RATE_LIMITED`

**Validación:**
- [ ] 8 integration tests pasando
- [ ] Coverage ≥90% en endpoint `/update-password`

---

### Paso 4: Unit Tests - Anti-Enumeration

**Objetivo:** Verificar contrato crítico de anti-enumeration

**Archivo:** `apps/backend-v2/tests/unit/services/authService-passwordRecovery.spec.ts`

**Test Cases:**

19. **✅ Response message es idéntico (email existe vs no existe):**
    - Verificar que el mensaje es **exactamente** el mismo
    - No depende de timing, longitud, o estructura

20. **✅ Response time es similar (email existe vs no existe):**
    - Timing attack prevention
    - No debe haber diferencia significativa de tiempo

21. **✅ Response message es idéntico (admin vs usuario válido):**
    - Admin no puede usar password recovery
    - Mensaje debe ser **exactamente** el mismo que usuario válido

22. **✅ No se expone información en headers:**
    - Verificar que headers son idénticos
    - No headers custom que revelen información

**Validación:**
- [ ] 4 unit tests pasando
- [ ] Anti-enumeration contract verificado

---

### Paso 5: Unit Tests - Feature Flags & Fail-Closed

**Objetivo:** Verificar fail-closed semantics y feature flag control

**Archivo:** `apps/backend-v2/tests/unit/services/authService-passwordRecovery.spec.ts` (mismo archivo)

**Test Cases:**

23. **✅ Fail-closed cuando SettingsLoader falla:**
    - Mock SettingsLoader para fallar
    - NO hay env var fallback
    - Expected: Bloquear password recovery

24. **✅ Fallback a env var cuando SettingsLoader falla:**
    - Mock SettingsLoader para fallar
    - Env var presente: `AUTH_ENABLE_PASSWORD_RECOVERY=true`
    - Expected: Permitir password recovery

25. **✅ Feature flag OFF incluso si email no existe:**
    - auth_enable_password_recovery=false
    - Email no existe
    - Expected: `403 AUTH_EMAIL_DISABLED` (NO simular éxito)

**Validación:**
- [ ] 3 unit tests pasando
- [ ] Fail-closed semantics verificado

---

### Paso 6: Unit Tests - PII Protection

**Objetivo:** Verificar que NO se loggea PII (GDPR compliance)

**Archivo:** `apps/backend-v2/tests/unit/services/authService-passwordRecovery.privacy.test.ts`

**Test Cases:**

26. **✅ Email hasheado en logs:**
    - Verificar que email se hashea con `truncateEmailForLog()`
    - NO email completo en logs

27. **✅ Password NUNCA en logs:**
    - Verificar que password no aparece en ningún log
    - Ni siquiera hasheado

28. **✅ Token NUNCA en logs:**
    - Verificar que access_token no aparece en logs

29. **✅ IP NO en logs de usuario:**
    - Verificar que IP solo se loggea en contexto de rate limiting
    - NO en logs de usuario

**Validación:**
- [ ] 4 unit tests pasando
- [ ] PII protection verificado (GDPR compliant)

---

### Paso 7: Unit Tests - Analytics Integration

**Objetivo:** Verificar eventos de analytics correctos y graceful degradation

**Archivo:** `apps/backend-v2/tests/unit/services/authService-passwordRecovery.analytics.test.ts`

**Test Cases:**

30. **✅ Evento `auth_password_recovery_request` trackeado (éxito):**
    - Verificar evento con contexto correcto
    - Verificar NO incluye PII

31. **✅ Evento `auth_password_recovery_failed` trackeado (error):**
    - Verificar evento con error_slug
    - Verificar NO incluye PII

32. **✅ Graceful degradation cuando analytics falla:**
    - Mock analytics para fallar
    - Verificar que flujo continúa normalmente
    - Log warning pero NO throw

**Validación:**
- [ ] 3 unit tests pasando
- [ ] Analytics integration verificado

---

### Paso 8: Validación y Test Evidence

**Objetivo:** Ejecutar validadores v2 y generar evidencia

**Comandos:**
```bash
# Tests
npm run test:backend-v2 -- apps/backend-v2/tests/integration/auth/password-recovery.spec.ts
npm run test:backend-v2 -- apps/backend-v2/tests/unit/services/authService-passwordRecovery*

# Coverage
npm run test:coverage -- apps/backend-v2/

# Validadores v2
node scripts/validate-v2-doc-paths.js --ci
node scripts/validate-ssot-health.js --ci
node scripts/check-system-map-drift.js --ci
node scripts/validate-strong-concepts.js --ci
```

**Test Evidence:**
- Generar: `docs/test-evidence/issue-ROA-382/summary.md`
- Incluir:
  - Test count: 32 tests totales
  - Coverage: ≥90% en password-recovery endpoints y services
  - Pass rate: 100%
  - Screenshots de test output

**Receipts:**
- `docs/agents/receipts/ROA-382-TestEngineer.md` (normal receipt)

**Validación:**
- [ ] Tests pasando: 32/32 (100%)
- [ ] Coverage ≥90% en password-recovery
- [ ] Validadores v2 pasando
- [ ] Test evidence generado
- [ ] Receipts generados

---

## Archivos Afectados

### Tests Nuevos (Crear):
```
apps/backend-v2/tests/integration/auth/password-recovery.spec.ts
apps/backend-v2/tests/unit/services/authService-passwordRecovery.spec.ts
apps/backend-v2/tests/unit/services/authService-passwordRecovery.privacy.test.ts
apps/backend-v2/tests/unit/services/authService-passwordRecovery.analytics.test.ts
```

### Documentación (Actualizar):
```
docs/nodes-v2/auth/password-recovery.md (actualizar sección "Tests & Coverage")
docs/test-evidence/issue-ROA-382/summary.md (crear)
docs/agents/receipts/ROA-382-TestEngineer.md (crear)
```

---

## Agentes Relevantes

- **TestEngineer** - Implementación de tests, coverage, validación
- **Guardian** - Validación de seguridad (PII protection, anti-enumeration)

---

## Validación Final

### Pre-Commit Checklist:
- [ ] 32 tests pasando (100%)
- [ ] Coverage ≥90% en password-recovery
- [ ] NO PII en logs (verificado con tests)
- [ ] Anti-enumeration verificado (mismos mensajes)
- [ ] Fail-closed verificado (feature flags OFF)
- [ ] Validadores v2 pasando
- [ ] Test evidence generado
- [ ] Receipts generados
- [ ] Documentación actualizada

### PR Requirements:
- [ ] Título: `test(ROA-382): B4 Password Recovery Tests v2`
- [ ] Tests: 32/32 passing
- [ ] Coverage: ≥90%
- [ ] Receipts: TestEngineer receipt
- [ ] Evidence: Test summary con screenshots

---

**Última actualización:** 2026-01-04  
**Owner:** TestEngineer

