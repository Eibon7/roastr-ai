# Frontend Scope - Phase 2

**Issue Original:** ROA-373  
**Phase 1 Status:** ✅ COMPLETADO (Backend)  
**Phase 2:** ⏳ PENDIENTE (Frontend)

---

## 📋 Scope Phase 2: Frontend Implementation

### Componentes Requeridos

**1. Registro UI (Register Form)**
- Estados: `idle`, `submitting`, `pending_verification`, `error`
- Mostrar mensaje "Verifica tu email" después de registro exitoso
- Link para reenviar email de verificación
- Mensajes genéricos (anti-enumeration)

**2. Email Verification Page**
- Página: `/auth/verify-email?token=...`
- Capturar token de URL
- Llamar a `/api/v2/auth/verify-email`
- Estados: `verifying`, `success`, `error`
- Redirect a login después de success

**3. Login Form Updates**
- Manejo de error `AUTH_EMAIL_NOT_CONFIRMED`
- Mostrar: "Por favor verifica tu email antes de iniciar sesión"
- Opción de reenviar email

**4. Reenvío de Email**
- Endpoint: `/api/v2/auth/resend-verification` (nuevo)
- Rate limit: 3/hour
- Respuesta genérica (no revelar si email existe)

---

## 🎯 Acceptance Criteria (Phase 2)

### AC1: Register UI
- [  ] Form con estados loading/error/success
- [ ] Mensaje "pending verification" después de registro
- [ ] Link para reenviar verificación
- [ ] Anti-enumeration (mensajes genéricos)

### AC2: Email Verification Page
- [ ] Captura token de URL
- [ ] Llama a endpoint /verify-email
- [ ] Estados: verifying/success/error
- [ ] Redirect a login en success

### AC3: Login Form
- [ ] Manejo de AUTH_EMAIL_NOT_CONFIRMED
- [ ] Mensaje "verifica tu email"
- [ ] Link para reenviar

### AC4: Resend Verification
- [ ] Endpoint /resend-verification
- [ ] Rate limit 3/hour
- [ ] Tests unitarios + flow

### AC5: Tests E2E
- [ ] Flow completo: register → email → verify → login
- [ ] Error: login sin verificar
- [ ] Reenvío de email

---

## 📁 Archivos a Crear/Modificar

```
apps/frontend-v2/src/
  ├── pages/
  │   ├── auth/
  │   │   ├── register.tsx (modificar)
  │   │   ├── verify-email.tsx (nuevo)
  │   │   └── login.tsx (modificar)
  │   └── components/
  │       └── VerifyEmailPrompt.tsx (nuevo)

apps/backend-v2/src/
  └── routes/
      └── auth.ts (+ endpoint /resend-verification)

apps/backend-v2/tests/
  ├── e2e/
  │   └── auth-email-verification-e2e.test.ts (nuevo)
  └── unit/services/
      └── authService-resendVerification.test.ts (nuevo)
```

---

## 🔗 Dependencias

**Bloqueadores:**
- ✅ ROA-373 Phase 1 (Backend) - COMPLETADO

**Relacionados:**
- ROA-409: Auth Email Infrastructure (completado)
- ROA-358: Frontend base components (si aplica)

---

## 📝 Notas de Implementación

### Decisión: Phased Delivery

**Razón:**
1. Backend funcional permite testing independiente
2. Frontend puede iterar diseño sin bloquear funcionalidad
3. Permite despliegue gradual (feature flag)
4. Reduce scope de PR inicial

### Feature Flag

```typescript
// Controlar habilitación de email verification
feature_flags: {
  auth_enable_email_verification: true, // Backend
  auth_show_email_verification_ui: true  // Frontend (nuevo)
}
```

### UX Considerations

**Messages Anti-Enumeration:**
- ✅ "Email de verificación enviado" (no revelar si existe)
- ✅ "Verifica tu email para continuar" (genérico)
- ❌ "Este email no está registrado" (revela info)

**Error Handling:**
- Token inválido → "Link de verificación inválido o expirado"
- Token expirado → "Link expirado. Solicita uno nuevo"
- Rate limit → "Demasiados intentos. Espera X minutos"

---

## 🚀 Criterio de Completitud

**Phase 2 se considera completa cuando:**

- [  ] Todos los AC marcados como completos
- [  ] Tests E2E pasando al 100%
- [  ] UI responsive (móvil/tablet/desktop)
- [  ] Accesibilidad (a11y) verificada
- [  ] Documentación actualizada
- [  ] Feature flag habilitado en staging
- [  ] QA manual aprobado

---

## 📅 Timeline Estimado

- **Planning:** 1 día
- **Backend resend:** 0.5 días
- **Frontend components:** 2 días
- **Tests E2E:** 1 día
- **QA + fixes:** 1 día

**Total:** ~5-6 días

---

**Creado:** 2025-01-02  
**Issue tracking:** ROA-373-frontend (a crear)


