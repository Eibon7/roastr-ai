# Plan de Implementación: ROA-383 - B5: Password Recovery Documentation v2

**Issue:** ROA-383  
**Título:** B5: Password Recovery Documentation v2  
**Prioridad:** P2  
**Tipo:** Documentación  
**Fecha:** 2026-01-05

---

## Estado Actual

### Documentación Existente

El archivo `docs/nodes-v2/auth/password-recovery.md` ya existe (creado en ROA-379) y contiene documentación bastante completa sobre password recovery. Sin embargo, necesita revisión para asegurar cumplimiento total con el formato "B5" y alineación perfecta con SSOT v2.

**Fortalezas actuales:**
- ✅ Estructura contractual presente (Request/Response contracts)
- ✅ Error taxonomy completa con tabla
- ✅ Feature flags documentados
- ✅ Rate limiting bien especificado
- ✅ Anti-enumeration contract (CRITICAL)
- ✅ Token security contract
- ✅ Visibility table presente
- ✅ Diagrama mermaid al final
- ✅ Usage examples en TypeScript
- ✅ Troubleshooting section

### Gaps Detectados

❌ **Inconsistencias con SSOT v2:**
- Línea 232: Doc dice `default: true` pero SSOT v2 (sección 3.2) dice `default: false` (fail-closed)
- Feature flag `auth_enable_password_recovery` debe ser fail-closed por defecto

❌ **Mejoras de formato B5:**
- Falta sección explícita de "Flujos completos" más prominente
- Diagrama mermaid podría estar más arriba (después de endpoints)
- Falta clarity en diferencia entre rate limiting types (password_recovery vs password_reset)

❌ **Validaciones pendientes:**
- Verificar que todos los valores están alineados con SSOT v2
- Asegurar que Strong Concepts están bien documentados
- Validar que dependencias del system-map son correctas

---

## Objetivos

### 1. Corregir Alineación con SSOT v2

**Correcciones obligatorias:**

- **Feature flag default (CRÍTICO):**
  ```yaml
  # ACTUAL (INCORRECTO):
  Default: true (password recovery habilitado por defecto)
  
  # CORRECTO (SSOT v2, sección 3.2):
  Default: false (fail-closed for security)
  ```

- **Comportamiento fail-closed:**
  - Documentar claramente que si el flag está OFF, el endpoint **MUST** fail-closed (no simular éxito)
  - Actualizar ejemplos de código para reflejar esto
  - Añadir eventos de observabilidad: `auth_feature_blocked` con flag context

### 2. Mejorar Formato B5

**Ajustes de estructura:**

- **Mover diagrama mermaid más arriba:**
  - Después de documentar ambos endpoints (`/password-recovery` y `/update-password`)
  - Antes de secciones técnicas (Error Codes, Feature Flags, etc.)
  - Título: "## 🔄 Complete Password Recovery Flow"

- **Clarificar rate limiting types:**
  - Explicitar que `password_recovery` type se usa para ambos endpoints
  - Documentar que el límite es compartido entre `/password-recovery` y `/update-password`
  - Referencia clara a SSOT v2 sección 12.4

- **Mejorar Visibility Table:**
  - Añadir más filas para cubrir todos los aspectos
  - Incluir feature flags visibility
  - Incluir observability events visibility

### 3. Validar Strong Concepts

**Verificar que el documento:**

- ✅ No duplica Strong Concepts de otros nodos
- ✅ Referencia correctamente `authErrorTaxonomy` (dueño: auth/error-taxonomy.md)
- ✅ Referencia correctamente `rateLimitConfig` (dueño: auth/rate-limiting.md)
- ✅ No define sus propios error codes (solo usa los del taxonomy)

### 4. Actualizar Referencias

**Asegurar que todas las referencias son correctas:**

- Referencias a SSOT v2: Sección 3.2 (feature flags), 12.4 (rate limiting)
- Referencias a otros subnodos: overview.md, login-flows.md, rate-limiting.md, error-taxonomy.md
- Referencias a implementación: authService.ts, authEmailService.ts

---

## Pasos de Implementación

### Paso 1: Corregir Feature Flag Default (CRÍTICO)

**Archivo:** `docs/nodes-v2/auth/password-recovery.md`

**Cambios en sección "🎛️ Feature Flag Behavior":**

```markdown
### `auth_enable_password_recovery`

**Source:** `admin-controlled.yaml` o `admin_settings` table (Supabase)

**Default:** `false` (fail-closed for security - SSOT v2, sección 3.2)

**Fallback:** No environment variable fallbacks (SSOT v2 enforcement)

**Contract:**

1. El endpoint **MUST** verificar `auth_enable_password_recovery` **ANTES** de cualquier validación
2. Si `auth_enable_password_recovery === false` → **MUST** retornar `AUTH_DISABLED` (403)
3. **MUST NOT** procesar password recovery si feature flag está deshabilitado
4. **MUST** emitir evento de observabilidad: `auth_feature_blocked` con flag context
5. **MUST** fail-closed (no simular éxito si infraestructura está deshabilitada)
```

**Cambios en configuración de ejemplo:**

```yaml
feature_flags:
  auth_enable_password_recovery: false  # Default: false (fail-closed)
  auth_enable_emails: false             # Default: false (fail-closed)
```

### Paso 2: Reorganizar Contenido (Flujo más Prominente)

**Nueva estructura de secciones:**

1. 📋 Propósito
2. 🔐 POST /api/v2/auth/password-recovery (Request/Response)
3. 🔐 POST /api/v2/auth/update-password (Request/Response)
4. **🔄 Complete Password Recovery Flow** ← MOVER AQUÍ (diagrama mermaid)
5. 🚨 Error Codes (Contractual)
6. 🎛️ Feature Flag Behavior (Contractual)
7. 🛡️ Rate Limiting (Contractual)
8. 🔒 Anti-Enumeration Contract (CRITICAL)
9. 🔐 Token Security (Contractual)
10. 🚫 Restrictions
11. 🔗 Redirect URL Configuration
12. 📊 Analytics Integration (Contractual)
13. 👁️ Visibility Table
14. 🔗 Relación con A3/A4 Contracts
15. 📊 Tests & Coverage
16. 🔧 Configuration
17. 🚀 Usage Examples
18. 🔍 Security Considerations
19. 📚 Related Documentation
20. 🐛 Troubleshooting

### Paso 3: Clarificar Rate Limiting

**Añadir en sección "🛡️ Rate Limiting":**

```markdown
### Rate Limit Type Sharing (IMPORTANT)

**Tipo compartido:** `password_recovery`

Los endpoints `/password-recovery` y `/update-password` **MUST** compartir el mismo tipo de rate limiting:

**Razón:** Prevenir abuse patterns donde atacantes alternan entre solicitar recovery y actualizar password.

**Implicación:** 
- Si un usuario excede el límite en `/password-recovery`, también estará bloqueado en `/update-password`
- Los 3 intentos / 1 hora aplican al flujo completo, no por endpoint

**Ejemplo:**
```typescript
// Usuario solicita recovery 3 veces (límite alcanzado)
POST /api/v2/auth/password-recovery (attempt 1) ✅
POST /api/v2/auth/password-recovery (attempt 2) ✅
POST /api/v2/auth/password-recovery (attempt 3) ✅
POST /api/v2/auth/password-recovery (attempt 4) ❌ 429 POLICY_RATE_LIMITED

// Ahora también está bloqueado en update-password
POST /api/v2/auth/update-password ❌ 429 POLICY_RATE_LIMITED
```
```

### Paso 4: Mejorar Visibility Table

**Expandir tabla con más filas:**

```markdown
| Aspecto | Visible para Usuario | No Visible (Internal) |
|---------|---------------------|----------------------|
| **Request (password-recovery)** | Email (input) | Normalización de email, validaciones internas |
| **Request (update-password)** | Password (input) | Validaciones internas, token validation |
| **Response Success (password-recovery)** | `{ success: true, message }` | Si email existe o no, role del usuario, envío de email |
| **Response Success (update-password)** | `{ success: true, message }` | User ID, token invalidation, analytics |
| **Response Error** | Error slug, mensaje genérico | Detalles técnicos, stack traces, request_id (solo logs) |
| **Rate Limiting** | `POLICY_RATE_LIMITED` con `retry_after_seconds` | IP tracking, contador de intentos, progressive blocking |
| **Token Security** | `TOKEN_INVALID` (mensaje genérico) | Detalles del token, expiración, validation interna |
| **Email Sending** | Mensaje genérico de éxito | Provider usado (Resend), infraestructura de email, errores de envío |
| **Analytics** | N/A (no visible) | Eventos trackeados, userId, duración, métricas |
| **Feature Flags** | N/A (no visible directamente) | Estado de flags, configuración, fallbacks |
| **Feature Blocking** | `AUTH_DISABLED` error | Evento `auth_feature_blocked`, flag name, policy context |
```

### Paso 5: Actualizar Observability Events

**Añadir en sección "📊 Analytics Integration":**

```markdown
### Feature Blocking Events

**Cuando feature flag está OFF:**

**Evento:** `auth_feature_blocked`
```typescript
{
  feature: 'password_recovery',
  flag: 'auth_enable_password_recovery',
  flag_value: false,
  endpoint: '/api/v2/auth/password-recovery',
  timestamp: ISO8601,
  // NO incluir PII (email)
}
```

**Amplitude event:**
- `auth_endpoint_blocked` (properties: endpoint, flag, reason)

**Logging:**
```typescript
logger.warn('auth.feature_disabled', {
  feature: 'password_recovery',
  flag: 'auth_enable_password_recovery',
  request_id: context.request_id
  // NO incluir email ni datos sensibles
});
```
```

### Paso 6: Validaciones

**Ejecutar scripts de validación:**

```bash
# 1. Validar estructura v2
node scripts/validate-v2-doc-paths.js --ci

# 2. Validar alineación con SSOT
node scripts/validate-ssot-health.js --ci

# 3. Validar no hay drift
node scripts/check-system-map-drift.js --ci

# 4. Validar Strong Concepts no duplicados
node scripts/validate-strong-concepts.js --ci
```

**Verificar manualmente:**
- [ ] Todos los valores de feature flags coinciden con SSOT v2
- [ ] Rate limiting values coinciden con SSOT v2 (sección 12.4)
- [ ] No hay duplicación de Strong Concepts
- [ ] Referencias a otros subnodos son correctas
- [ ] Ejemplos de código son funcionales
- [ ] Diagrama mermaid renderiza correctamente

---

## Agentes Involucrados

### Primary: DocumentationAgent (Manual - Cursor Composer)

**Triggers:**
- type:docs
- Cambios en `docs/nodes-v2/auth/password-recovery.md`

**Workflow:**
1. Usar Composer → @docs/SSOT-V2.md @docs/nodes-v2/auth/password-recovery.md
2. Aplicar cambios según pasos 1-5
3. Reorganizar contenido para mejor flujo
4. Validar con scripts

### Guardian (Validación)

**Triggers:**
- Cambios en `docs/nodes-v2/` (área crítica)
- Cambios en feature flags documentation

**Workflow:**
```bash
node scripts/guardian-gdd.js --full
```

### Validation (Pre-Commit)

**Scripts obligatorios:**
- `validate-v2-doc-paths.js --ci`
- `validate-ssot-health.js --ci`
- `check-system-map-drift.js --ci`
- `validate-strong-concepts.js --ci`

---

## Archivos Afectados

### Archivos Modificados

```
docs/nodes-v2/auth/password-recovery.md   # Correcciones y mejoras
```

### Archivos NO Modificados (Solo Referencias)

```
docs/SSOT-V2.md                          # Referencia para feature flags
docs/system-map-v2.yaml                   # Referencia para dependencias
docs/nodes-v2/auth/overview.md            # Referencia para contexto
docs/nodes-v2/auth/rate-limiting.md       # Referencia para rate limits
docs/nodes-v2/auth/error-taxonomy.md      # Referencia para error codes
```

---

## Validación

### Checklist Pre-Commit

- [ ] Feature flag default corregido: `false` (fail-closed)
- [ ] Comportamiento fail-closed documentado explícitamente
- [ ] Eventos de observabilidad `auth_feature_blocked` documentados
- [ ] Diagrama mermaid movido a sección más prominente
- [ ] Rate limiting type sharing clarificado
- [ ] Visibility table expandida con feature blocking
- [ ] Ninguna referencia a valores hardcoded (todos desde SSOT v2)
- [ ] Strong Concepts correctamente referenciados (no duplicados)
- [ ] Todos los valores de rate limiting coinciden con SSOT v2 (12.4)
- [ ] `validate-v2-doc-paths.js --ci` pasa
- [ ] `validate-ssot-health.js --ci` pasa
- [ ] `check-system-map-drift.js --ci` pasa
- [ ] `validate-strong-concepts.js --ci` pasa

### Criterios de Éxito

✅ **Alineación perfecta con SSOT v2** - Feature flag defaults corregidos  
✅ **Formato B5 completo** - Estructura reorganizada, flujo prominente  
✅ **Claridad en rate limiting** - Type sharing bien documentado  
✅ **Observability completa** - Eventos de feature blocking documentados  
✅ **Visibility table completa** - Todos los aspectos cubiertos  
✅ **Strong Concepts respetados** - Solo referencias, no duplicación  
✅ **Validaciones pasando** - Todos los scripts CI en verde  

---

## Scope Out (NO incluir)

❌ Cambios en implementación de código (solo documentación)  
❌ Nuevos endpoints (solo documentar los existentes)  
❌ Cambios en SSOT v2 (solo alinearse a él)  
❌ Modificaciones a system-map-v2.yaml (ya está correcto)  

---

## Referencias Obligatorias

- **SSOT v2:** Sección 3.2 (feature flags), 12.4 (rate limiting)
- **system-map-v2.yaml:** Nodo `auth` con subnodo `password-recovery`
- **ROA-379:** Issue que creó el documento original
- **ROA-364:** Issue similar (Login Documentation v2) - formato de referencia
- **password-recovery.md:** Archivo actual a mejorar

---

## Diferencias con ROA-379

**ROA-379 (B1):** Creó la documentación inicial de password recovery  
**ROA-383 (B5):** Revisa y mejora la documentación para cumplir estándar B5

**Cambios principales en ROA-383:**
1. Corregir alineación con SSOT v2 (feature flag defaults)
2. Mejorar formato para seguir estándar B5 completo
3. Clarificar comportamientos complejos (rate limiting sharing)
4. Expandir observability y visibility documentation
5. Asegurar validaciones CI pasan

---

**Última actualización:** 2026-01-05  
**Estado:** Planning completo - Listo para implementación

