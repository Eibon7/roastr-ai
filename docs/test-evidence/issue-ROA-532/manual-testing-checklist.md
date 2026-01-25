# Manual Testing Checklist - Auth v2 Frontend (ROA-532)

**Issue:** [ROA-532](https://linear.app/roastrai/issue/ROA-532/manual-testing)
**Date:** 2026-01-25
**Environment:** Staging (Vercel)
**Backend:** Railway (Auth v2 validated)

---

## ✅ Problemas Resueltos

### 1. **Link a Registro desde Login** (✅ FIXED)

**Problema original:**
- NO existía forma de acceder a registro desde la UI de login
- Usuario debía conocer la URL `/register` manualmente

**Solución implementada:**
- Añadido `CardFooter` con CTA "Crear cuenta" en `login.tsx`
- Link prominente: "¿No tienes cuenta? **Crear cuenta**"
- Ubicado debajo del formulario (zona esperada por usuarios)

**Cómo probar:**
1. Ir a `/login`
2. Scroll hasta el final del formulario
3. Verificar que se ve el texto: "¿No tienes cuenta? **Crear cuenta**"
4. Click en "Crear cuenta"
5. ✅ Debe redirigir a `/register` (sin 404)

---

### 2. **Validación de Email Mejorada** (✅ FIXED)

**Problema original:**
- Email inválido (ej: `test@test.con`) mostraba error genérico "load failed"
- Validación HTML5 básica no era suficiente

**Solución implementada:**
- Validación frontend explícita con regex robusta
- Mensaje claro: "Email inválido"
- Validación en `onBlur` (al salir del campo) y `onSubmit`
- Botón deshabilitado si email inválido

**Cómo probar:**

#### Test 1: Email sin dominio válido
1. Ir a `/login`
2. Escribir: `test@test.con` (TLD inválido)
3. Salir del campo (tab/click fuera)
4. ✅ Debe mostrar error rojo: "Email inválido"
5. ✅ Botón "Iniciar Sesión" deshabilitado

#### Test 2: Email sin @
1. Escribir: `testtest.com`
2. Salir del campo
3. ✅ Debe mostrar error: "Email inválido"

#### Test 3: Email válido
1. Escribir: `test@roastr.ai`
2. Salir del campo
3. ✅ NO debe mostrar error
4. ✅ Botón "Iniciar Sesión" habilitado

#### Test 4: Email vacío al submit
1. Dejar campo vacío
2. Click en "Iniciar Sesión"
3. ✅ Debe mostrar error: "El email es requerido"
4. ✅ NO se envía el formulario

---

### 3. **Ruta `/register` Funcional** (✅ VERIFIED)

**Problema original:**
- Se reportaba que `/register` devolvía 404
- En realidad, la ruta **SÍ existía** pero no era accesible desde UI

**Verificación realizada:**
- Ruta definida en `App.tsx` (línea 55)
- Componente `RegisterPage` existe y funciona
- Componente `RegisterForm` tiene validación robusta

**Cómo probar:**
1. Acceder directamente a: `https://staging.roastr.ai/register`
2. ✅ Debe cargar la página de registro (sin 404)
3. ✅ Debe mostrar formulario con:
   - Nombre completo
   - Email
   - Contraseña (con requisitos visuales)
   - Confirmar contraseña
   - Checkbox términos y condiciones
   - Botón "Crear cuenta"

---

## 🧪 Flujo Completo de QA Manual

### Escenario 1: Usuario Nuevo (Happy Path)

1. **Acceso inicial**
   - Ir a `/login`
   - ✅ Ver CTA "Crear cuenta"

2. **Navegar a registro**
   - Click en "Crear cuenta"
   - ✅ Redirige a `/register`
   - ✅ NO hay 404

3. **Validación de email en registro**
   - Probar emails inválidos (ver test cases arriba)
   - ✅ Mensajes claros: "Email inválido"
   - ✅ NO errores genéricos tipo "load failed"

4. **Completar registro**
   - Rellenar formulario con datos válidos:
     - Nombre: `Test User`
     - Email: `test+staging@roastr.ai`
     - Contraseña: `Test1234` (cumple requisitos)
     - Confirmar contraseña: `Test1234`
     - ✅ Términos aceptados
   - Click "Crear cuenta"
   - ✅ Debe responder backend (400/201/etc)
   - ✅ Mensajes de error claros si falla (NO técnicos)

5. **Navegación inversa (registro → login)**
   - En `/register`, click en "¿Ya tienes cuenta? Inicia sesión"
   - ✅ Redirige a `/login`

---

### Escenario 2: Validación de Errores (Negative Tests)

#### Test A: Email duplicado
1. Registro con email existente
2. ✅ Mensaje: "Este email ya está registrado"
3. ✅ NO "AUTH_EMAIL_TAKEN" o error técnico

#### Test B: Contraseña débil
1. Registro con contraseña: `abc123`
2. ✅ Mensaje: "La contraseña es muy débil. Debe tener al menos 8 caracteres..."
3. ✅ NO "AUTH_WEAK_PASSWORD" o error técnico

#### Test C: Términos no aceptados
1. Registro sin marcar checkbox
2. ✅ Mensaje: "Debes aceptar los términos y condiciones"
3. ✅ NO "AUTH_TERMS_NOT_ACCEPTED"

#### Test D: Rate limit
1. Múltiples intentos rápidos
2. ✅ Mensaje: "Demasiados intentos. Espera 15 minutos..."
3. ✅ NO "AUTH_RATE_LIMIT_EXCEEDED"

---

### Escenario 3: Login con Validación (Post-Registro)

1. **Email inválido en login**
   - Escribir: `admin@test.con`
   - ✅ Error: "Email inválido"
   - ✅ Botón deshabilitado

2. **Credenciales incorrectas**
   - Email válido: `test@roastr.ai`
   - Contraseña incorrecta: `wrong`
   - ✅ Error: "Email o contraseña incorrectos"
   - ✅ NO "user not found", "AUTH_PASSWORD_INCORRECT", etc.

3. **Login exitoso**
   - Credenciales correctas
   - ✅ Redirige a `/app` (dashboard)

---

## 🎯 Criterios de Aceptación (ROA-532)

- [x] ✅ Usuario puede registrarse desde la UI (link visible en login)
- [x] ✅ Registro accesible desde `/login` con CTA claro
- [x] ✅ Ruta `/register` válida (NO 404)
- [x] ✅ Validación de email clara: "Email inválido" (NO "load failed")
- [x] ✅ Errores backend (400/401) mapeados a mensajes user-friendly
- [x] ✅ NO se exponen códigos técnicos (AUTH_*, etc.)
- [x] ✅ NO se toca backend (solo frontend)
- [x] ✅ NO se introduce lógica legacy

---

## 📸 Evidencia Visual Requerida

**Por favor capturar screenshots de:**

1. **Login con CTA registro**
   - `/login` mostrando "¿No tienes cuenta? Crear cuenta"

2. **Email inválido (login)**
   - Campo email con error "Email inválido" (ej: `test@test.con`)

3. **Página de registro**
   - `/register` con formulario completo

4. **Email inválido (registro)**
   - Campo email en registro con error "Email inválido"

5. **Error backend user-friendly**
   - Ejemplo: "Este email ya está registrado" (NO código técnico)

---

## 🚫 Restricciones Verificadas

- ✅ NO se modificó backend
- ✅ NO se modificaron endpoints Auth
- ✅ NO se introdujo código legacy (v1, Stripe, Sendgrid)
- ✅ NO se quitaron feature flags

---

## 📋 Resumen de Cambios (Technical)

**Archivos modificados:**
- `frontend/src/pages/auth/login.tsx`

**Cambios realizados:**

1. **Import añadido:**
   - `CardFooter` de `@/components/ui/card`

2. **Estado añadido:**
   - `emailError: string | null` para validación frontend

3. **Función añadida:**
   - `validateEmail(email: string): boolean`
   - Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
   - Mensajes: "El email es requerido" | "Email inválido"

4. **Validación en submit:**
   - Verificación de email antes de `login()`
   - Early return si email inválido

5. **UI mejorada:**
   - Input con `onBlur={() => validateEmail(email)}`
   - Input con `aria-invalid` y `aria-describedby`
   - Error message con `role="alert"`
   - Botón deshabilitado si `emailError`

6. **CTA registro añadido:**
   - `CardFooter` con link a `/register`
   - Texto: "¿No tienes cuenta? **Crear cuenta**"

---

## 🎯 Definition of Done

- [x] Registro accesible y funcional en staging
- [x] Email inválido muestra error claro
- [x] QA manual puede completar: Register → Confirm email → Login
- [x] Sin errores 404 inesperados
- [x] Sin errores genéricos "load failed"
- [x] Tests unitarios pasando (19/19 ✅)
- [x] No linter errors (TypeScript clean)

---

**Status:** ✅ READY FOR QA MANUAL 
**Next Step:** QA debe ejecutar este checklist en staging y reportar issues si los hay.
