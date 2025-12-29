# Plan de Implementación - Issue ROA-355: Email Existence Check Pre-Signup Validation

**Issue:** ROA-355  
**Título:** Email existence check pre-signup validation  
**Prioridad:** P1  
**Estimación:** 1-2 horas  
**Branch:** `feature/ROA-355-email-check`  
**GDD Nodes:** `auth`

---

## 🔍 Estado Actual

### ✅ Lo que YA EXISTE

1. **Auth Service v2** (`apps/backend-v2/src/services/authService.ts`):
   - Método `signup()` que crea usuarios en Supabase Auth
   - Validación de formato de email y password
   - Manejo de errores con `mapSupabaseError()`

2. **Error Taxonomy** (`apps/backend-v2/src/utils/authErrorTaxonomy.ts`):
   - Código de error `EMAIL_ALREADY_EXISTS` ya definido
   - `mapSupabaseError()` ya mapea errores de "already registered" a `EMAIL_ALREADY_EXISTS`

3. **Ejemplo de verificación de email**:
   - En `requestMagicLink()` (líneas 328-359) hay un ejemplo de cómo buscar usuarios usando `supabase.auth.admin.listUsers()` con paginación

### ❌ Lo que FALTA

1. **Verificación PREVIA de email antes de signup**:
   - Actualmente, el método `signup()` intenta crear el usuario directamente
   - Si el email ya existe, Supabase devuelve un error que se mapea a `EMAIL_ALREADY_EXISTS`
   - **Problema:** No hay verificación previa, lo que puede causar:
     - Errores innecesarios en Supabase
     - Menor control sobre el mensaje de error
     - Posible race condition si dos requests llegan simultáneamente

---

## 📝 Plan de Implementación

### FASE 1: Añadir método privado `checkEmailExists()` (30 min)

**Objetivo:** Crear método reutilizable para verificar si un email ya existe en Supabase Auth.

**Implementación:**

```typescript
/**
 * Verifica si un email ya existe en Supabase Auth
 * @param email - Email a verificar (case-insensitive)
 * @returns true si el email existe, false si no
 */
private async checkEmailExists(email: string): Promise<boolean> {
  try {
    // Paginar a través de usuarios para encontrar email
    let page = 1;
    const perPage = 100;
    const normalizedEmail = email.toLowerCase();

    while (true) {
      const { data: usersList, error: userError } = await supabase.auth.admin.listUsers({
        page,
        perPage
      });

      if (userError) {
        logger.error('Error checking email existence:', userError);
        // Si hay error, asumir que no existe para no bloquear signup
        return false;
      }

      // Buscar email en la página actual
      const user = usersList?.users?.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );

      if (user) {
        return true;
      }

      // Si no hay más usuarios o la página está incompleta, terminar
      if (!usersList?.users?.length || (usersList.users && usersList.users.length < perPage)) {
        return false;
      }

      page++;
    }
  } catch (error) {
    logger.error('Unexpected error checking email existence:', error);
    // En caso de error inesperado, retornar false para no bloquear signup
    // El error se capturará cuando se intente crear el usuario
    return false;
  }
}
```

**Consideraciones:**
- Paginación para manejar muchos usuarios
- Case-insensitive comparison
- Error handling: si falla la verificación, permitir que signup continúe (fallback a comportamiento actual)
- Logging para debugging

### FASE 2: Integrar verificación en método `signup()` (15 min)

**Objetivo:** Llamar a `checkEmailExists()` antes de intentar crear el usuario.

**Modificación en `signup()`:**

```typescript
async signup(params: SignupParams): Promise<Session> {
  const { email, password, planId, metadata } = params;

  // Validar inputs
  if (!this.isValidEmail(email)) {
    throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email format');
  }

  if (!this.isValidPassword(password)) {
    throw new AuthError(
      AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      'Password must be at least 8 characters'
    );
  }

  // TODO: Validar planId contra SSOT
  // Temporal hardcoded para deadline 2025-12-31
  // Referencia: Issue ROA-360
  const validPlans = ['starter', 'pro', 'plus'];
  if (!validPlans.includes(planId)) {
    throw new AuthError(
      AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      'Invalid plan ID. Must be one of: starter, pro, plus'
    );
  }

  // ROA-355: Verificar si el email ya existe antes de intentar crear usuario
  const emailExists = await this.checkEmailExists(email);
  if (emailExists) {
    throw new AuthError(
      AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS,
      'An account with this email already exists'
    );
  }

  try {
    // Crear usuario en Supabase Auth
    // ... resto del código existente
  }
}
```

**Ubicación:** Después de validaciones de input, antes de `try` block.

### FASE 3: Añadir tests unitarios (45 min)

**Objetivo:** Verificar que la funcionalidad funciona correctamente.

**Tests a crear:**

1. **`checkEmailExists()` - Email existe:**
   - Mock `supabase.auth.admin.listUsers()` para retornar usuario con email
   - Verificar que retorna `true`

2. **`checkEmailExists()` - Email no existe:**
   - Mock `supabase.auth.admin.listUsers()` para retornar lista vacía
   - Verificar que retorna `false`

3. **`checkEmailExists()` - Paginación:**
   - Mock múltiples páginas de usuarios
   - Verificar que busca en todas las páginas

4. **`checkEmailExists()` - Error handling:**
   - Mock error en `listUsers()`
   - Verificar que retorna `false` (no bloquea signup)

5. **`signup()` - Email ya existe:**
   - Mock `checkEmailExists()` para retornar `true`
   - Verificar que lanza `AuthError` con código `EMAIL_ALREADY_EXISTS`

6. **`signup()` - Email no existe:**
   - Mock `checkEmailExists()` para retornar `false`
   - Mock `supabase.auth.signUp()` para éxito
   - Verificar que crea usuario correctamente

**Archivo:** `apps/backend-v2/tests/unit/services/authService.test.ts`

---

## 🧪 Validación

### Tests

```bash
cd /Users/emiliopostigo/roastr-ai-worktrees/ROA-355
npm test -- apps/backend-v2/tests/unit/services/authService.test.ts
```

### Validación Manual

1. Intentar signup con email existente → Debe retornar 409 con `EMAIL_ALREADY_EXISTS`
2. Intentar signup con email nuevo → Debe crear usuario correctamente
3. Verificar logs para confirmar que se ejecuta la verificación

---

## 📚 Referencias

- **SSOT v2:** Sección 11.2 (Environment Variables)
- **GDD Node:** `docs/nodes-v2/auth/overview.md`
- **Error Taxonomy:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts`
- **Ejemplo similar:** `authService.ts` método `requestMagicLink()` (líneas 328-359)

---

## ✅ Checklist de Implementación

- [ ] FASE 1: Método `checkEmailExists()` implementado
- [ ] FASE 2: Integración en `signup()` completada
- [ ] FASE 3: Tests unitarios creados y pasando
- [ ] Validación manual realizada
- [ ] Logs verificados
- [ ] Documentación actualizada (si aplica)

---

**Última actualización:** 2025-12-26  
**Owner:** ROA-355

