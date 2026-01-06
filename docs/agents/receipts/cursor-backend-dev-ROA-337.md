# Backend Dev Receipt - ROA-337

**Agent:** BackendDev  
**Issue:** ROA-337 - Auth Password Recovery (Missing `/update-password` endpoint)  
**Date:** 2026-01-05  
**Status:** ✅ Completed

---

## Summary

Implementado endpoint faltante `POST /api/v2/auth/update-password` para completar el flujo de password recovery. El servicio `authService.updatePassword()` ya existía, pero faltaba el endpoint HTTP en las rutas.

---

## Changes Made

### 1. Implementación del Endpoint

**Archivo:** `apps/backend-v2/src/routes/auth.ts`

**Endpoint agregado:**
- `POST /api/v2/auth/update-password`

**Características:**
- Rate limiting: `rateLimitByType('password_recovery')` (compartido con `/password-recovery`)
- Feature flag check: `auth_enable_password_recovery` (fail-closed)
- Policy gate (A3): `checkAuthPolicy()` con action `update_password`
- Validaciones:
  - `access_token` requerido (string no vacío)
  - `password` requerido (8-128 caracteres)
- Error handling con `sendAuthError()` y `AuthError`
- Analytics tracking (delegado al servicio)

**Contrato de Request:**
```typescript
{
  access_token: string;  // Token de recuperación del email
  password: string;      // Nueva contraseña (8-128 caracteres)
}
```

**Contrato de Response (200 OK):**
```typescript
{
  success: true,
  message: "Password updated successfully. You can now login with your new password."
}
```

**Errores contractuales:**
- `400 BAD_REQUEST` - `POLICY_INVALID_REQUEST` (validación falla)
- `401 UNAUTHORIZED` - `TOKEN_INVALID` (token inválido/expirado)
- `403 FORBIDDEN` - `AUTH_DISABLED` (feature flag OFF o policy gate bloqueó)
- `429 TOO_MANY_REQUESTS` - `POLICY_RATE_LIMITED` (rate limit excedido)
- `500 INTERNAL_SERVER_ERROR` - Errores técnicos

### 2. Tests Agregados

**Archivo:** `apps/backend-v2/tests/flow/auth-http.endpoints.test.ts`

**Tests implementados (9 casos):**

**Password Recovery:**
1. ✅ Valida email requerido (400)
2. ✅ Responde 200 en éxito (anti-enumeration)

**Update Password:**
3. ✅ Valida `access_token` requerido (400)
4. ✅ Valida `password` requerido (400)
5. ✅ Valida password mínimo 8 caracteres (400)
6. ✅ Valida password máximo 128 caracteres (400)
7. ✅ Responde 200 en éxito con token válido
8. ✅ Mapea `TOKEN_INVALID` cuando token es inválido (401)
9. ✅ Mapea `AUTH_UNKNOWN` en errores técnicos (500)

**Mocks agregados:**
- `authService.requestPasswordRecovery` - Mock del servicio de password recovery
- `authService.updatePassword` - Mock del servicio de actualización de contraseña
- `rateLimitByType` - Mock del middleware de rate limiting
- `checkAuthPolicy` - Mock del policy gate (ya existía)

**Resultado:** 27/27 tests pasando

---

## Security & Best Practices

### ✅ Implementado

1. **No PII Leaking:**
   - Passwords **NUNCA** se loggean
   - Tokens **NO** se exponen en logs
   - Solo se usan request_ids para tracking

2. **Token Security:**
   - Tokens validados por `authService.updatePassword()` usando Supabase
   - Tokens de un solo uso (Supabase los invalida automáticamente)
   - Tokens expiran después de 1 hora

3. **Rate Limiting:**
   - Compartido con `/password-recovery` (3 intentos / 1 hora)
   - Middleware `rateLimitByType('password_recovery')`

4. **Feature Flags:**
   - Fail-closed: Si `auth_enable_password_recovery` no se puede cargar, bloquear
   - No env var fallback (solo SSOT)

5. **Error Handling:**
   - Mensajes genéricos (no revelar detalles técnicos)
   - Usar AuthError + error taxonomy
   - Request ID para tracking

6. **Input Validation:**
   - `access_token`: String no vacío, no null
   - `password`: 8-128 caracteres (mismo contrato que registro)

### ⚠️ Considerations

- El endpoint depende de que Supabase esté configurado correctamente
- Los tokens expiran después de 1 hora (configurable en Supabase)
- Rate limiting compartido con `/password-recovery` (puede afectar UX si se excede)

---

## Testing Results

### Unit/Flow Tests

```bash
cd apps/backend-v2 && npm test -- tests/flow/auth-http.endpoints.test.ts
```

**Resultado:** ✅ 27/27 tests pasando

**Nuevos tests:** 9 casos agregados para password recovery endpoints

### Coverage

**Archivo modificado:** `apps/backend-v2/src/routes/auth.ts`

**Coverage:** 55.55% statements (razonable para tests de flow)

**Nota:** Los tests de flow cubren el wiring HTTP (routes + middleware), no la lógica de negocio (que ya está testeada en tests unitarios de `authService`).

### Validation Scripts v2

```bash
node scripts/validate-v2-doc-paths.js --ci        # ✅ PASSED
node scripts/validate-ssot-health.js --ci         # ✅ PASSED (Health: 100/100)
node scripts/check-system-map-drift.js --ci       # ✅ PASSED
node scripts/validate-strong-concepts.js --ci     # ✅ PASSED
```

**Resultado:** ✅ Todos los validadores v2 pasaron

---

## Documentation

### Nodo Actualizado

**Nodo:** `docs/nodes-v2/auth/password-recovery.md`

**Secciones relevantes:**
- Líneas 110-183: Contrato completo del endpoint `/update-password`
- Líneas 24-107: Contrato del endpoint `/password-recovery` (ya existente)
- Líneas 186-222: Error codes contractuales
- Líneas 226-258: Feature flag behavior
- Líneas 260-305: Rate limiting contractual
- Líneas 373-422: Token security contractual

**Nota:** La documentación ya existía (creada en ROA-379/B1), solo faltaba la implementación del endpoint.

### Plan de Implementación

**Documento:** `docs/plan/issue-ROA-337.md`

**Contenido:**
- Problema identificado: Endpoint faltante
- Estado actual del código
- Acceptance criteria (3 ACs)
- Pasos de implementación (4 pasos)
- Referencias a documentación y issues relacionadas

---

## Integration Points

### A3 Policy Gate

El endpoint usa `checkAuthPolicy()` con action `update_password`:

```typescript
const policyResult = await checkAuthPolicy({
  action: 'update_password',
  ip,
  userAgent
});
```

**Behavior:** Si policy gate bloquea → `AUTH_DISABLED` (403)

### A4 Rate Limiting

El endpoint usa rate limiting compartido con `/password-recovery`:

```typescript
router.post(
  '/update-password',
  rateLimitByType('password_recovery'),  // 3 intentos / 1 hora
  async (req, res) => { ... }
);
```

**Behavior:** Si rate limit excedido → `POLICY_RATE_LIMITED` (429) con `Retry-After` header

### Feature Flags

El endpoint verifica `auth_enable_password_recovery` antes de procesar:

```typescript
await isAuthEndpointEnabled(
  'auth_enable_password_recovery',
  'auth_enable_password_recovery'
);
```

**Behavior:** Si flag OFF → `AUTH_DISABLED` (403)

### Auth Service

El endpoint delega la lógica a `authService.updatePassword()`:

```typescript
const result = await authService.updatePassword(access_token, password);
```

**Service behavior:**
- Valida token con Supabase (`getUser()`)
- Actualiza contraseña con Supabase Admin API (`updateUserById()`)
- Invalida token automáticamente (Supabase)
- Trackea analytics (éxito/error)

---

## Guardrails Followed

### ✅ Verificado

1. **No IDs legacy** - Usado solo `auth` node (v2)
2. **Symmetry enforced** - System-map-v2 sin cambios (endpoint ya estaba en spec)
3. **Subnodos presentes** - Nodo `auth/password-recovery.md` existe
4. **No invenciones** - Todos los valores vienen de SSOT/nodo
5. **No TBD** - No se introdujeron valores TBD
6. **Strong/Soft respetados** - No se duplicaron Strong Concepts
7. **IDs válidos** - Solo IDs de system-map-v2.yaml

### ✅ Scripts de Validación

- `validate-v2-doc-paths.js` - ✅ PASSED
- `validate-ssot-health.js` - ✅ PASSED (Health: 100/100)
- `check-system-map-drift.js` - ✅ PASSED
- `validate-strong-concepts.js` - ✅ PASSED

---

## Known Issues

### ⚠️ Amplitude Dependency

**Issue:** 2 tests failing en backend-v2 por falta de `@amplitude/analytics-node`

**Archivos afectados:**
- `tests/unit/routes/authHealthEndpoint.test.ts`
- `tests/unit/services/authObservabilityService.test.ts`

**Causa:** Dependencia faltante en `package.json` de backend-v2

**Impacto:** NO afecta a los tests de ROA-337 (27/27 pasando)

**Nota:** Este problema es pre-existente, no introducido por ROA-337

---

## References

**Issues Relacionadas:**
- ROA-379 (B1) - Password Recovery Backend v2 (implementación inicial del servicio)
- ROA-382 (B4) - Password Recovery Tests v2 (tests del servicio)
- ROA-383 - Password Recovery Documentation v2

**Documentación:**
- `docs/nodes-v2/auth/password-recovery.md` - Contrato completo
- `docs/nodes-v2/auth/overview.md` - Overview del nodo auth
- `docs/nodes-v2/auth/rate-limiting.md` - Rate limiting v2
- `docs/nodes-v2/auth/error-taxonomy.md` - Códigos de error
- `docs/SSOT-V2.md` - Section 12.4 (Rate Limiting), Section 15 (Feature Flags)

**Plan:**
- `docs/plan/issue-ROA-337.md` - Plan de implementación completo

---

## Artifacts

**Archivos modificados:**
- `apps/backend-v2/src/routes/auth.ts` - Endpoint `/update-password` agregado
- `apps/backend-v2/tests/flow/auth-http.endpoints.test.ts` - 9 tests agregados

**Archivos creados:**
- `docs/plan/issue-ROA-337.md` - Plan de implementación
- `docs/agents/receipts/cursor-backend-dev-ROA-337.md` - Este receipt

**No modificados:**
- `apps/backend-v2/src/services/authService.ts` - Servicio ya existía
- `docs/nodes-v2/auth/password-recovery.md` - Documentación ya existía
- `docs/system-map-v2.yaml` - Sin cambios necesarios

---

## Completion Checklist

- [x] Endpoint `/update-password` implementado según contrato
- [x] Tests del endpoint pasando (9 casos)
- [x] Tests de password recovery agregados (2 casos)
- [x] Validadores v2 pasando sin errores
- [x] Mocks agregados (rate limiting, services)
- [x] Zero PII leaking (passwords, tokens no loggeados)
- [x] Plan de implementación documentado
- [x] Receipt generado

---

**Última actualización:** 2026-01-05  
**Status:** ✅ Completed

