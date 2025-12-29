# ROA-406: A2 Auth Feature Flags Integration v2 (Clean Implementation)

## 🎯 Objetivo

Integrar feature flags fail-closed para todos los endpoints de autenticación según el contrato A2, usando SSOT v2 como única fuente de verdad.

## ✅ Implementación Completa

### 1. SSOT v2 actualizado (`docs/SSOT-V2.md`)

Añadidos 4 auth feature flags oficiales:

```typescript
type FeatureFlagKey =
  // ... existing flags ...
  | 'auth_enable_login'         // Habilita POST /api/v2/auth/login
  | 'auth_enable_register'      // Habilita POST /api/v2/auth/register
  | 'auth_enable_magic_link'    // Habilita POST /api/v2/auth/magic-link
  | 'auth_enable_password_recovery'; // Habilita POST /api/v2/auth/password-recovery
```

**Características:**
- Defaults fail-closed (false)
- NO env var fallbacks
- Documentación completa en secciones 3.2 y 3.3

### 2. AuthFlags Loader (`apps/backend-v2/src/lib/authFlags.ts`)

Módulo dedicado para cargar auth feature flags:

```typescript
export async function loadAuthFlags(): Promise<AuthFlags>;
export async function isAuthEndpointEnabled(
  flag: keyof AuthFlags,
  policy: string
): Promise<boolean>;
```

**Behavior:**
- Fail-closed: Si SettingsLoader falla → defaults false
- NO usa env vars como fallback
- Lanza `AuthError` con código `AUTH_DISABLED` si endpoint deshabilitado

### 3. Endpoints Gated (`apps/backend-v2/src/routes/auth.ts`)

Todos los endpoints sensibles ahora validanfeature flags:

- `POST /api/v2/auth/login` → `auth_enable_login`
- `POST /api/v2/auth/register` → `auth_enable_register`
- `POST /api/v2/auth/magic-link` → `auth_enable_magic_link`
- `POST /api/v2/auth/password-recovery` → `auth_enable_password_recovery` **(NUEVO)**

**Workflow:**
1. Validaciones de input
2. Check de feature flag (fail-closed)
3. AuthPolicyGate (ROA-407)
4. Business logic

### 4. AuthService actualizado (`apps/backend-v2/src/services/authService.ts`)

**Método añadido:**

```typescript
async requestPasswordRecovery(params: PasswordRecoveryParams): Promise<{
  success: boolean;
  message: string;
}>;
```

**Características:**
- Anti-enumeration (no revela si email existe)
- Solo para role=user (admin/superadmin no pueden usar password recovery)
- Rate limiting integrado

### 5. Tests completos (`apps/backend-v2/tests/`)

**Unitarios** (`tests/unit/lib/authFlags.test.ts`):
- 8 tests, 100% pasando
- Valida fail-closed behavior
- Valida NO env var fallback
- Valida AuthError cuando disabled

**HTTP** (`tests/flow/auth-register.endpoint.test.ts`, `tests/flow/auth-http.endpoints.test.ts`):
- 27 tests, 100% pasando
- Valida todos los endpoints gated
- Mocks actualizados a feature flags v2

**Limpieza:**
- Eliminados 2 tests legacy (`authService-login-magiclink`, `authService-session`)
- Reflejaban comportamiento obsoleto (feature flag check en service)

## 📊 Resultados

### Tests ROA-406
```
✅ tests/unit/lib/authFlags.test.ts (8/8 pasando)
✅ tests/flow/auth-register.endpoint.test.ts (9/9 pasando)
✅ tests/flow/auth-http.endpoints.test.ts (18/18 pasando)

Total: 35/35 tests de ROA-406 pasando (100%)
```

### Cumple Contrato A2
- ✅ Fail-closed defaults (all false)
- ✅ Single source of truth: SettingsLoader v2
- ✅ NO env var fallbacks
- ✅ Todos los auth flows gated
- ✅ Tests completos y pasando

## 🔍 Cambios por Archivo

| Archivo | Tipo | Líneas | Descripción |
|---------|------|--------|-------------|
| `docs/SSOT-V2.md` | Modified | +20 | Auth feature flags documentados |
| `apps/backend-v2/src/lib/authFlags.ts` | **New** | +95 | AuthFlags loader fail-closed |
| `apps/backend-v2/src/routes/auth.ts` | Modified | +62 | 4 endpoints gated + `/password-recovery` |
| `apps/backend-v2/src/services/authService.ts` | Modified | +93 | `requestPasswordRecovery()` método |
| `apps/backend-v2/tests/unit/lib/authFlags.test.ts` | **New** | +180 | Tests unitarios authFlags |
| `apps/backend-v2/tests/flow/auth-http.endpoints.test.ts` | Modified | +8 | Mocks v2 |
| `apps/backend-v2/tests/flow/auth-register.endpoint.test.ts` | Modified | +12 | Flags v2 |
| `apps/backend-v2/tests/unit/services/authService-login-magiclink.test.ts` | **Deleted** | -170 | Tests legacy obsoletos |
| `apps/backend-v2/tests/unit/services/authService-session.test.ts` | **Deleted** | -168 | Tests legacy obsoletos |

**Net:** +450 líneas, -334 líneas

## 🚀 Próximos Pasos

1. **Code review** - Revisar implementación completa
2. **Merge to main** - Una vez aprobado

## 📝 Notas

- **Tests failing pre-existentes NO son de ROA-406:**
  - `authPolicyGate.test.ts` (2 tests) - ROA-407
  - `auditService.test.ts` - Módulo no implementado
  - `auth-login.flow.test.ts` (1 test) - Rate limiting pre-existente

- **Historial limpio:**
  - 1 commit único
  - Sin conflictos con main
  - Branch desde main actualizado

---

**Issue:** Linear [ROA-406](https://linear.app/roastrai/issue/ROA-406)
**Contract:** A2 Auth Feature Flags Integration v2
**Tests:** 35/35 passing (100%)
