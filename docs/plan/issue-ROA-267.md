# Implementation Plan: Issue ROA-267 - Crear Endpoints Públicos de SSOT para Frontend v2

**Issue:** ROA-267  
**Priority:** P1  
**Estimated Time:** 2-3 hours  
**Labels:** `backend`, `api`, `ssot`, `frontend-v2`

---

## Estado Actual

### Situación Actual

- Existen endpoints parciales para información de SSOT:
  - `/api/plan/available` - Lista planes (público)
  - `/api/config/flags` - Feature flags (público)
  - `/api/config/levels/definitions` - Definiciones de niveles (requiere auth)

- **Problema:** No hay un conjunto estructurado de endpoints públicos que expongan toda la información del SSOT-V2.md de forma consistente para frontend v2.

- **Necesidad:** Frontend v2 necesita acceso público a:
  - Planes y límites (sección 1 del SSOT)
  - Feature flags públicos (sección 3 del SSOT)
  - Tonos válidos
  - Estados de suscripción válidos
  - Restricciones de plataformas
  - Límites funcionales por plan

---

## Plan de Implementación

### FASE 1: Crear archivo de rutas SSOT

**Archivo:** `src/routes/ssot.js`

**Endpoints a crear:**

1. **GET /api/ssot/plans**
   - Público (sin autenticación)
   - Retorna: IDs de plan válidos, límites mensuales, capacidades por plan
   - Fuente: SSOT-V2.md sección 1

2. **GET /api/ssot/limits**
   - Público (sin autenticación)
   - Retorna: Límites funcionales por plan (analysis_limit, roast_limit, accounts_per_platform, etc.)
   - Fuente: SSOT-V2.md sección 1.3

3. **GET /api/ssot/features**
   - Público (sin autenticación)
   - Retorna: Feature flags públicos permitidos, semántica breve
   - Fuente: SSOT-V2.md sección 3

4. **GET /api/ssot/tones**
   - Público (sin autenticación)
   - Retorna: Tonos válidos (Flanders, Balanceado, Canalla, Personal)
   - Fuente: SSOT-V2.md y config/tones.js

5. **GET /api/ssot/subscription-states**
   - Público (sin autenticación)
   - Retorna: Estados de suscripción válidos (trialing, active, paused, etc.)
   - Fuente: SSOT-V2.md sección 2.2

6. **GET /api/ssot/platforms**
   - Público (sin autenticación)
   - Retorna: Plataformas soportadas y restricciones
   - Fuente: SSOT-V2.md (si existe) o integraciones existentes

### FASE 2: Integrar rutas en servidor principal

**Archivo:** `src/index.js`

- Añadir import de rutas SSOT
- Registrar rutas en `/api/ssot`

### FASE 3: Crear servicio SSOT

**Archivo:** `src/services/ssotService.js`

- Servicio que lee y estructura datos del SSOT-V2.md
- Funciones helper para cada sección del SSOT
- Validación de que los datos expuestos coinciden con SSOT

### FASE 4: Tests

**Archivo:** `tests/unit/routes/ssot.test.js`

- Tests para cada endpoint
- Validación de estructura de respuesta
- Validación de que los datos coinciden con SSOT-V2.md

### FASE 5: Documentación

- Actualizar `API_CONTRACTS.md` con nuevos endpoints
- Documentar en nodo GDD correspondiente (ssot-integration)

---

## Archivos a Modificar/Crear

### Nuevos Archivos
- `src/routes/ssot.js` - Rutas públicas de SSOT
- `src/services/ssotService.js` - Servicio de SSOT
- `tests/unit/routes/ssot.test.js` - Tests de endpoints

### Archivos a Modificar
- `src/index.js` - Registrar rutas SSOT
- `API_CONTRACTS.md` - Documentar nuevos endpoints
- `docs/nodes-v2/15-ssot-integration.md` (si existe) - Actualizar con endpoints públicos

---

## Validación Requerida

1. ✅ Todos los endpoints son públicos (sin `authenticateToken`)
2. ✅ Datos expuestos coinciden exactamente con SSOT-V2.md
3. ✅ Tests pasando al 100%
4. ✅ Documentación actualizada
5. ✅ No se expone información sensible

---

## Agentes Relevantes

- **Back-end Dev**: Implementación de endpoints y servicio
- **Test Engineer**: Tests unitarios y de integración

---

## Notas

- Los endpoints deben ser **públicos** (sin autenticación) para que el frontend v2 pueda acceder a ellos sin sesión.
- Todos los datos deben venir del SSOT-V2.md, no inventar valores.
- Si algo no está en SSOT, marcar como TBD y documentar.

