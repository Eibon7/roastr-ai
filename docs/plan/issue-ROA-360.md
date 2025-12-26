# Plan de Implementación — ROA-360: B1 Login Backend V2 - Supabase Auth

**Issue:** ROA-360  
**Título:** B1 Login Backend V2 - Supabase Auth  
**Tipo:** Backend, Authentication  
**Prioridad:** Critical (P0)  
**Owner:** Back-end Dev  
**Branch:** `cursor/agent-backend-login-supabase-auth-28ab`  

---

## Estado Actual

### Contexto
- El sistema Roastr v2 necesita un backend de autenticación completo usando Supabase Auth
- Actualmente existe estructura en `apps/backend-v2/` pero no tiene endpoints de autenticación
- Documentación completa en `docs/nodes-v2/02-autenticacion-usuarios.md`
- SSOT v2 define estados, rate limiting, y configuración OAuth

### Arquitectura Existente
- `apps/backend-v2/` - Backend TypeScript con Hono/Express
- `docs/SSOT-V2.md` - Sección 7 (Auth & OAuth)
- `docs/nodes-v2/02-autenticacion-usuarios.md` - Especificación completa
- `system-map-v2.yaml` - Nodo `auth` con cobertura 0%

### Limitaciones
- No hay endpoints de autenticación implementados
- No hay middleware de auth
- No hay rate limiting v2 implementado
- No hay tests de autenticación

---

## Acceptance Criteria (desde docs/nodes-v2/02-autenticacion-usuarios.md)

### Signup
- [ ] Signup requiere email + password + plan
- [ ] Usuario creado en `users` table
- [ ] Perfil creado en `profiles` table
- [ ] Onboarding wizard iniciado
- [ ] Método de pago se valida en checkout (no en signup)

### Login
- [ ] Login con email + password funciona
- [ ] Magic link solo para role=user (si habilitado)
- [ ] Admin y superadmin NUNCA pueden usar magic link
- [ ] Sesión user persiste 7 días
- [ ] Sesión admin/superadmin expira tras 24h
- [ ] Inactividad > 4h → logout automático (admin/superadmin)

### Roles
- [ ] role=user → redirect a User App
- [ ] role=admin → redirect a Admin Panel
- [ ] role=superadmin → redirect a Admin Panel (con permisos extra)
- [ ] Admin NO tiene sesión persistente
- [ ] Superadmin requiere password + confirmación para acciones críticas

### Rate Limiting (SSOT v2 - Sección 7.4)
- [ ] Login: 5 intentos por 15 min → bloqueo 15 min
- [ ] Magic Link: 3 intentos por 1h → bloqueo 1h
- [ ] OAuth: 10 intentos por 15 min → bloqueo 15 min
- [ ] Password Reset: 3 intentos por 1h → bloqueo 1h
- [ ] Bloqueo progresivo: 15min → 1h → 24h → permanente

### Abuse Detection (SSOT v2 - Sección 7.5)
- [ ] Multi-IP: 3 IPs diferentes para mismo email
- [ ] Multi-Email: 5 emails diferentes para misma IP
- [ ] Burst Attack: 10 intentos en 1 minuto
- [ ] Slow Attack: 20 intentos en 1 hora

---

## Pasos de Implementación

### FASE 0 ✅ — Assessment con GDD
- [x] Worktree creado en rama `cursor/agent-backend-login-supabase-auth-28ab`
- [x] `.issue_lock` actualizado
- [x] Nodos GDD resueltos: `auth`, `infraestructura`, `ssot-integration`
- [x] Documentación leída: `docs/nodes-v2/02-autenticacion-usuarios.md`, `docs/SSOT-V2.md`

### FASE 1 🟢 — Planning
- [x] Plan creado en `docs/plan/issue-ROA-360.md`

### FASE 2 — Activación de Agents
**Agents necesarios:**
- `BackendDev` - Implementación de endpoints y middleware
- `TestEngineer` - Tests unitarios, integración, E2E
- `Guardian` - Validación de seguridad y SSOT compliance

**Comando:**
```bash
node scripts/cursor-agents/detect-triggers.js
```

### FASE 3 — Implementación de Endpoints

#### 3.1. Estructura de Directorios
```
apps/backend-v2/src/
├── routes/
│   └── auth.ts              # Nuevos endpoints de autenticación
├── middleware/
│   ├── auth.ts              # Middleware de autenticación
│   └── rateLimit.ts         # Rate limiting v2
├── services/
│   ├── authService.ts       # Lógica de autenticación
│   ├── rateLimitService.ts  # Rate limiting
│   └── abuseDetectionService.ts  # Abuse detection
├── lib/
│   └── supabaseClient.ts    # Cliente Supabase
└── utils/
    └── authErrorTaxonomy.ts # Taxonomía de errores (ROA-372)
```

#### 3.2. Endpoints a Implementar
```typescript
POST /api/v2/auth/signup
POST /api/v2/auth/login
POST /api/v2/auth/logout
POST /api/v2/auth/refresh
POST /api/v2/auth/magic-link
POST /api/v2/auth/verify-magic-link
POST /api/v2/auth/password-reset
POST /api/v2/auth/password-change
GET  /api/v2/auth/me
```

#### 3.3. Middleware
- `authMiddleware` - Verificación de token JWT
- `roleMiddleware` - Verificación de roles (user, admin, superadmin)
- `rateLimitMiddleware` - Rate limiting por tipo de auth
- `abuseDetectionMiddleware` - Detección de abuse patterns

#### 3.4. Servicios
- `authService` - Lógica de autenticación con Supabase Auth
- `rateLimitService` - Implementación de rate limiting (SSOT 7.4)
- `abuseDetectionService` - Detección de abuse (SSOT 7.5)
- `sessionService` - Gestión de sesiones por rol

### FASE 4 — Rate Limiting & Abuse Detection

#### 4.1. Rate Limiting v2 (SSOT 7.4)
```typescript
// Configuración desde SSOT
const rateLimits = {
  login: { windowMs: 900000, maxAttempts: 5, blockDurationMs: 900000 },
  magic_link: { windowMs: 3600000, maxAttempts: 3, blockDurationMs: 3600000 },
  oauth: { windowMs: 900000, maxAttempts: 10, blockDurationMs: 900000 },
  password_reset: { windowMs: 3600000, maxAttempts: 3, blockDurationMs: 3600000 }
};
```

#### 4.2. Abuse Detection (SSOT 7.5)
```typescript
const abuseThresholds = {
  multi_ip: 3,
  multi_email: 5,
  burst: 10,
  slow_attack: 20
};
```

#### 4.3. Storage
- **Producción:** Redis/Upstash
- **Fallback:** Memoria (solo dev/testing)
- **Keys:** `auth:ratelimit:ip:${authType}:${ip}` y `auth:ratelimit:email:${authType}:${emailHash}`

### FASE 5 — Tests

#### 5.1. Unit Tests (Vitest)
**Archivo:** `apps/backend-v2/tests/unit/services/authService.test.ts`
- Validación de email (case-insensitive, formato)
- Validación de password (≥ 8 chars)
- Lógica de rate limiting
- Detección de abuse patterns
- Error taxonomy

**Archivo:** `apps/backend-v2/tests/unit/middleware/auth.test.ts`
- Verificación de JWT válido
- Verificación de JWT expirado
- Verificación de roles
- Rate limiting por endpoint

#### 5.2. Integration Tests (Supabase Test)
**Archivo:** `apps/backend-v2/tests/integration/auth.test.ts`
- Signup completo (user + profile creados)
- Login con credenciales válidas
- Login con credenciales inválidas (error genérico)
- Magic link generation (si habilitado)
- Sesión expira según rol
- Cambio de contraseña invalida sesiones
- Rate limiting funcional
- Abuse detection funcional

#### 5.3. E2E Tests (Playwright)
**Archivo:** `tests/e2e/auth.spec.js`
- Signup flow completo (email + password + plan)
- Login flow (email+password)
- Magic link flow (si habilitado)
- Logout manual
- Logout automático por inactividad (admin)
- Redirect según rol (user vs admin)

### FASE 6 — Validación y Documentación

#### 6.1. Validación GDD
```bash
node scripts/validate-v2-doc-paths.js --ci
node scripts/validate-ssot-health.js --ci
node scripts/check-system-map-drift.js --ci
node scripts/validate-strong-concepts.js --ci
```

#### 6.2. Coverage Target
- **Target:** ≥90% coverage (según SSOT)
- **Comando:** `npm run test:coverage`

#### 6.3. Actualizar Nodos GDD
- Actualizar `docs/nodes-v2/02-autenticacion-usuarios.md`
  - Coverage: actualizar a valor real
  - Files: añadir archivos implementados
  - Subnodes: crear subnodos si es necesario
- Actualizar `system-map-v2.yaml`
  - auth.coverage: actualizar
  - auth.files: añadir archivos

### FASE 7 — Pre-Push Checklist

#### 7.1. Verificaciones Obligatorias
- [ ] Tests pasando al 100%
- [ ] Coverage ≥90%
- [ ] GDD validado (validate-v2-doc-paths.js)
- [ ] SSOT health passing (validate-ssot-health.js)
- [ ] System map drift = 0 (check-system-map-drift.js)
- [ ] Strong concepts válidos (validate-strong-concepts.js)
- [ ] No conflictos con main
- [ ] Branch lock correcto (cursor/agent-backend-login-supabase-auth-28ab)

#### 7.2. Documentación
- [ ] Nodo GDD actualizado con coverage real
- [ ] System-map actualizado con files
- [ ] Test evidence generado en `docs/test-evidence/ROA-360/`
- [ ] Receipts generados si aplica

#### 7.3. Commit
```bash
git add .
git commit -m "fix(ROA-360): Implementar Login Backend V2 con Supabase Auth

- Endpoints de autenticación completos (signup, login, logout, refresh)
- Rate limiting v2 según SSOT 7.4
- Abuse detection según SSOT 7.5
- Middleware de auth y roles
- Tests: unit (vitest) + integration (supabase) + E2E (playwright)
- Coverage: 92%
- GDD: nodo auth actualizado
"
```

---

## Archivos Afectados

### Nuevos Archivos
```
apps/backend-v2/src/routes/auth.ts
apps/backend-v2/src/middleware/auth.ts
apps/backend-v2/src/middleware/rateLimit.ts
apps/backend-v2/src/services/authService.ts
apps/backend-v2/src/services/rateLimitService.ts
apps/backend-v2/src/services/abuseDetectionService.ts
apps/backend-v2/src/services/sessionService.ts
apps/backend-v2/src/lib/supabaseClient.ts
apps/backend-v2/src/utils/authErrorTaxonomy.ts
apps/backend-v2/tests/unit/services/authService.test.ts
apps/backend-v2/tests/unit/middleware/auth.test.ts
apps/backend-v2/tests/integration/auth.test.ts
tests/e2e/auth.spec.js
docs/test-evidence/ROA-360/summary.md
```

### Archivos Modificados
```
docs/nodes-v2/02-autenticacion-usuarios.md (coverage, files)
docs/system-map-v2.yaml (auth node)
apps/backend-v2/src/index.ts (registrar rutas)
apps/backend-v2/package.json (dependencias si es necesario)
```

---

## Agentes Relevantes

- `BackendDev` - Implementación de endpoints y servicios
- `TestEngineer` - Tests unitarios, integración, E2E
- `Guardian` - Validación de seguridad y SSOT compliance

---

## Referencias

### Documentación GDD
- `docs/nodes-v2/02-autenticacion-usuarios.md` - Especificación completa del nodo auth
- `docs/SSOT-V2.md` - Sección 7 (Auth & OAuth), 7.4 (Rate Limiting), 7.5 (Abuse Detection)
- `docs/system-map-v2.yaml` - Nodo `auth` (línea 558)

### SSOT References
- `connection_status` - Estados de conexión OAuth
- `feature_flags` - Feature flags de autenticación
- `oauth_pkce_flow` - Flujo PKCE de OAuth
- `oauth_scopes` - Scopes OAuth requeridos
- `oauth_tokens` - Estructura de tokens OAuth
- `plan_ids` - IDs de planes para asignación inicial
- `subscription_states` - Estados de suscripción
- `token_refresh_rules` - Reglas de refresh de tokens

### Issues Relacionadas
- ROA-372 - Define Auth Error Taxonomy in SSOT v2 (TBD)
- ROA-357 - Auth Events Taxonomy v2 (implementado)
- ROA-359 - Abuse Detection Thresholds (implementado en SSOT)

---

## Validación Requerida

### Pre-Commit
```bash
# 1. Tests
npm test -- apps/backend-v2/tests/

# 2. Coverage
npm run test:coverage

# 3. GDD validations
node scripts/validate-v2-doc-paths.js --ci
node scripts/validate-ssot-health.js --ci
node scripts/check-system-map-drift.js --ci
node scripts/validate-strong-concepts.js --ci
```

### Expected Results
- Tests: 100% passing
- Coverage: ≥90%
- GDD validations: all passing
- System map drift: 0
- SSOT alignment: true

---

## Notas de Implementación

### Seguridad
- ✅ NUNCA exponer si un email existe (anti-enumeration)
- ✅ Rate limiting obligatorio en todos los endpoints de auth
- ✅ Abuse detection activo
- ✅ Magic link SOLO para role=user (NUNCA admin/superadmin)
- ✅ Sesiones con expiración diferenciada por rol

### SSOT Compliance
- ✅ Usar IDs de plan válidos v2: `starter`, `pro`, `plus`
- ✅ NO usar IDs legacy: `free`, `basic`, `creator_plus`
- ✅ Rate limits según SSOT 7.4
- ✅ Abuse thresholds según SSOT 7.5

### Evitar AI-Slop
- ❌ NO comentarios obvios
- ❌ NO try/catch innecesarios
- ❌ NO validaciones redundantes
- ❌ NO casteos a `any`
- ✅ Código limpio y directo

---

**Última actualización:** 2025-12-20  
**Estado:** En progreso - FASE 1 completada  
**Next:** FASE 2 - Activación de Agents
