# Login UI v2 - Frontend Implementation

**Issue:** ROA-361 - B2. Login Frontend UI (shadcn)  
**Status:** ✅ Complete  
**Type:** Frontend  
**Priority:** Alta

---

## 📋 Overview

Modern login page implementation using **shadcn/ui** components, aligned with the backend v2 authentication contract (`POST /api/v2/auth/login`).

The UI focuses on:
- ✅ **Contract-first error handling** (error_code based)
- ✅ **Proper state management** (idle, loading, error, success)
- ✅ **Accessibility** (WCAG 2.1 Level AA)
- ✅ **No backend logic duplication** (validation happens on both sides)

---

## 🎨 UI Components Used

All components from **shadcn/ui**:

| Component | Usage |
|-----------|-------|
| `Button` | Submit button with loading state |
| `Input` | Email and password inputs |
| `Label` | Accessible labels for inputs |
| `Card` | Container for login form |
| `Alert` | Error message display |
| `AuthLayout` | Page layout wrapper |

**Icons:**
- `Loader2` (lucide-react) - Loading spinner
- `AlertCircle` (lucide-react) - Error indicator

---

## 🔐 Form Validation

### Client-Side Validation (Zod)

```typescript
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Formato de email inválido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida'),
});
```

**Rules:**
- ✅ Email format validation
- ✅ Required field validation
- ❌ No password strength validation (handled by backend)
- ❌ No duplication of backend logic

---

## 🚦 UI States

### 1. **Idle**
- Form enabled
- All inputs focusable
- Submit button enabled
- No error messages

### 2. **Loading**
- All inputs **disabled** (prevents editing)
- Submit button **disabled** (prevents double submit)
- Spinner visible on button
- Button text: "Iniciando sesión..."
- Recovery link has `tabindex="-1"` (non-focusable)

### 3. **Error**
- Form re-enabled
- Error alert visible with `role="alert"`
- Error message based on `error_code` (see Error Mapping)
- Form validation errors visible if present

### 4. **Success**
- Redirect handled by router
- Navigation to originally requested page (or `/app`)

---

## ⚠️ Error Handling

### Contract-First Approach

**The UI NEVER shows raw backend error messages.**

All errors are mapped from `error_code` to user-friendly messages:

### Error Code Mapping

| Backend `error_code` | User Message (Spanish) | Notes |
|---------------------|------------------------|-------|
| `AUTH_INVALID_CREDENTIALS` | Email o contraseña incorrectos | Generic message |
| `AUTH_EMAIL_NOT_FOUND` | Email o contraseña incorrectos | Anti-enumeration |
| `AUTH_PASSWORD_INCORRECT` | Email o contraseña incorrectos | Anti-enumeration |
| `AUTH_ACCOUNT_LOCKED` | Cuenta bloqueada temporalmente debido a múltiples intentos fallidos | Security |
| `AUTH_ACCOUNT_DISABLED` | Cuenta deshabilitada. Por favor contacta a soporte | Requires support |
| `AUTH_EMAIL_NOT_VERIFIED` | Por favor verifica tu dirección de email | Action required |
| `AUTH_TOO_MANY_LOGIN_ATTEMPTS` | Demasiados intentos de inicio de sesión. Intenta más tarde | Rate limiting |
| `AUTH_RATE_LIMIT_EXCEEDED` | Demasiadas solicitudes. Intenta más tarde | Rate limiting |
| `AUTH_SERVICE_UNAVAILABLE` | Servicio de autenticación temporalmente no disponible | System error |
| `AUTH_DISABLED` | Login no disponible temporalmente | Maintenance |
| `AUTH_UNKNOWN_ERROR` | Algo ha fallado. Inténtalo más tarde | Fallback |
| *(any other)* | Algo ha fallado. Inténtalo más tarde | Safe fallback |

### Anti-Enumeration

The UI **never reveals** whether an email exists or not:
- `AUTH_EMAIL_NOT_FOUND` → "Email o contraseña incorrectos"
- `AUTH_PASSWORD_INCORRECT` → "Email o contraseña incorrectos"
- `AUTH_INVALID_CREDENTIALS` → "Email o contraseña incorrectos"

All credential-related errors show the **same generic message**.

---

## ♿ Accessibility

### WCAG 2.1 Level AA Compliance

✅ **Labels:**
- All inputs have associated `<Label>` elements
- `htmlFor` properly links labels to inputs

✅ **ARIA Attributes:**
- `aria-invalid="true"` on invalid inputs
- `aria-describedby` links inputs to error messages
- Error messages have `role="alert"` for screen readers

✅ **Keyboard Navigation:**
- All interactive elements focusable (Tab order)
- Form submits with `Enter` key
- Focus indicators visible (browser defaults + theme)

✅ **Disabled State Management:**
- During loading:
  - Inputs disabled (prevents editing)
  - Submit button disabled (prevents double submit)
  - Recovery link non-focusable (`tabindex="-1"`)

✅ **Autocomplete:**
- Email: `autocomplete="email"`
- Password: `autocomplete="current-password"`

---

## 🔗 Backend Contract

### Endpoint

```
POST /api/v2/auth/login
```

### Request Body

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### Success Response (200)

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "is_admin": false,
    "plan": "starter"
  },
  "session": {
    "access_token": "jwt-token",
    "refresh_token": "refresh-token",
    "expires_at": "2025-01-01T00:00:00Z"
  }
}
```

### Error Response (401/400/429/503)

```json
{
  "success": false,
  "error_code": "AUTH_INVALID_CREDENTIALS",
  "message": "Invalid credentials",
  "timestamp": "2025-12-25T10:00:00Z"
}
```

**Key field:** `error_code` is used to map errors in the UI.

---

## 📁 File Structure

```
frontend/src/
├── pages/auth/
│   ├── login-v2.tsx               # Main component
│   └── __tests__/
│       └── login-v2.test.tsx      # Tests
├── components/ui/
│   ├── button.tsx                 # shadcn Button
│   ├── input.tsx                  # shadcn Input
│   ├── label.tsx                  # shadcn Label
│   ├── card.tsx                   # shadcn Card
│   └── alert.tsx                  # shadcn Alert
└── components/layout/
    └── auth-layout.tsx            # Auth page wrapper
```

---

## 🧪 Tests

**Test file:** `frontend/src/pages/auth/__tests__/login-v2.test.tsx`

### Coverage

✅ **Rendering:**
- Form renders with all fields
- Labels properly associated
- Recovery link present

✅ **Validation:**
- Empty email shows error
- Invalid email format shows error
- Empty password shows error
- `aria-invalid` set on invalid inputs

✅ **Loading State:**
- Inputs disabled during submission
- Submit button disabled
- Spinner visible
- Prevents double submit

✅ **Error Handling:**
- `AUTH_INVALID_CREDENTIALS` displays correct message
- Unknown error codes fallback to generic message
- Error has `role="alert"` for accessibility
- Anti-enumeration enforced (same message for email/password errors)

✅ **Accessibility:**
- Form submits with Enter key
- Focus indicators present
- Autocomplete attributes set
- Recovery link disabled during loading

✅ **Integration:**
- Navigates to `/app` on success
- Respects redirect from `location.state`

### Running Tests

```bash
cd frontend
npm test -- login-v2.test.tsx
```

**Expected:** 100% passing, 0 failures

---

## 🚀 Usage

### Development

```tsx
import LoginPageV2 from '@/pages/auth/login-v2';

// In router:
<Route path="/login-v2" element={<LoginPageV2 />} />
```

### Test Credentials (Mock Mode)

When backend is not available, use these credentials:

```
Email: test@roastr.ai
Password: password
```

Any other credentials will trigger `AUTH_INVALID_CREDENTIALS` error.

---

## 🔄 Relation to B1 (Backend Contract)

**Dependency:** B1 - Login Backend v2

The frontend **strictly follows** the backend contract:
- Uses `POST /api/v2/auth/login` endpoint
- Expects `error_code` in error responses
- Maps `error_code` to user messages
- Does **not** implement authentication logic
- Does **not** validate password strength (backend responsibility)

**Integration:**
- Replace mock API call with actual v2 endpoint when backend is ready
- Error handling already supports full backend error taxonomy
- No changes required to UI logic

---

## ✅ Checklist de Completado

- [x] Formulario login funcional
- [x] Estados bien manejados (idle / loading / error)
- [x] Mensajes de error por error_code
- [x] UI basada en Shadcn
- [x] Accesibilidad base cubierta (WCAG 2.1 AA)
- [x] Tests mínimos pasando (100%)
- [x] Sin lógica backend duplicada
- [x] Documentación completa
- [x] Anti-enumeration implementado
- [x] Prevención de double submit

---

## 📚 References

- **Issue:** ROA-361
- **Backend Contract:** B1 - Login Backend v2
- **Auth Error Taxonomy:** `src/utils/authErrorTaxonomy.js`
- **shadcn/ui:** https://ui.shadcn.com/
- **React Hook Form:** https://react-hook-form.com/
- **Zod:** https://zod.dev/

---

**Last Updated:** 2025-12-25  
**Author:** Roastr.ai Frontend Team  
**Status:** ✅ Ready for Integration
