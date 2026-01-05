# ROA-337: Auth Password Recovery - Implementar endpoint `/update-password`

## 📋 Resumen

Implementación del endpoint faltante `POST /api/v2/auth/update-password` para completar el flujo de password recovery. El servicio `authService.updatePassword()` ya existía desde ROA-379 (B1), pero faltaba el endpoint HTTP en las rutas.

## 🎯 Problema Resuelto

**Estado Previo:**
- ✅ Endpoint `POST /api/v2/auth/password-recovery` - Solicita email de recuperación (existe)
- ✅ Servicio `authService.updatePassword()` - Lógica de actualización (existe)
- ❌ Endpoint `POST /api/v2/auth/update-password` - **FALTABA**

**Estado Post-PR:**
- ✅ Endpoint `/update-password` implementado
- ✅ Flujo completo de password recovery funcional end-to-end

## 🚀 Cambios Implementados

### 1. Endpoint `/update-password` (apps/backend-v2/src/routes/auth.ts)

**Request Contract:**
```typescript
POST /api/v2/auth/update-password
{
  access_token: string;  // Token de recuperación del email
  password: string;      // Nueva contraseña (8-128 caracteres)
}
```

**Response Contract (200 OK):**
```typescript
{
  success: true,
  message: "Password updated successfully. You can now login with your new password."
}
```

**Error Responses:**
- `400 BAD_REQUEST` - `POLICY_INVALID_REQUEST` (validación falla)
- `401 UNAUTHORIZED` - `TOKEN_INVALID` (token inválido/expirado)
- `403 FORBIDDEN` - `AUTH_DISABLED` (feature flag OFF)
- `429 TOO_MANY_REQUESTS` - `POLICY_RATE_LIMITED` (rate limit excedido)

**Middleware & Security:**
- Rate limiting: `rateLimitByType('password_recovery')` (3 intentos / 1 hora)
- Feature flag: `auth_enable_password_recovery` (fail-closed)
- Policy gate (A3): `checkAuthPolicy()` con action `update_password`
- Zero PII leaking (passwords/tokens no loggeados)

### 2. Tests (apps/backend-v2/tests/flow/auth-http.endpoints.test.ts)

**9 nuevos casos de prueba:**
1. ✅ Valida `access_token` requerido (400)
2. ✅ Valida `password` requerido (400)
3. ✅ Valida password mínimo 8 caracteres (400)
4. ✅ Valida password máximo 128 caracteres (400)
5. ✅ Responde 200 en éxito con token válido
6. ✅ Mapea `TOKEN_INVALID` cuando token es inválido (401)
7. ✅ Mapea `AUTH_UNKNOWN` en errores técnicos (500)
8. ✅ Password recovery request valida email requerido (400)
9. ✅ Password recovery responde 200 con anti-enumeration

**Mocks agregados:**
- `authService.updatePassword` - Mock del servicio
- `authService.requestPasswordRecovery` - Mock del servicio
- `rateLimitByType` - Mock del middleware

**Resultado:** 27/27 tests pasando

### 3. Documentación

**Plan de implementación:**
- `docs/plan/issue-ROA-337.md` - Plan completo con AC, pasos, validaciones

**Receipt de Agent:**
- `docs/agents/receipts/cursor-backend-dev-ROA-337.md` - Decisiones y guardrails

**Documentación existente (sin cambios):**
- `docs/nodes-v2/auth/password-recovery.md` - Contrato completo del endpoint (ya existía desde ROA-379)

## ✅ Validación

### Tests

```bash
cd apps/backend-v2 && npm test -- tests/flow/auth-http.endpoints.test.ts
```

**Resultado:** ✅ 27/27 tests pasando

### Scripts v2

```bash
node scripts/validate-v2-doc-paths.js --ci        # ✅ PASSED
node scripts/validate-ssot-health.js --ci         # ✅ PASSED (Health: 100/100)
node scripts/check-system-map-drift.js --ci       # ✅ PASSED
node scripts/validate-strong-concepts.js --ci     # ✅ PASSED
```

**Resultado:** ✅ Todos los validadores v2 pasando

## 🔐 Seguridad

1. **Token Security:**
   - Tokens validados por Supabase (`getUser()`)
   - Tokens de un solo uso (Supabase los invalida automáticamente)
   - Tokens expiran después de 1 hora

2. **No PII Leaking:**
   - Passwords **NUNCA** se loggean
   - Tokens **NO** se exponen en logs
   - Solo request_ids para tracking

3. **Rate Limiting:**
   - 3 intentos por hora (compartido con `/password-recovery`)
   - Bloqueo progresivo (1h → 24h → permanente)

4. **Feature Flags:**
   - Fail-closed: Si flag no se puede cargar, bloquear
   - No env var fallback (solo SSOT)

## 🔗 Issues Relacionadas

- Closes ROA-337
- Complements ROA-379 (B1 - Password Recovery Backend v2)
- Complements ROA-382 (B4 - Password Recovery Tests v2)
- Related to ROA-383 (Password Recovery Documentation v2)

## 📊 Archivos Modificados

**Implementación:**
- `apps/backend-v2/src/routes/auth.ts` - Endpoint `/update-password` agregado (+98 líneas)

**Tests:**
- `apps/backend-v2/tests/flow/auth-http.endpoints.test.ts` - 9 tests agregados (+162 líneas)

**Documentación:**
- `docs/plan/issue-ROA-337.md` - Plan de implementación (nuevo)
- `docs/agents/receipts/cursor-backend-dev-ROA-337.md` - Receipt (nuevo)

## 🎯 Checklist de Merge

- [x] Tests pasando 100% (27/27)
- [x] Validadores v2 pasando (4/4)
- [x] Coverage adecuado (55.55% en routes/auth.ts)
- [x] Zero PII leaking verificado
- [x] Rate limiting implementado
- [x] Feature flags respetados (fail-closed)
- [x] Plan de implementación documentado
- [x] Receipt de BackendDev generado
- [x] Commit con mensaje estándar
- [x] Sin conflictos con main

## 🚨 Notas

### ⚠️ Amplitude Dependency (Pre-existente)

2 tests failing en backend-v2 por falta de `@amplitude/analytics-node`:
- `tests/unit/routes/authHealthEndpoint.test.ts`
- `tests/unit/services/authObservabilityService.test.ts`

**Impacto:** NO afecta a los tests de ROA-337 (27/27 pasando)

**Nota:** Este problema es pre-existente, no introducido por esta PR

---

**Ready to Merge:** ✅  
**Quality:** 0 CodeRabbit comments pending  
**Tests:** 27/27 passing  
**Validation:** 4/4 scripts passing

