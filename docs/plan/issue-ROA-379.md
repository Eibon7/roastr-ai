# Issue ROA-379: B1 Password Recovery Backend v2

## Objetivo

Crear documentación completa y contractual para los endpoints de password recovery (`POST /api/v2/auth/password-recovery` y `POST /api/v2/auth/update-password`) siguiendo el formato de `register.md` (B5), con lenguaje contractual, tabla de visibilidad, y ubicación correcta en `docs/nodes-v2/auth/password-recovery.md`.

## Estado Actual

### Documentación Existente

- ✅ Password Recovery documentado en `docs/nodes-v2/auth/login-flows.md` (ROA-371)
- ❌ Falta documento contractual dedicado (`password-recovery.md`)
- ❌ Falta tabla de visibilidad
- ❌ Lenguaje informacional (no contractual completo)
- ❌ No referenciado en system-map-v2.yaml como subnodo

### Implementación Existente

- ✅ Endpoint `/api/v2/auth/password-recovery` implementado
- ✅ Endpoint `/api/v2/auth/update-password` implementado
- ✅ Anti-enumeration implementado
- ✅ Feature flags implementados
- ✅ Rate limiting implementado
- ✅ Analytics integration implementado
- ✅ Tests completos (integration + unit)

## Plan de Implementación

### Fase 1: Crear Documentación Contractual

**Archivo:** `docs/nodes-v2/auth/password-recovery.md`

**Contenido requerido:**

1. **Lenguaje contractual:**
   - Reemplazar "debe", "puede" por "MUST", "MUST NOT", "SHOULD", "SHOULD NOT"
   - Definir contratos claros para cada comportamiento
   - Especificar qué es obligatorio vs opcional

2. **Tabla de visibilidad:**
   - Diferenciar lo visible para usuario vs interno
   - Incluir: request, response, rate limiting, feature flags, email sending, token handling, observability

3. **Documentación de ambos endpoints:**
   - `POST /api/v2/auth/password-recovery` (request recovery email)
   - `POST /api/v2/auth/update-password` (update password with token)

4. **Request/Response schemas:**
   - Documentar ambos endpoints completamente
   - Incluir validaciones, error codes, y contratos

5. **Secciones requeridas:**
   - Propósito
   - Endpoint contracts (request/response para ambos)
   - Error codes (contractual)
   - Feature flag behavior (contractual)
   - Rate limiting (contractual)
   - Anti-enumeration contract (critical)
   - Token security
   - Redirect URL configuration
   - Analytics integration (contractual)
   - Visibility table
   - Relación con A3/A4 contracts
   - Tests & coverage
   - Configuration
   - Usage examples
   - Security considerations
   - Related documentation
   - Troubleshooting
   - Integration flow (Mermaid diagram)

### Fase 2: Actualizar system-map-v2.yaml

**Archivo:** `docs/system-map-v2.yaml`

**Cambios:**
- Agregar `docs/nodes-v2/auth/password-recovery.md` a la lista de docs del nodo `auth`
- Verificar que el subnodo `password-recovery` esté listado en `subnodes` del nodo `auth`

### Fase 3: Actualizar login-flows.md (Opcional)

**Archivo:** `docs/nodes-v2/auth/login-flows.md`

**Consideración:**
- ROA-371 ya documentó password recovery en `login-flows.md`
- Podemos mantener una referencia o mover contenido
- Decisión: Mantener referencia corta en `login-flows.md` y contenido completo en `password-recovery.md`

## Criterios de Éxito

- ✅ Documento en ubicación correcta: `docs/nodes-v2/auth/password-recovery.md`
- ✅ Lenguaje contractual (MUST/MUST NOT) en todas las secciones
- ✅ Tabla de visibilidad completa
- ✅ Documentación de ambos endpoints (`/password-recovery` y `/update-password`)
- ✅ Request/response schemas documentados completamente
- ✅ Referenciado en system-map-v2.yaml
- ✅ Plan de implementación creado

## Archivos Creados/Modificados

1. ⏳ `docs/nodes-v2/auth/password-recovery.md` (NUEVO) - Documentación contractual completa
2. ✅ `docs/plan/issue-ROA-379.md` (NUEVO) - Plan de implementación (este archivo)
3. ⏳ `docs/system-map-v2.yaml` (MODIFICAR) - Agregar referencia a password-recovery.md

## Referencias

- **ROA-378:** Formato de referencia para documentación contractual (`register.md`)
- **ROA-371:** Implementación y documentación inicial en `login-flows.md`
- **ROA-360:** Formato B1 Login Backend v2

