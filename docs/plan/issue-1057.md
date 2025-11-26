# Plan de Implementación - EPIC 1057: Auth

**Issue:** #1057  
**Tipo:** Epic  
**Prioridad:** High  
**Estado:** En progreso  
**Fecha:** 2025-01-27

## Objetivo

Implementar sistema de autenticación completo con login, capa API y gestión de sesión.

## Issues Relacionadas

- #1058: Implementar página de login (/login)
- #1059: Implementar capa de cliente API y auth provider
- #1063: Implementar guards de rutas (admin, auth)

## Estado Actual

### Código Existente

1. **Login Page** (`frontend/src/pages/login.jsx`):
   - ✅ Existe página de login
   - ✅ Soporta email/password y magic link
   - ❌ Redirige a `/dashboard` (debe redirigir según rol)
   - ❌ No usa componentes shadcn/ui consistentemente

2. **API Client** (`frontend/src/lib/api.js`):
   - ✅ Existe cliente API con refresh automático
   - ✅ Maneja tokens y sesión
   - ❌ No está organizado por módulos (auth, users, etc.)
   - ❌ No tiene interceptors centralizados para 401/403

3. **Protected Routes** (`frontend/src/components/ProtectedRoute.jsx`):
   - ✅ Existe componente de protección
   - ✅ Soporta auth y admin
   - ❌ No está en estructura `/lib/guards/`
   - ❌ No protege rutas `/admin/*` y `/app/*` explícitamente

4. **Auth Context** (`frontend/src/contexts/AuthContext.js`):
   - ✅ Existe provider de autenticación
   - ✅ Maneja sesión y usuario
   - ✅ Soporta mock mode

## Acceptance Criteria

### Issue #1058: Login Page
- [ ] Ruta `/login` creada (ya existe, verificar)
- [ ] Formulario con email y password (ya existe)
- [ ] Botón "Envíame un magic link" (ya existe)
- [ ] Al enviar: llamada a backend para autenticación (ya existe)
- [ ] Si `isAdmin === true` → redirect a `/admin/users` (PENDIENTE)
- [ ] Si no → redirect a `/app` (PENDIENTE - actualmente `/dashboard`)
- [ ] Manejo de errores (credenciales incorrectas) (ya existe)
- [ ] Responsive (ya existe)
- [ ] Usar componentes shadcn/ui (PENDIENTE)

### Issue #1059: API Client Layer
- [ ] Carpeta `/lib/api` creada (PENDIENTE - consolidar)
- [ ] Clientes API para: Auth, Usuarios, Feature flags, Planes, Tonos, Métricas, Cuentas, Roasts, Shield, Billing (PENDIENTE)
- [ ] Auth provider global implementado (ya existe, mejorar)
- [ ] Manejo centralizado de tokens/sesión (ya existe)
- [ ] Interceptors para manejo de errores 401/403 (PENDIENTE)
- [ ] Uso consistente de fetch (ya existe)

### Issue #1063: Route Guards
- [ ] Guard de autenticación implementado (ya existe, reorganizar)
- [ ] Guard de admin implementado (ya existe, reorganizar)
- [ ] Rutas `/admin/*` protegidas con guard de admin (PENDIENTE)
- [ ] Rutas `/app/*` protegidas con guard de autenticación (PENDIENTE)
- [ ] Redirección a `/login` si no autenticado (ya existe)
- [ ] Redirección a `/app` si usuario no admin intenta acceder a `/admin` (ya existe)

## Pasos de Implementación

### FASE 1: Issue #1058 - Login Page

1. **Actualizar redirección en login.jsx**
   - Modificar `handleSuccess` para redirigir según `isAdmin`
   - Si admin → `/admin/users`
   - Si no admin → `/app`

2. **Migrar a componentes shadcn/ui**
   - Reemplazar inputs nativos por `components/ui/input.tsx`
   - Reemplazar botones por `components/ui/button.tsx`
   - Usar `components/ui/card.tsx` para contenedor

3. **Verificar ruta `/app` existe**
   - Si no existe, crear o mapear a `/dashboard`

### FASE 2: Issue #1059 - API Client Layer

1. **Reorganizar estructura de API**
   - Crear `frontend/src/lib/api/` (si no existe)
   - Mover `lib/api.js` a `lib/api/client.js` (base)
   - Crear módulos específicos:
     - `lib/api/auth.ts`
     - `lib/api/users.ts`
     - `lib/api/feature-flags.ts`
     - `lib/api/plans.ts`
     - `lib/api/tones.ts`
     - `lib/api/metrics.ts`
     - `lib/api/accounts.ts`
     - `lib/api/roasts.ts`
     - `lib/api/shield.ts`
     - `lib/api/billing.ts`

2. **Implementar interceptors**
   - Agregar interceptor para 401 (logout automático)
   - Agregar interceptor para 403 (redirección a `/app`)
   - Centralizar manejo de errores

3. **Mejorar Auth Provider**
   - Verificar que maneja todos los casos
   - Asegurar que expone `isAdmin` correctamente

### FASE 3: Issue #1063 - Route Guards

1. **Reorganizar guards**
   - Crear `frontend/src/lib/guards/`
   - Mover `ProtectedRoute.jsx` → `lib/guards/auth-guard.tsx`
   - Crear `lib/guards/admin-guard.tsx` (wrapper específico)

2. **Aplicar guards en rutas**
   - Verificar `App.js` usa guards correctamente
   - Asegurar que `/admin/*` usa `AdminGuard`
   - Asegurar que `/app/*` usa `AuthGuard`

3. **Verificar redirecciones**
   - Test: usuario no autenticado → `/login`
   - Test: usuario no admin → `/app` (si intenta `/admin`)
   - Test: usuario admin → `/admin/*` accesible

## Archivos Afectados

### Frontend

**Modificar:**
- `frontend/src/pages/login.jsx` - Redirección según rol
- `frontend/src/lib/api.js` - Reorganizar a módulos
- `frontend/src/components/ProtectedRoute.jsx` - Mover a guards
- `frontend/src/App.js` - Aplicar guards en rutas

**Crear:**
- `frontend/src/lib/api/client.ts` - Cliente base
- `frontend/src/lib/api/auth.ts` - Endpoints de auth
- `frontend/src/lib/api/users.ts` - Endpoints de usuarios
- `frontend/src/lib/api/feature-flags.ts` - Feature flags
- `frontend/src/lib/api/plans.ts` - Planes
- `frontend/src/lib/api/tones.ts` - Tonos
- `frontend/src/lib/api/metrics.ts` - Métricas
- `frontend/src/lib/api/accounts.ts` - Cuentas
- `frontend/src/lib/api/roasts.ts` - Roasts
- `frontend/src/lib/api/shield.ts` - Shield
- `frontend/src/lib/api/billing.ts` - Billing
- `frontend/src/lib/guards/auth-guard.tsx` - Guard de auth
- `frontend/src/lib/guards/admin-guard.tsx` - Guard de admin

## Agentes Relevantes

- **FrontendDev**: Implementación de componentes UI y guards
- **TestEngineer**: Tests para login, guards y API client
- **Guardian**: Revisión de seguridad en autenticación

## Validación

### Tests Requeridos

1. **Login Page**
   - Test: Login exitoso redirige a `/admin/users` si admin
   - Test: Login exitoso redirige a `/app` si no admin
   - Test: Login fallido muestra error
   - Test: Magic link funciona

2. **API Client**
   - Test: Interceptor 401 hace logout
   - Test: Interceptor 403 redirige
   - Test: Refresh token automático
   - Test: Todos los módulos API funcionan

3. **Route Guards**
   - Test: Usuario no autenticado → `/login`
   - Test: Usuario no admin → `/app` (si intenta `/admin`)
   - Test: Usuario admin → `/admin/*` accesible
   - Test: Rutas `/app/*` requieren auth

### Validación Manual

1. Login con usuario admin → debe ir a `/admin/users`
2. Login con usuario normal → debe ir a `/app`
3. Intentar acceder a `/admin` sin ser admin → redirige a `/app`
4. Intentar acceder a `/app` sin auth → redirige a `/login`
5. Interceptor 401 → logout automático
6. Interceptor 403 → redirección apropiada

## Dependencias

- #1033, #1036: Layout auth creado (verificar si aplica)
- Backend auth endpoints funcionando (`/api/auth/login`, etc.)

## Notas

- El código existente es funcional, pero necesita consolidación y mejoras según AC
- Priorizar no romper funcionalidad existente
- Usar TypeScript donde sea posible (`.ts`/`.tsx`)
- Mantener compatibilidad con mock mode

## Checklist Final

- [ ] Issue #1058 completada
- [ ] Issue #1059 completada
- [ ] Issue #1063 completada
- [ ] Tests pasando (100%)
- [ ] Coverage >= 90%
- [ ] GDD actualizado
- [ ] CodeRabbit = 0 comentarios
- [ ] Receipts generados

