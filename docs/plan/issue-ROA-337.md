# Plan de Implementación - ROA-337: Auth Password Recovery

**Issue:** ROA-337  
**Título:** Auth - Password Recovery (Missing `/update-password` endpoint)  
**Fecha:** 2026-01-05  
**Estado:** In Progress

---

## Problema Identificado

El sistema de password recovery está **parcialmente implementado**:

✅ **Implementado:**
- Endpoint `POST /api/v2/auth/password-recovery` - Solicita email de recuperación
- Servicio `authService.updatePassword()` - Lógica de actualización de contraseña
- Tests para `requestPasswordRecovery()`
- Documentación completa en `docs/nodes-v2/auth/password-recovery.md`

❌ **Faltante:**
- **Endpoint `POST /api/v2/auth/update-password`** - Actualiza contraseña con token
- Tests para el endpoint HTTP `/update-password`
- Validación end-to-end del flujo completo

---

## Estado Actual

### Archivos Existentes

**Rutas:**
- `apps/backend-v2/src/routes/auth.ts` - Contiene `/password-recovery` pero NO `/update-password`

**Servicios:**
- `apps/backend-v2/src/services/authService.ts` - Método `updatePassword()` implementado (líneas 831-918)

**Tests:**
- `apps/backend-v2/tests/unit/services/authService-passwordRecovery.test.ts` - Tests del servicio
- `apps/backend-v2/tests/integration/auth/password-recovery.test.ts` - Tests de integración

**Documentación:**
- `docs/nodes-v2/auth/password-recovery.md` - Contrato completo del endpoint (líneas 110-183)

---

## Acceptance Criteria

### AC1: Endpoint `/update-password` Implementado

**Endpoint:** `POST /api/v2/auth/update-password`

**Request Contract:**
```typescript
{
  access_token: string;  // Token de recuperación del email
  password: string;      // Nueva contraseña (8-128 caracteres)
}
```

**Response Success (200):**
```typescript
{
  success: true,
  message: "Password updated successfully. You can now login with your new password."
}
```

**Response Error:**
- `400 BAD_REQUEST` - `POLICY_INVALID_REQUEST` (validación falla)
- `401 UNAUTHORIZED` - `TOKEN_INVALID` (token inválido/expirado)
- `403 FORBIDDEN` - `AUTH_DISABLED` (feature flag OFF)
- `429 TOO_MANY_REQUESTS` - `POLICY_RATE_LIMITED` (rate limit excedido)
- `500 INTERNAL_SERVER_ERROR` - Errores técnicos

**Validaciones (MUST):**
1. `access_token` - String no vacío, no null
2. `password` - String, 8-128 caracteres
3. Token válido y no expirado (usando `supabase.auth.getUser()`)
4. Usuario existe

**Middleware:**
- `rateLimitByType('password_recovery')` - Rate limiting compartido con `/password-recovery`
- `isAuthEndpointEnabled('auth_enable_password_recovery')` - Feature flag check
- `checkAuthPolicy()` - Policy gate (A3)

### AC2: Tests del Endpoint

**Tests HTTP (Flow):**
- ✅ Password update exitoso con token válido
- ✅ Error `TOKEN_INVALID` si token expirado
- ✅ Error `TOKEN_INVALID` si token inválido
- ✅ Error `POLICY_INVALID_REQUEST` si password < 8 caracteres
- ✅ Error `POLICY_INVALID_REQUEST` si password > 128 caracteres
- ✅ Error `AUTH_DISABLED` si feature flag OFF
- ✅ Error `POLICY_RATE_LIMITED` si rate limit excedido
- ✅ Analytics tracking (éxito y error)

**Ubicación sugerida:**
- `apps/backend-v2/tests/flow/auth-http.endpoints.test.ts` - Agregar casos para `/update-password`

### AC3: Validación de Integración

- ✅ Tests pasando 100%
- ✅ Validadores v2 pasando (sin drift, strong concepts OK)
- ✅ Coverage >=90%
- ✅ Nodo `docs/nodes-v2/auth/password-recovery.md` actualizado si es necesario

---

## Pasos de Implementación

### PASO 1: Implementar Endpoint `/update-password`

**Archivo:** `apps/backend-v2/src/routes/auth.ts`

**Código a agregar:**
```typescript
/**
 * POST /api/v2/auth/update-password
 * Actualiza contraseña usando token de recuperación del email
 * Rate limited: 3 intentos en 1 hora (compartido con /password-recovery)
 */
router.post(
  '/update-password',
  rateLimitByType('password_recovery'),
  async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || null;
    const request_id = getRequestId(req);

    try {
      // Feature flag check (fail-closed)
      await isAuthEndpointEnabled(
        'auth_enable_password_recovery',
        'auth_enable_password_recovery'
      ).catch((err) => {
        const context = createAuthContext(req, {
          flow: 'update_password',
          request_id
        });
        logFeatureDisabled(context, 'auth_enable_password_recovery', 'feature_disabled');
        throw err;
      });

      const { access_token, password } = req.body;

      // Validación de input
      if (!access_token || typeof access_token !== 'string') {
        return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
          log: { policy: 'validation:update_password' }
        });
      }

      if (!password || typeof password !== 'string' || password.length < 8 || password.length > 128) {
        return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST), {
          log: { policy: 'validation:update_password' }
        });
      }

      // A3 POLICY GATE: Check policies
      const policyResult = await checkAuthPolicy({
        action: 'update_password',
        ip,
        userAgent
      });

      if (!policyResult.allowed) {
        logger.warn('AuthPolicyGate blocked update_password', {
          policy: policyResult.policy,
          reason: policyResult.reason
        });

        return sendAuthError(req, res, new AuthError(AUTH_ERROR_CODES.AUTH_DISABLED), {
          log: { policy: `auth_policy_gate:${policyResult.policy}` }
        });
      }

      // Llamar servicio
      const result = await authService.updatePassword(access_token, password);

      res.json({
        success: true,
        message: result.message
      });
      return;
    } catch (error) {
      return sendAuthError(req, res, error, { log: { policy: 'update_password' } });
    }
  }
);
```

**Ubicación:** Después del endpoint `/password-recovery` (línea ~455)

### PASO 2: Agregar Tests para `/update-password`

**Archivo:** `apps/backend-v2/tests/flow/auth-http.endpoints.test.ts`

**Casos de prueba:**
1. Success: Password update con token válido
2. Error: Token inválido → `TOKEN_INVALID`
3. Error: Token expirado → `TOKEN_INVALID`
4. Error: Password < 8 caracteres → `POLICY_INVALID_REQUEST`
5. Error: Password > 128 caracteres → `POLICY_INVALID_REQUEST`
6. Error: Feature flag OFF → `AUTH_DISABLED`
7. Error: Rate limit excedido → `POLICY_RATE_LIMITED`
8. Analytics: Verificar eventos trackeados

**Mockeado:**
- Supabase Auth (getUser, updateUserById)
- Rate limiting (test con/sin rate limit)
- Feature flags (test ON/OFF)
- Analytics (verificar tracking)

### PASO 3: Validar con Scripts v2

```bash
# 1. Validar paths de documentación
node scripts/validate-v2-doc-paths.js --ci

# 2. Validar SSOT health
node scripts/validate-ssot-health.js --ci

# 3. Validar drift de system-map
node scripts/check-system-map-drift.js --ci

# 4. Validar strong concepts
node scripts/validate-strong-concepts.js --ci
```

### PASO 4: Ejecutar Tests

```bash
# Tests específicos
npm test -- apps/backend-v2/tests/flow/auth-http.endpoints.test.ts

# Coverage
npm run test:coverage -- apps/backend-v2/tests/flow/auth-http.endpoints.test.ts

# Integration tests
npm test -- apps/backend-v2/tests/integration/auth/password-recovery.test.ts
```

**Meta:** 100% tests passing, coverage >=90%

---

## Agentes a Usar

**BackendDev:**
- Implementación del endpoint `/update-password`
- Validaciones de input
- Error handling

**TestEngineer:**
- Tests HTTP para el endpoint
- Coverage verification
- Integration tests

**Guardian:**
- Validación de security (no PII leaking)
- Validación de contratos (SSOT compliance)
- Validación de nodos GDD

---

## Archivos Afectados

**Modificar:**
- `apps/backend-v2/src/routes/auth.ts` - Agregar endpoint `/update-password`
- `apps/backend-v2/tests/flow/auth-http.endpoints.test.ts` - Agregar tests

**Leer (Contexto):**
- `docs/nodes-v2/auth/password-recovery.md` - Contrato del endpoint
- `apps/backend-v2/src/services/authService.ts` - Servicio `updatePassword()`
- `apps/backend-v2/tests/integration/auth/password-recovery.test.ts` - Tests existentes

**Validar:**
- `docs/SSOT-V2.md` - Verificar compliance
- `docs/system-map-v2.yaml` - Verificar nodo auth

---

## Validación Requerida

### Pre-Commit

- ✅ Tests pasando 100%
- ✅ Coverage >=90% en archivos modificados
- ✅ Linter pasando (sin warnings)
- ✅ No console.logs en código de producción

### Pre-PR

- ✅ Validadores v2 pasando:
  - `validate-v2-doc-paths.js --ci`
  - `validate-ssot-health.js --ci`
  - `check-system-map-drift.js --ci`
  - `validate-strong-concepts.js --ci`
- ✅ CodeRabbit = 0 comentarios
- ✅ Receipts generados (BackendDev, TestEngineer)
- ✅ Documentation actualizada si es necesario

### Criterios de Éxito

1. ✅ Endpoint `/update-password` implementado según contrato
2. ✅ Tests del endpoint pasando (8+ casos)
3. ✅ Integration tests actualizados si es necesario
4. ✅ Validadores v2 pasando sin errores
5. ✅ Coverage >=90%
6. ✅ Zero PII leaking (passwords, emails hasheados)
7. ✅ Analytics tracking funcionando

---

## Notas de Seguridad

### Critical Security Requirements

1. **No PII Leaking:**
   - Passwords **MUST NOT** loggearse nunca
   - Tokens **MUST NOT** exponerse en logs
   - Emails **MUST** hashearse con `truncateEmailForLog()`

2. **Token Security:**
   - Tokens validados con `supabase.auth.getUser()`
   - Tokens de un solo uso (Supabase los invalida automáticamente)
   - Tokens expiran después de 1 hora (configurable en Supabase)

3. **Rate Limiting:**
   - Compartido con `/password-recovery` (3 intentos / 1 hora)
   - Bloqueo progresivo (1h → 24h → permanente)

4. **Feature Flags:**
   - Fail-closed (si flag no se puede cargar, bloquear)
   - No env var fallback (solo SSOT)

5. **Error Messages:**
   - Genéricos (no revelar detalles técnicos)
   - Usar error taxonomy (AuthError + slugs)

---

## Referencias

**Documentación:**
- `docs/nodes-v2/auth/password-recovery.md` - Contrato completo
- `docs/nodes-v2/auth/overview.md` - Overview del nodo auth
- `docs/nodes-v2/auth/rate-limiting.md` - Rate limiting v2
- `docs/nodes-v2/auth/error-taxonomy.md` - Códigos de error
- `docs/nodes-v2/auth/security.md` - Seguridad

**Issues Relacionadas:**
- ROA-379 (B1) - Password Recovery Backend v2 (implementación inicial)
- ROA-382 (B4) - Password Recovery Tests v2 (tests del servicio)
- ROA-383 - Password Recovery Documentation v2

**SSOT:**
- `docs/SSOT-V2.md` - Section 12.4 (Rate Limiting), Section 15 (Feature Flags)

---

**Última actualización:** 2026-01-05  
**Status:** In Progress (PASO 1)

