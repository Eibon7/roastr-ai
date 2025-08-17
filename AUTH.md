# AUTH.md - Sistema de Autenticación de Roastr.ai

## 📋 Overview

Sistema completo de autenticación multi-modal con soporte para registro/login tradicional, magic links, recuperación de contraseña y modo mock para development/testing. Integrado con Supabase Auth y diseñado para máxima seguridad y usabilidad.

## 🚀 Flujos de Autenticación

### 1. Registro con Email/Password

**Frontend Flow:**
1. Usuario completa formulario en `/register`
2. Validación client-side (email válido, password ≥6 chars, nombre ≥2 chars)
3. POST `/api/auth/register` con `{ email, password, name }`
4. Supabase crea usuario y envía email de confirmación
5. Redirect a `/login` con mensaje de éxito
6. Usuario debe confirmar email antes del primer login

**Backend Endpoint:**
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "Usuario Ejemplo"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "email_confirmed": false
    }
  }
}
```

### 2. Login con Email/Password

**Frontend Flow:**
1. Usuario completa formulario en `/login`
2. Validación client-side
3. POST `/api/auth/login` con `{ email, password }`
4. Si success → AuthContext actualizado → Redirect a `/dashboard`
5. Si error → Mensaje no enumerativo ("Email o contraseña incorrectos")

**Backend Endpoint:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com", 
  "password": "securepassword123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": "uuid", "email": "user@example.com" },
    "session": { "access_token": "jwt...", "expires_at": 1234567890 },
    "profile": { "name": "Usuario", "plan": "free", "is_admin": false }
  }
}
```

### 3. Magic Link (Email OTP)

**Prerequisite:** `ENABLE_MAGIC_LINK=true` (default enabled)

**Frontend Flow:**
1. Usuario toggle a "Magic Link" en `/login` o `/register`
2. Completa email (y nombre si registro)
3. POST `/api/auth/magic-link` o `/api/auth/signup/magic-link`
4. UI muestra "Revisa tu email" con opción de reenvío
5. Usuario hace click en email → Redirect a `/auth/callback`
6. Callback procesa token → Login automático → Redirect a `/dashboard`

**Backend Endpoints:**
```http
# Login con Magic Link
POST /api/auth/magic-link
{ "email": "user@example.com" }

# Registro con Magic Link  
POST /api/auth/signup/magic-link
{ "email": "user@example.com", "name": "Usuario" }
```

**Callback Flow:**
- URL: `/auth/callback?access_token=...&refresh_token=...`
- Componente `AuthCallback` extrae tokens
- `supabase.auth.getSession()` establece sesión
- AuthContext se actualiza automáticamente
- Redirect a dashboard o error page

### 4. Recuperación de Contraseña

**Frontend Flow:**
1. Usuario hace click "¿Olvidaste tu contraseña?" en `/login`
2. Navega a `/reset-password`
3. Ingresa email → POST `/api/auth/reset-password`
4. UI muestra "Revisa tu email"
5. Usuario hace click en email → Redirect a `/auth/update-password`
6. Completa nueva contraseña → POST `/api/auth/update-password`
7. Redirect a `/login` con mensaje de éxito

**Backend Endpoints:**
```http
# Solicitar reset
POST /api/auth/reset-password
{ "email": "user@example.com" }

# Actualizar password
POST /api/auth/update-password  
{ "access_token": "reset-token", "password": "newpassword123" }
```

## ⚙️ Variables de Entorno

### Backend (.env)
```bash
# === Core Auth Flags ===
ENABLE_MAGIC_LINK=true          # Habilita magic links (default: true)
NODE_ENV=development            # development|production|test

# === Supabase (Requerido para modo real) ===
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here  # Solo backend
SUPABASE_ANON_KEY=your-anon-key-here             # Para client creation

# === Development ===
DEBUG=true                      # Logs detallados  
VERBOSE_LOGS=false              # Logs extra verbose
```

### Frontend (frontend/.env)
```bash
# === Supabase Client ===
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here

# === Auth Features ===  
REACT_APP_USE_MAGIC_LINK=true   # Muestra toggle magic link en UI

# === Mock Mode (Development) ===
REACT_APP_ENABLE_MOCK_MODE=false # Forza mock mode (auto si no hay Supabase vars)
```

### Configuración de Producción
```bash
# Production Backend
NODE_ENV=production
ENABLE_MAGIC_LINK=true
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_SERVICE_KEY=prod-service-key
SUPABASE_ANON_KEY=prod-anon-key
DEBUG=false

# Production Frontend
REACT_APP_SUPABASE_URL=https://prod-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=prod-anon-key
REACT_APP_USE_MAGIC_LINK=true
REACT_APP_ENABLE_MOCK_MODE=false
```

## 🧪 Testing - Mock Mode

### Activación Automática
Mock mode se activa automáticamente cuando:
- Frontend: Faltan `REACT_APP_SUPABASE_URL` o `REACT_APP_SUPABASE_ANON_KEY`
- Backend: `ENABLE_MOCK_MODE=true` o faltan keys de Supabase

### Testing Backend
```bash
# Todos los tests con mock mode
ENABLE_MOCK_MODE=true npm run test:ci

# Tests específicos de auth
ENABLE_MOCK_MODE=true npx jest --config=jest.skipExternal.config.js tests/unit/routes/auth-edge-cases.test.js

# Con cobertura
ENABLE_MOCK_MODE=true npx jest --config=jest.skipExternal.config.js --coverage
```

### Testing Frontend
```bash
# En directorio frontend/
npm test                        # Auto-mock mode en tests

# Tests específicos
npm test -- --testPathPattern="AuthContext"

# Con coverage
npm test -- --coverage --watchAll=false
```

### Comportamiento Mock Mode

**Backend Mock:**
- Todas las operaciones auth simulan éxito
- Rate limiting deshabilitado
- Logs con prefijo "🎭 Mock"
- Sin llamadas externas a Supabase

**Frontend Mock:**
- MockSupabaseClient en lugar de cliente real
- Session persistida en localStorage
- Callbacks de auth state funcionan normalmente
- Usuario mock: `user@roastr.ai` con plan Pro

## 🔒 Seguridad

### Mensajes No Enumerativos
- **Login fallido:** "Email o contraseña incorrectos" (nunca "Usuario no existe")
- **Magic link:** "Si existe cuenta, enviamos email" (siempre mismo mensaje)
- **Reset password:** "Si existe cuenta, enviamos email" (siempre mismo mensaje)

### Rate Limiting
- Aplicado a todas las rutas `/api/auth/*`
- Configurado en `src/middleware/rateLimiter.js`
- Límites ajustables por endpoint

### Validaciones
- **Email:** Regex + validación backend
- **Password:** ≥6 caracteres, validación frontend + backend
- **Magic Link:** Expira en 60 minutos
- **Reset Token:** Expira en 60 minutos

### Headers de Seguridad
- CORS configurado apropiadamente
- No logging de passwords/tokens
- SERVICE_KEY nunca expuesto en frontend

## 📁 Arquitectura del Código

### Backend Structure
```
src/
├── routes/auth.js              # Endpoints REST de autenticación
├── services/authService.js     # Lógica de negocio Supabase
├── middleware/auth.js          # JWT verification, requireAdmin
├── middleware/rateLimiter.js   # Rate limiting para auth
├── config/flags.js             # Feature flags (ENABLE_MAGIC_LINK)
└── config/supabase.js          # Supabase client initialization
```

### Frontend Structure  
```
frontend/src/
├── pages/
│   ├── login.jsx               # Login page (password + magic link toggle)
│   ├── register.jsx            # Register page (password + magic link toggle)
│   ├── reset-password.jsx      # Password reset request + form
│   └── auth-callback.jsx       # Magic link callback handler
├── components/
│   ├── AuthForm.js             # Email/password form component  
│   └── MagicLinkForm.js        # Magic link form component
├── contexts/
│   └── AuthContext.js          # Global auth state management
└── lib/
    ├── supabaseClient.js       # Supabase client + helpers + mock client
    └── mockMode.js             # Mock mode detection and utilities
```

## 🛠 Comandos Útiles

### Development
```bash
# Backend
npm start                       # Start API server
npm run dev                     # Development mode with auto-reload

# Frontend  
npm start                       # Start React dev server (puerto 3001)
npm run build                   # Production build

# Full stack
npm run dev:full               # Start both backend + frontend
```

### Testing
```bash
# Backend tests
npm run test                   # All tests
npm run test:coverage          # With coverage report
ENABLE_MOCK_MODE=true npm test # Force mock mode

# Frontend tests
cd frontend && npm test        # Interactive test runner
cd frontend && npm run test:ci # CI mode with coverage
```

### Production
```bash
# Build
npm run build                  # Build both backend + frontend

# Deploy prep
npm run production:check       # Verify prod configs
npm run production:build       # Production build with optimizations
```

## 🐛 Troubleshooting

### Common Issues

**Error: "Missing Supabase environment variables"**
- ✅ Verificar `.env` contiene `SUPABASE_URL` y claves
- ✅ Restart server después de cambios en `.env`
- ✅ En production, verificar variables de entorno del host

**Magic Link no funciona**
- ✅ Verificar `ENABLE_MAGIC_LINK=true` en backend
- ✅ Verificar `REACT_APP_USE_MAGIC_LINK=true` en frontend  
- ✅ Verificar Supabase Auth config (redirects, email templates)

**Mock mode no se activa**
- ✅ Backend: Set `ENABLE_MOCK_MODE=true` explícitamente
- ✅ Frontend: Verificar variables Supabase están comentadas/ausentes
- ✅ Restart servers después de cambios

**Tests fallan con "Cannot use import statement"**
- ✅ Usar config correcto: `--config=jest.skipExternal.config.js`
- ✅ Verificar `ENABLE_MOCK_MODE=true` está set

**Callback redirect falla**  
- ✅ Verificar URL en Supabase Auth settings
- ✅ Verificar rutas React Router para `/auth/callback`
- ✅ Check browser console para errores de CORS/CSP

### Debug Commands
```bash
# Backend auth status
curl http://localhost:3000/api/auth/config

# Feature flags status  
curl http://localhost:3000/api/system/status

# Test mock mode
ENABLE_MOCK_MODE=true DEBUG=true npm start

# Frontend mock status
# Check browser console - logs will show "🎭 Mock Mode" status
```

## 📚 API Reference

### Auth Endpoints

| Endpoint | Method | Purpose | Auth Required |
|----------|---------|---------|---------------|
| `/api/auth/config` | GET | Get auth features available | No |
| `/api/auth/register` | POST | Email/password registration | No |
| `/api/auth/login` | POST | Email/password login | No |
| `/api/auth/magic-link` | POST | Send magic link (login) | No |
| `/api/auth/signup/magic-link` | POST | Send magic link (register) | No |
| `/api/auth/reset-password` | POST | Request password reset | No |
| `/api/auth/update-password` | POST | Update password with reset token | No |
| `/api/auth/logout` | POST | Logout current session | Yes |
| `/api/auth/me` | GET | Get current user profile | Yes |
| `/api/auth/verify` | GET | Verify email (callback) | No |

### Feature Flags

| Flag | Environment Var | Default | Purpose |
|------|----------------|---------|---------|
| `ENABLE_MAGIC_LINK` | `ENABLE_MAGIC_LINK` | `true` | Enable magic link auth |
| `ENABLE_BILLING` | Multiple Stripe vars | Auto-detect | Enable billing features |
| `MOCK_MODE` | `ENABLE_MOCK_MODE` | Auto-detect | Force mock mode |

---

## 🎯 Estado Actual: 100% Funcional

✅ **Registro & Login** - Completo con validaciones  
✅ **Magic Link** - Completo con toggle condicional  
✅ **Password Reset** - Completo con flujo seguro  
✅ **Mock Mode** - Completo para development/testing  
✅ **Security** - Rate limiting, mensajes no enumerativos  
✅ **Feature Flags** - Control granular por entorno  
✅ **Testing** - Cobertura >80% con edge cases  

El sistema está **listo para producción** y completamente documentado.

**Mock mode permite development sin setup de Supabase.**  
**Feature flags permiten control granular por entorno.**  
**Tests completos aseguran estabilidad en CI/CD.**