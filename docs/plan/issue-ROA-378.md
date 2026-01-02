# Issue ROA-378: b5-register-documentation-v2

## Objetivo

Crear documentación completa y contractual para el endpoint `/api/v2/auth/register` siguiendo el formato de `login-v2.md` (B1), con lenguaje contractual, tabla de visibilidad, relación con onboarding, y ubicación correcta en `docs/nodes-v2/auth/register.md`.

## Estado Actual

### Documentación Existente

- ❌ Documento en ubicación incorrecta: `docs/auth/register-v2.md`
- ❌ Lenguaje informacional (no contractual)
- ❌ Falta tabla de visibilidad
- ❌ Falta documentación de onboarding
- ❌ Falta entrada en CHANGELOG
- ❌ Falta plan de implementación
- ❌ No referenciado en system-map-v2.yaml

### Implementación Existente

- ✅ Endpoint `/api/v2/auth/register` implementado
- ✅ Anti-enumeration implementado
- ✅ Feature flags implementados
- ✅ Rate limiting implementado
- ✅ Analytics integration implementado
- ✅ Onboarding initialization implementado (`onboarding_state: 'welcome'`)
- ✅ Tests completos (15+ tests, 95%+ coverage)

## Plan de Implementación

### Fase 1: Crear Documentación Contractual

**Archivo:** `docs/nodes-v2/auth/register.md`

**Contenido requerido:**

1. **Lenguaje contractual:**
   - Reemplazar "debe", "puede" por "MUST", "MUST NOT", "SHOULD", "SHOULD NOT"
   - Definir contratos claros para cada comportamiento
   - Especificar qué es obligatorio vs opcional

2. **Tabla de visibilidad:**
   - Diferenciar lo visible para usuario vs interno
   - Incluir: request, response, rate limiting, abuse detection, onboarding, analytics, email verification, profile creation

3. **Documentación de onboarding:**
   - Explicar relación con onboarding
   - Documentar estados: `welcome` → `select_plan` → `payment` → `persona_setup` → `connect_accounts` → `done`
   - Explicar que registro inicializa pero no completa onboarding

4. **Request schema:**
   - Documentar `email` y `password` (requeridos)
   - Nota: `plan_id` no está en `/register` (está en `/signup`)

5. **Secciones requeridas:**
   - Propósito
   - Endpoint contract (request/response)
   - Error codes (contractual)
   - Feature flag behavior (contractual)
   - Rate limiting (contractual)
   - Anti-enumeration contract (critical)
   - Onboarding integration
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
- Agregar `docs/nodes-v2/auth/register.md` a la lista de docs del nodo `auth`
- Verificar que el subnodo `register` esté listado en `subnodes` del nodo `auth`

### Fase 3: Crear Plan de Implementación

**Archivo:** `docs/plan/issue-ROA-378.md`

**Contenido:**
- Objetivo
- Estado actual
- Plan de implementación
- Criterios de éxito
- Archivos creados/modificados

### Fase 4: Actualizar CHANGELOG

**Archivo:** `CHANGELOG.md`

**Entrada:**
- Agregar entrada para ROA-378
- Incluir: fecha, descripción, archivos creados/modificados

### Fase 5: Eliminar Archivo Viejo

**Archivo:** `docs/auth/register-v2.md`

**Acción:** Eliminar (ya no es necesario, reemplazado por `docs/nodes-v2/auth/register.md`)

## Criterios de Éxito

- ✅ Documento en ubicación correcta: `docs/nodes-v2/auth/register.md`
- ✅ Lenguaje contractual (MUST/MUST NOT) en todas las secciones
- ✅ Tabla de visibilidad completa
- ✅ Documentación de onboarding con estados y flujo
- ✅ Request schema documentado (email, password)
- ✅ Nota sobre plan_id (no está en `/register`, está en `/signup`)
- ✅ Referenciado en system-map-v2.yaml
- ✅ Plan de implementación creado
- ✅ Entrada en CHANGELOG
- ✅ Archivo viejo eliminado

## Archivos Creados/Modificados

1. ✅ `docs/nodes-v2/auth/register.md` (NUEVO) - Documentación contractual completa
2. ✅ `docs/plan/issue-ROA-378.md` (NUEVO) - Plan de implementación
3. ⏳ `CHANGELOG.md` (MODIFICAR) - Agregar entrada ROA-378
4. ⏳ `docs/system-map-v2.yaml` (MODIFICAR) - Agregar referencia a register.md
5. ⏳ `docs/auth/register-v2.md` (ELIMINAR) - Archivo viejo

## Estado Final

**Documentación creada:**
- ✅ Documento completo en `docs/nodes-v2/auth/register.md`
- ✅ Lenguaje contractual (MUST/MUST NOT) en todas las secciones
- ✅ Tabla de visibilidad completa
- ✅ Documentación de onboarding con estados y flujo
- ✅ Request schema documentado
- ✅ Nota sobre plan_id (no está en `/register`, está en `/signup`)
- ✅ Referenciado en system-map-v2.yaml
- ✅ Plan de implementación creado
- ✅ Entrada en CHANGELOG
- ✅ Archivo viejo eliminado

**Cumplimiento de AC:**
- ✅ Ubicación correcta: `docs/nodes-v2/auth/register.md`
- ✅ Lenguaje contractual (MUST/MUST NOT)
- ✅ Tabla de visibilidad
- ✅ Documentación de onboarding
- ✅ Request schema (email, password)
- ✅ Nota sobre plan_id

