# ROA-356: Analytics Identity Sync (V2)

## Objetivo

Sincronizar correctamente la identidad del usuario con Amplitude en V2, asegurando que:
- El userId se establece exactamente una vez por sesión tras login exitoso
- Las propiedades del usuario se sincronizan con valores reales del backend
- La identidad se limpia correctamente en logout/sesión expirada
- No hay contaminación de sesiones
- Cumple con GDPR

## Implementación

### Frontend

#### 1. Login exitoso

**Ubicación:** `frontend/src/lib/auth-context.tsx`

Tras login exitoso, se llama:
```typescript
// 1. Set user ID (exactamente una vez por sesión)
setUserId(response.user.id);

// 2. Set user properties después de setUserId
const userProperties = buildUserProperties(response.user);
setUserProperties(userProperties);
```

#### 2. Propiedades del usuario

**Función:** `buildUserProperties(user: User): UserProperties`

Propiedades sincronizadas:
- `plan`: Del backend (user.plan)
- `role`: Inferido de `is_admin` ('admin' o 'user')
- `has_roastr_persona`: Calculado de `lo_que_me_define_encrypted` del backend
- `is_admin`: Del backend (user.is_admin)
- `is_trial`: Inferido del nombre del plan (contiene 'trial')
- `auth_provider`: Por defecto 'email_password' (puede extenderse para OAuth, magic link)
- `locale`: Detectado del navegador (navigator.language)

**Reglas:**
- ❌ NO email
- ❌ NO tokens
- ❌ NO PII sensible
- ❌ NO valores hardcodeados
- ✅ Todos los valores vienen del backend/sesión real

**Ejemplo:**
```typescript
{
  plan: 'pro',
  role: 'user',
  has_roastr_persona: true,  // Calculado de lo_que_me_define_encrypted
  is_admin: false,
  is_trial: false,
  auth_provider: 'email_password',
  locale: 'es'
}
```

#### 3. Logout / Session Clear

**Ubicación:** `frontend/src/lib/auth-context.tsx` - función `logout()`

En logout (manual o expiración):
```typescript
// Clear identity in Amplitude before logout
setUserId(undefined);
reset();
```

Esto:
- Establece userId a `undefined`
- Resetea las propiedades del usuario
- Previene contaminación de sesiones
- Cumple con GDPR

#### 4. Verificación de autenticación

**Ubicación:** `frontend/src/lib/auth-context.tsx` - función `verifyAuth()`

Si el usuario tiene token válido al cargar/reiniciar la app:
```typescript
// Sync identity with Amplitude on auth verification
setUserId(response.data.id);
const userProperties = buildUserProperties(response.data);
setUserProperties(userProperties);
```

Si el token es inválido o la verificación falla:
```typescript
// Clear Amplitude identity
setUserId(undefined);
reset();
```

### Backend

**Estado actual:** El backend NO emite eventos de Amplitude.

**Nota:** Si en el futuro el backend emite eventos de Amplitude, debe usar el mismo `userId` que el frontend estableció. Debe manejar gracefulmente casos donde no hay identidad del usuario.

## Estructura de Datos

### User Interface

**Archivo:** `frontend/src/lib/api.ts`

```typescript
export interface User {
  id: string;
  email: string;
  name?: string;
  is_admin?: boolean;
  organization_id?: string;
  plan?: string;  // Desde backend
  lo_que_me_define_encrypted?: string | null;  // Para calcular has_roastr_persona
}
```

### UserProperties Interface

**Archivo:** `frontend/src/lib/analytics.ts`

```typescript
export interface UserProperties {
  plan?: string;
  role?: string;
  has_roastr_persona?: boolean;
  is_admin?: boolean;
  is_trial?: boolean;
  auth_provider?: string;
  locale?: string;
}
```

## Tests

### Frontend Tests

**Archivo:** `frontend/src/lib/__tests__/auth-context.test.tsx`

Tests implementados:
1. ✅ `setUserId` llamado tras login exitoso
2. ✅ `setUserProperties` llamado con payload esperado
3. ✅ `reset` llamado en logout
4. ✅ Sincronización en verificación de auth
5. ✅ Limpieza de identidad cuando auth falla
6. ✅ `has_roastr_persona` calculado correctamente desde backend

**Archivo:** `frontend/src/lib/__tests__/analytics.test.ts`

Tests implementados:
1. ✅ No ejecuta en test env (no-op)
2. ✅ Maneja valores undefined correctamente
3. ✅ Maneja propiedades vacías correctamente

## Reglas de Calidad

- ✅ **snake_case**: Todas las propiedades usan snake_case (plan, role, has_roastr_persona, etc.)
- ✅ **Reutilizable**: `buildUserProperties` puede usarse por register/billing
- ✅ **Sin lógica duplicada**: Una sola función `buildUserProperties`
- ✅ **Sin legacy**: Usa valores de backend, no hardcoded
- ✅ **NO ejecuta en test env**: Amplitude no se inicializa en tests

## Archivos Modificados

1. `frontend/src/lib/auth-context.tsx`
   - Actualizado `buildUserProperties` para calcular `has_roastr_persona` desde backend
   - Mantiene llamadas a `setUserId`, `setUserProperties`, `reset` en los lugares correctos

2. `frontend/src/lib/api.ts`
   - Extendida interfaz `User` para incluir `plan` y `lo_que_me_define_encrypted`

3. `frontend/src/lib/__tests__/auth-context.test.tsx`
   - Añadidos tests completos para identity sync
   - Verificación de llamadas a funciones de analytics

4. `frontend/src/lib/__tests__/analytics.test.ts`
   - Limpiados tests placeholder

## Resultado

- ✅ No contaminación de sesiones
- ✅ Cumple GDPR
- ✅ Valores coherentes con backend/sesión real
- ✅ Tests pasando
- ✅ Código limpio y reutilizable


