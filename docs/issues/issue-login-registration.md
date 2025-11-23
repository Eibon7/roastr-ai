# Issue: Completar Login & Registration al 100%

**Prioridad:** P0 (Crítico - Bloqueante para producción)
**Estimación:** 2-3 horas
**Estado Actual:** 80% completado
**Documentación:** [docs/flows/login-registration.md](../flows/login-registration.md)

---

## 🎯 ¿Qué es este flujo?

**Login & Registration** es el flujo fundamental de autenticación y gestión de sesiones en Roastr. Este flujo permite:

- **Registro de nuevos usuarios** con validación de email y contraseña
- **Login seguro** con generación de JWT tokens (access + refresh)
- **Validación de sesión** para rutas protegidas
- **Renovación automática de tokens** antes de que expiren
- **Gestión de errores** de autenticación (401, 403, 429)

**Importancia:** Sin este flujo, no hay acceso al sistema. Es la base sobre la que se construyen todos los demás flujos (payment, persona, roasting).

**Tecnologías clave:**

- JWT tokens (1 hora access, 7 días refresh)
- Supabase Auth + Row Level Security (RLS)
- bcrypt para hashing de passwords
- Rate limiting para prevenir brute-force

---

## 📋 Descripción Técnica

El flujo de Login & Registration está implementado en su mayoría, pero faltan componentes críticos para considerarlo production-ready:

- ✅ Endpoint `/api/auth/register` implementado
- ✅ Endpoint `/api/auth/login` implementado
- ✅ Endpoint `/api/auth/session` para validación implementado
- ❌ Endpoint `/api/auth/refresh` para renovación de tokens **faltante**
- ❌ Estrategia de refresh automático en frontend **sin documentar**
- ⚠️ Manejo de errores 401/403/429 incompleto
- ⚠️ Tests E2E del flujo completo faltantes

---

## ✅ Checklist Técnico

### 1. Backend: Token Refresh Implementation

- [ ] Crear endpoint `POST /api/auth/refresh`
  - [ ] Validar refresh token desde request body
  - [ ] Verificar que refresh token no esté expirado (7 días desde emisión)
  - [ ] Generar nuevo access token (1 hora expiración)
  - [ ] Retornar `{ token, expiresAt }` con timestamp ISO 8601
  - [ ] Logging de eventos de refresh exitoso/fallido

- [ ] Actualizar `src/services/authService.js` (si existe) con método `refreshAccessToken()`

- [ ] Implementar rotation de refresh tokens (opcional pero recomendado)
  - [ ] Invalidar refresh token antiguo tras uso
  - [ ] Retornar nuevo refresh token en response
  - [ ] Actualizar columna `refresh_token_hash` en tabla `users`

### 2. Frontend: Auto-Refresh Strategy

- [ ] Implementar función `refreshToken()` en auth module

  ```javascript
  async function refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (response.ok) {
      const { token, expiresAt } = await response.json();
      localStorage.setItem('token', token);
      localStorage.setItem('expiresAt', expiresAt);
      return true;
    }

    // Si refresh falla, logout forzado
    logout();
    return false;
  }
  ```

- [ ] Implementar estrategia de refresh proactivo (15 minutos antes de expirar)

  ```javascript
  setInterval(
    async () => {
      const expiresAt = new Date(localStorage.getItem('expiresAt'));
      const now = new Date();
      const minutesUntilExpiry = (expiresAt - now) / 1000 / 60;

      if (minutesUntilExpiry < 15 && minutesUntilExpiry > 0) {
        await refreshToken();
      }
    },
    5 * 60 * 1000
  ); // Verificar cada 5 minutos
  ```

- [ ] Implementar retry automático en interceptor HTTP (axios/fetch)
  - [ ] Capturar respuestas 401
  - [ ] Intentar refresh automático (1 vez)
  - [ ] Re-ejecutar request original si refresh exitoso
  - [ ] Logout si refresh falla

### 3. Error Handling Completo

- [ ] Manejar error 401 (Unauthorized)
  - [ ] Intentar refresh automático
  - [ ] Mostrar mensaje "Sesión expirada, redirigiendo a login..."
  - [ ] Limpiar localStorage
  - [ ] Redirect a `/login`

- [ ] Manejar error 403 (Forbidden)
  - [ ] Mostrar mensaje "Acceso denegado"
  - [ ] Logging en frontend (si aplica)
  - [ ] No intentar refresh (problema de permisos, no de token)

- [ ] Manejar error 429 (Rate Limit)
  - [ ] Mostrar mensaje "Demasiados intentos, espera X segundos"
  - [ ] Implementar backoff exponencial en reintentos
  - [ ] Deshabilitar botón de login temporalmente

### 4. Confirmación de Email (Opcional - Validar si aplica)

- [ ] **Pregunta para usuario:** ¿Se requiere email confirmation en registro?
  - Si SÍ:
    - [ ] Implementar envío de email con link de confirmación
    - [ ] Crear endpoint `GET /api/auth/confirm-email?token=xxx`
    - [ ] Actualizar columna `email_verified` en tabla `users`
    - [ ] Prevenir login si `email_verified = false`
  - Si NO:
    - [ ] Documentar que no se requiere confirmación
    - [ ] Actualizar flujo en `docs/flows/login-registration.md`

### 5. Testing

- [ ] Tests unitarios para `authService.refreshAccessToken()`
  - [ ] Test: refresh exitoso retorna nuevo token
  - [ ] Test: refresh con token inválido retorna 401
  - [ ] Test: refresh con token expirado retorna 401
  - [ ] Test: rotation de refresh token funciona correctamente

- [ ] Tests de integración para endpoint `/api/auth/refresh`
  - [ ] Test: POST con refresh token válido → 200 + nuevo token
  - [ ] Test: POST con refresh token expirado → 401
  - [ ] Test: POST sin refresh token → 400
  - [ ] Test: POST con refresh token de otro usuario → 403

- [ ] Tests E2E del flujo completo
  - [ ] Registro → Login → Acceso a ruta protegida → Refresh automático → Logout
  - [ ] Login → Esperar expiración → Verificar refresh automático
  - [ ] Login → Intentar usar token expirado manualmente → Verificar 401 → Refresh → Reintento exitoso

- [ ] Tests de rate limiting (si GDPR rate limits aplican)
  - [ ] Verificar que `/api/auth/login` respeta límites
  - [ ] Verificar que `/api/auth/refresh` no tiene rate limit (o tiene límite alto)

### 6. Documentación

- [ ] Actualizar `docs/flows/login-registration.md` con:
  - [ ] Diagrama Mermaid incluyendo flujo de refresh
  - [ ] Especificación completa de endpoint `/api/auth/refresh`
  - [ ] Estrategia de auto-refresh documentada
  - [ ] Ejemplos de código frontend
  - [ ] Manejo de errores documentado

- [ ] Actualizar `CLAUDE.md` si hay cambios en variables de entorno

- [ ] Actualizar nodo GDD `docs/nodes/multi-tenant.md` (auth policies)

---

## 🔗 Dependencias

**Bloqueantes (debe resolverse antes):**

- Ninguna (issue independiente)

**Desbloqueadas por esta issue:**

- Issue Payment (Polar) - Requiere auth funcional
- Issue Persona Setup - Requiere sesiones de usuario activas
- Issue Roasting Control - Requiere estado de sesión

---

## 🎯 Criterios de Aceptación

Esta issue se considera **100% completa** cuando:

1. ✅ Endpoint `/api/auth/refresh` implementado y testeado
2. ✅ Frontend implementa auto-refresh 15 minutos antes de expirar
3. ✅ Interceptor HTTP maneja 401 con retry automático
4. ✅ Manejo de errores 401/403/429 completamente implementado
5. ✅ **TODOS los tests pasando al 100%** (unitarios + integración + E2E)
6. ✅ Documentación actualizada en `docs/flows/login-registration.md`
7. ✅ Nodo GDD actualizado con nueva cobertura
8. ✅ Pre-Flight Checklist ejecutado sin issues
9. ✅ Self-review completado (simulando CodeRabbit)
10. ✅ CI/CD passing (todos los jobs verdes)

---

## 📊 Métricas de Éxito

| Métrica                  | Valor Actual | Objetivo | Estado       |
| ------------------------ | ------------ | -------- | ------------ |
| Tests pasando            | N/A          | 100%     | ⏳ Pendiente |
| Cobertura auth module    | N/A          | ≥80%     | ⏳ Pendiente |
| Tiempo de implementación | 0h           | ≤3h      | ⏳ Pendiente |
| Errores en producción    | N/A          | 0        | ⏳ Pendiente |

---

## 📝 Notas de Implementación

**Seguridad:**

- Refresh tokens deben tener TTL de 7 días máximo
- Access tokens deben tener TTL de 1 hora máximo
- NUNCA almacenar refresh tokens en cookies sin `httpOnly` flag
- Considerar rotation de refresh tokens para prevenir replay attacks

**Performance:**

- Auto-refresh debe ser eficiente (verificar cada 5 min, NO cada segundo)
- Usar `requestIdleCallback` en frontend para no bloquear UI
- Cachear resultado de refresh por 1 minuto (evitar múltiples requests simultáneos)

**UX:**

- Mostrar loader discreto durante refresh automático
- NO interrumpir flujo de usuario si refresh exitoso
- Mostrar notificación clara si refresh falla y requiere re-login

---

**Siguiente paso tras completar:** Implementar Issue Payment (Polar) - P1
