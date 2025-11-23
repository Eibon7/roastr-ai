# Plan de Implementación - Issue #712: Verificación de Integraciones de Plataformas Sociales

**Issue:** #712  
**Título:** Social Platform Integration Verification - Verify 9 platform integrations  
**Prioridad:** P1  
**Estado:** En Planificación  
**Fecha:** 2025-11-11

## Estado Actual

### Contexto

- 9 plataformas integradas: Twitter/X, YouTube, Instagram, Facebook, Discord, Twitch, Reddit, TikTok, Bluesky
- Código existe en `src/integrations/`
- Documentación existe en `docs/INTEGRATIONS.md` y `docs/nodes/social-platforms.md`
- Script `scripts/update-integration-status.js` existe pero solo verifica adaptadores y credenciales
- No hay verificación sistemática end-to-end con llamadas API reales

### Gap Identificado

- No hay verificación de que cada plataforma funcione end-to-end
- No hay tests de rate limiting
- No hay verificación de error handling
- No hay documentación de quirks/edge cases por plataforma

## Objetivos

Verificar sistemáticamente que las 9 integraciones funcionen correctamente con:

1. Autenticación OAuth/API keys
2. Operaciones core (fetchComments, postReply, blockUser)
3. Rate limiting y backoff
4. Manejo de errores
5. Documentación actualizada

## Pasos de Implementación

### FASE 1: Script de Verificación Unificado

**Archivo:** `scripts/verify-all-platforms.js`

**Funcionalidades:**

1. Para cada plataforma (9 total):
   - Verificar autenticación
   - Verificar fetchComments() (con límite de 1-2 comentarios)
   - Verificar postReply() (dry-run o test mode)
   - Verificar blockUser() si está soportado
   - Verificar rate limiting (simular rate limit exceeded)
   - Verificar error handling (credenciales inválidas, network failures)

2. Generar reporte:
   - Estado por plataforma (✅ operacional, ⚠️ parcial, ❌ fallido)
   - Métricas: tiempo de respuesta, tasa de éxito
   - Errores encontrados
   - Rate limits respetados
   - Quirks documentados

**Dependencias:**

- Usar servicios existentes en `src/integrations/`
- Integrar con `scripts/update-integration-status.js`
- Usar `utils/logger.js` para logging

### FASE 2: Tests de Integración

**Archivos:**

- `tests/integration/platforms/twitter-verification.test.js`
- `tests/integration/platforms/youtube-verification.test.js`
- `tests/integration/platforms/discord-verification.test.js`
- `tests/integration/platforms/twitch-verification.test.js`
- `tests/integration/platforms/instagram-verification.test.js`
- `tests/integration/platforms/facebook-verification.test.js`
- `tests/integration/platforms/reddit-verification.test.js`
- `tests/integration/platforms/tiktok-verification.test.js`
- `tests/integration/platforms/bluesky-verification.test.js`

**Cobertura por test:**

- ✅ Autenticación exitosa
- ✅ fetchComments() retorna datos válidos
- ✅ postReply() publica correctamente (o falla gracefulmente)
- ✅ blockUser() funciona si está soportado
- ✅ Rate limiting respetado
- ✅ Error handling para casos comunes
- ✅ Coverage ≥80% del servicio de plataforma

### FASE 3: Actualización de Documentación

**Archivos a actualizar:**

1. `docs/INTEGRATIONS.md`
   - Añadir sección "Verification Status" por plataforma
   - Añadir fecha de última verificación
   - Añadir métricas de salud

2. `docs/nodes/platform-constraints.md` (crear si no existe)
   - Documentar límites de rate por plataforma
   - Documentar quirks conocidos
   - Documentar limitaciones de API

3. `docs/patterns/api-quirks.md` (crear si no existe)
   - Documentar edge cases por plataforma
   - Documentar workarounds necesarios
   - Documentar cambios de API/deprecaciones

4. `docs/nodes/social-platforms.md`
   - Actualizar status de verificación
   - Añadir métricas de salud

### FASE 4: Integración con CI/CD

**Archivo:** `.github/workflows/verify-platforms.yml`

**Funcionalidad:**

- Ejecutar `scripts/verify-all-platforms.js` en CI
- Fallar si alguna plataforma crítica falla
- Generar reporte de verificación
- Actualizar `integration-status.json`

## Agentes a Usar

- **TestEngineer**: Generar tests de integración
- **Backend Developer**: Implementar script de verificación
- **Documentation Agent**: Actualizar documentación
- **Guardian**: Validar seguridad (no exponer credenciales en logs)

## Archivos Afectados

### Nuevos

- `scripts/verify-all-platforms.js`
- `tests/integration/platforms/*.test.js` (9 archivos)
- `docs/nodes/platform-constraints.md`
- `docs/patterns/api-quirks.md`
- `.github/workflows/verify-platforms.yml`

### Modificados

- `scripts/update-integration-status.js` (extender con resultados de verificación)
- `docs/INTEGRATIONS.md`
- `docs/nodes/social-platforms.md`

## Validación Requerida

### Tests

- ✅ Todos los tests de integración pasando (9 plataformas × 6 tests = 54 tests mínimo)
- ✅ Coverage ≥80% para cada servicio de plataforma
- ✅ Tests cubren success + error paths

### GDD

- ✅ Actualizar `docs/nodes/social-platforms.md` con status de verificación
- ✅ Ejecutar `node scripts/validate-gdd-runtime.js --full` (debe pasar)
- ✅ Ejecutar `node scripts/score-gdd-health.js --ci` (debe ≥87)

### Documentación

- ✅ `docs/INTEGRATIONS.md` actualizado con status
- ✅ `docs/nodes/platform-constraints.md` creado y documentado
- ✅ `docs/patterns/api-quirks.md` creado con quirks conocidos

### Scripts

- ✅ `scripts/verify-all-platforms.js` ejecuta sin errores
- ✅ `scripts/update-integration-status.js` incluye resultados de verificación
- ✅ Reporte generado correctamente

## Estimación

**Esfuerzo:** 2-3 semanas (1-2 días por plataforma × 9)
**Complejidad:** MEDIUM (repetitivo pero requiere conocimiento específico de cada plataforma)

## Riesgos y Mitigaciones

### Riesgo 1: Credenciales de API en tests

**Mitigación:** Usar variables de entorno, nunca hardcodear. Usar modo dry-run cuando sea posible.

### Riesgo 2: Rate limiting en CI

**Mitigación:** Limitar número de llamadas por plataforma. Usar mocks cuando sea posible.

### Riesgo 3: APIs cambiantes

**Mitigación:** Documentar versiones de API usadas. Añadir tests de compatibilidad.

## Criterios de Aceptación

### Para CADA plataforma (9 total):

1. ✅ **API Authentication Verification**
   - OAuth/API key flow funciona
   - Token refresh (si aplica) funciona correctamente
   - Error handling para auth failures

2. ✅ **Core Operations Testing**
   - `fetchComments()` retorna comentarios exitosamente
   - `postReply()` publica respuestas correctamente
   - `blockUser()` funciona si está soportado
   - `authenticate()` completa sin errores

3. ✅ **Rate Limiting Verification**
   - Rate limits específicos de plataforma respetados
   - Backoff/retry logic funciona correctamente
   - Rate limit exceeded handling graceful

4. ✅ **Error Scenarios**
   - Network failures manejados
   - Invalid credentials detectados
   - API changes/deprecations surfaced
   - Edge cases documentados en `docs/patterns/api-quirks.md`

5. ✅ **Documentation**
   - Integration status actualizado en `docs/INTEGRATIONS.md`
   - Platform constraints documentados en `docs/nodes/platform-constraints.md`
   - Quirks añadidos a `docs/patterns/api-quirks.md`

6. ✅ **Integration Tests**
   - Test de integración añadido (ver `tests/integration/platforms/`)
   - Test coverage ≥80% para servicio de plataforma
   - Tests cubren success + error paths

### Overall:

7. ✅ **Verification Script**
   - `scripts/update-integration-status.js` actualizado con resultados de verificación
   - `scripts/verify-all-platforms.js` creado para verificaciones automatizadas

8. ✅ **GDD Updates**
   - `docs/nodes/social-platforms.md` actualizado con status de verificación
   - `node scripts/validate-gdd-runtime.js --full` pasa
   - `node scripts/score-gdd-health.js --ci` ≥87

---

**Próximos pasos:** Comenzar con FASE 1 - Script de verificación unificado
