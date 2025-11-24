# Plan de Implementación - Issue #947

**Issue:** Migrar endpoints de Auth a Zod (P1 - Muy Recomendado)
**Priority:** P1
**Labels:** enhancement, auth, backend
**Created:** 2025-11-23
**Status:** Planning

---

## 📋 Resumen

Migrar la validación de endpoints de autenticación (`/api/auth/register`, `/api/auth/login`) de validaciones manuales a esquemas Zod. Esto mejora la estabilidad, previene payloads raros y ataques de "nested JSON", y proporciona mensajes de error más claros para UX.

---

## 🎯 Acceptance Criteria (6)

- [ ] Endpoints de auth usan Zod
- [ ] express-validator eliminado de estos endpoints
- [ ] Tests pasando al 100%
- [ ] Validación de email mejorada
- [ ] Validación de password mejorada
- [ ] No breaking changes en API contracts

---

## 🔍 Estado Actual

### Archivos Existentes

**`src/routes/auth.js`:**

- POST `/api/auth/register` (líneas 22-95): Validación manual con regex de email y `validatePassword()`
- POST `/api/auth/login` (líneas 135-190): Validación simple con `!email || !password`
- Usa validación inline en cada endpoint
- Email regex: `lines 36-37`
- Password validation: `lines 45-51` usando `utils/passwordValidator.js`

**Validación Actual:**

```javascript
// Register (líneas 27-32)
if (!email || !password) {
  return res.status(400).json({ error: 'Email and password are required' });
}

// Email validation (líneas 36-42)
const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@.../;
if (!emailRegex.test(email) || email.includes('..') || email.includes('@@')) {
  return res.status(400).json({ error: 'Invalid email format' });
}

// Login (líneas 137-143)
if (!email || !password) {
  return res.status(400).json({ error: 'Email and password are required' });
}
```

**Dependencias:**

- `express-validator`: NO se usa actualmente en auth.js
- `validatePassword` de `utils/passwordValidator.js`: Usado en register
- `zod`: v3.25.76 ya instalado

---

## 📝 Pasos de Implementación

### Paso 1: Crear Esquemas Zod

**Archivo:** `src/validators/zod/auth.schema.js` (nuevo)

**Tareas:**

1. Crear esquema `registerSchema`:
   - `email`: `z.string().email().refine()` con validaciones adicionales (no `..`, no `@@`)
   - `password`: `z.string().min(8).regex()` para complejidad (uppercase, lowercase, number, special)
   - `name`: `z.string().optional()` (usado en register)
2. Crear esquema `loginSchema`:
   - `email`: `z.string().email()` (más simple que register)
   - `password`: `z.string().min(1)` (solo no vacío)

3. Crear helper `formatZodError(zodError)`:
   - Convierte `zodError.errors` a mensajes user-friendly
   - Retorna array de strings para consistencia con validación actual

**Ejemplo esperado:**

```javascript
const { z } = require('zod');

const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .refine((email) => !email.includes('..'), 'Email cannot contain consecutive dots')
    .refine((email) => !email.includes('@@'), 'Email cannot contain @@'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase')
    .regex(/[a-z]/, 'Password must contain lowercase')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain special character'),
  name: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

const formatZodError = (zodError) => {
  return zodError.errors.map((err) => err.message).join('. ');
};

module.exports = { registerSchema, loginSchema, formatZodError };
```

**Validación:**

- Tests unitarios en `tests/unit/validators/auth.schema.test.js`
- Verificar que todos los casos de validación actuales están cubiertos
- Verificar mensajes de error consistentes con respuestas actuales

---

### Paso 2: Integrar Zod en `/api/auth/register`

**Archivo:** `src/routes/auth.js`

**Tareas:**

1. Importar esquemas: `const { registerSchema, formatZodError } = require('../validators/zod/auth.schema');`
2. Reemplazar validación manual (líneas 26-51) con:
   ```javascript
   const validation = registerSchema.safeParse(req.body);
   if (!validation.success) {
     return res.status(400).json({
       success: false,
       error: formatZodError(validation.error)
     });
   }
   const { email, password, name } = validation.data;
   ```
3. Eliminar código de validación manual (líneas 27-51)
4. Mantener lógica de negocio intacta (authService.signUp, emailService, etc.)

**Cambios:**

- Líneas 27-51: Reemplazar con `safeParse()` + `formatZodError()`
- Sin cambios en respuestas HTTP (mantener formato actual)
- Sin cambios en status codes (400, 201, 500)

---

### Paso 3: Integrar Zod en `/api/auth/login`

**Archivo:** `src/routes/auth.js`

**Tareas:**

1. Importar `loginSchema` (ya importado en Paso 2)
2. Reemplazar validación manual (líneas 137-143) con:
   ```javascript
   const validation = loginSchema.safeParse(req.body);
   if (!validation.success) {
     return res.status(400).json({
       success: false,
       error: formatZodError(validation.error)
     });
   }
   const { email, password } = validation.data;
   ```
3. Mantener lógica de autenticación intacta (authService.signInWithPassword, rate limiting, etc.)

**Cambios:**

- Líneas 137-143: Reemplazar con `safeParse()` + `formatZodError()`
- Sin cambios en respuestas HTTP
- Sin cambios en rate limiting (ya aplicado en línea 16)

---

### Paso 4: Tests Unitarios

**Archivo:** `tests/unit/validators/auth.schema.test.js` (nuevo)

**Tareas:**

1. Tests para `registerSchema`:
   - ✅ Valid email + strong password
   - ❌ Invalid email formats (no @, multiple @@, consecutive ..)
   - ❌ Weak passwords (sin uppercase, sin lowercase, sin number, sin special)
   - ❌ Short password (<8 chars)
   - ✅ Optional name field

2. Tests para `loginSchema`:
   - ✅ Valid email + password
   - ❌ Invalid email
   - ❌ Empty password

3. Tests para `formatZodError()`:
   - Verifica que convierte ZodError a string user-friendly
   - Verifica que múltiples errores se concatenan con `. `

**Coverage esperado:** 100% en `auth.schema.js`

---

### Paso 5: Tests de Integración

**Archivo:** `tests/integration/auth.test.js` (existente, actualizar si necesario)

**Tareas:**

1. Verificar tests existentes para POST `/api/auth/register`:
   - ✅ Registro exitoso con datos válidos
   - ❌ Email inválido (nested JSON, payloads raros)
   - ❌ Password débil
   - ❌ Campos faltantes

2. Verificar tests existentes para POST `/api/auth/login`:
   - ✅ Login exitoso
   - ❌ Email inválido
   - ❌ Password vacío
   - ❌ Credenciales incorrectas

3. **CRÍTICO:** Verificar que NO hay breaking changes:
   - Mensajes de error similares a versión actual
   - Status codes idénticos (400, 201, 500)
   - Estructura de respuesta JSON sin cambios

**Ejecución:**

```bash
npm test -- tests/integration/auth.test.js
```

**Resultado esperado:** 100% passing, 0 breaking changes

---

### Paso 6: Eliminar Código Legacy

**Archivos afectados:**

- `src/routes/auth.js`: Ya limpiado en Pasos 2 y 3
- `utils/passwordValidator.js`: **NO eliminar** - aún usado en otros lugares (password change, reset)

**Verificación:**

```bash
grep -r "validatePassword" src/routes/
# Debe mostrar SOLO usos en password-related endpoints (no auth.js)
```

---

## 🧪 Validación Final

### Pre-Commit Checklist

- [ ] Tests unitarios pasando: `npm test -- tests/unit/validators/auth.schema.test.js`
- [ ] Tests de integración pasando: `npm test -- tests/integration/auth.test.js`
- [ ] Coverage ≥90%: `npm run test:coverage`
- [ ] No breaking changes en API contracts
- [ ] GDD validado: `node scripts/validate-gdd-runtime.js --full`
- [ ] Health score ≥87: `node scripts/score-gdd-health.js --ci`
- [ ] Linter pasando: `npm run lint` (si existe)

### Verificación Manual

1. **Registro exitoso:**

   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test1234!","name":"Test User"}'
   ```

   Esperado: `201 Created`

2. **Email inválido:**

   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"invalid..email@test.com","password":"Test1234!"}'
   ```

   Esperado: `400 Bad Request` con mensaje "Email cannot contain consecutive dots"

3. **Password débil:**

   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"weak"}'
   ```

   Esperado: `400 Bad Request` con mensajes de complejidad

4. **Nested JSON attack:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":{"$ne":""},"password":"test"}'
   ```
   Esperado: `400 Bad Request` (Zod rechaza por tipo incorrecto)

---

## 🎯 Agentes Relevantes

- **Backend Developer** (implementación)
- **Test Engineer** (tests unitarios + integración)
- **Guardian** (validación de auth + seguridad)

---

## 📚 Referencias

- **Zod Docs:** https://zod.dev/
- **Issue #947:** Migrar endpoints de Auth a Zod
- **Related Files:**
  - `src/routes/auth.js`
  - `src/validators/zod/auth.schema.js` (nuevo)
  - `tests/unit/validators/auth.schema.test.js` (nuevo)
  - `tests/integration/auth.test.js` (existente)
- **CodeRabbit Lessons:** `docs/patterns/coderabbit-lessons.md`

---

## ⚠️ Riesgos y Mitigación

### Riesgo 1: Breaking Changes en API

**Probabilidad:** Media
**Impacto:** Alto
**Mitigación:**

- Tests de integración exhaustivos
- Verificar mensajes de error similares a versión actual
- Mantener estructura JSON de respuestas

### Riesgo 2: Password Validation Inconsistente

**Probabilidad:** Baja
**Impacto:** Medio
**Mitigación:**

- Copiar reglas exactas de `utils/passwordValidator.js`
- Tests que validan equivalencia con validación actual
- Verificar reglas en Zod schema vs código actual

### Riesgo 3: Performance Degradation

**Probabilidad:** Muy Baja
**Impacto:** Bajo
**Mitigación:**

- Zod es muy rápido (parseo inline)
- No hay diferencia significativa vs validación manual
- Monitorear logs de response time antes/después

---

## 📊 Métricas de Éxito

- ✅ 6/6 AC completados
- ✅ Tests 100% passing
- ✅ Coverage ≥90%
- ✅ 0 comentarios CodeRabbit
- ✅ 0 breaking changes detectados en tests
- ✅ GDD health ≥87

---

**Status:** ✅ Plan completo
**Next Step:** Paso 1 - Crear esquemas Zod
**Estimated Time:** 2-3 horas
