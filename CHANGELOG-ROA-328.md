# Changelog: ROA-328 - CI GitHub Actions Consolidation (Vitest First)

**Issue:** ROA-328  
**Fecha:** 2025-12-05  
**Tipo:** Consolidación CI/CD, Migración Testing

---

## Resumen

Consolidación de workflows de GitHub Actions y migración completa a Vitest como framework de testing principal, eliminando la dependencia de Jest en el backend legacy.

---

## Cambios Realizados

### 1. Actualización de Vitest en Backend v2

- **Archivo:** `apps/backend-v2/package.json`
  - Vitest: `^1.1.0` → `^4.0.14` (alineado con frontend)
  - Añadido `@vitest/coverage-v8@^4.0.14`

- **Archivo:** `apps/backend-v2/vitest.config.ts`
  - Actualizado para Vitest v4
  - Añadidos thresholds de coverage
  - Añadido soporte para `.test.js` además de `.test.ts`

### 2. Migración Backend Legacy a Vitest

- **Nuevo archivo:** `vitest.config.ts` (raíz)
  - Configuración Vitest para backend legacy (`src/`)
  - Migrado desde `jest.config.js`
  - Mantiene thresholds de coverage existentes
  - Configuración de workers optimizada para CI

- **Archivo:** `package.json`
  - Scripts actualizados:
    - `test` → Vitest (`vitest run`)
    - `test:watch` → Vitest watch mode
    - `test:ci` → Vitest con reporter JUnit
    - `test:coverage` → Vitest coverage
    - `test:unit` → Vitest unit tests
  - Scripts Jest mantenidos temporalmente:
    - `test:jest` → Jest (deprecated)
    - `test:jest:ci` → Jest CI (deprecated)
  - Dependencias añadidas:
    - `vitest@^4.0.14`
    - `@vitest/coverage-v8@^4.0.14`
    - `@vitest/ui@^4.0.14`

### 3. Consolidación de Workflows CI

#### `.github/workflows/ci.yml` (Principal)

- **Backend tests:**
  - Migrado de Jest a Vitest
  - Añadido job para backend v2 tests (Vitest)
  - Mejorado logging y mensajes

- **Frontend tests:**
  - Actualizado para usar Vitest explícitamente
  - Mejorado manejo de errores

- **Coverage:**
  - Añadidos jobs para upload de coverage (backend + frontend)
  - Artifacts renombrados para claridad (`-vitest` suffix)

#### `.github/workflows/tests.yml` (Deprecated)

- Añadido comentario de deprecación
- Actualizado para usar Vitest donde sea posible
- Tests habilitados con `continue-on-error: true` para transición gradual
- Coverage validation actualizado para Vitest

#### `.github/workflows/integration-tests.yml` (Deprecated)

- Añadido comentario de deprecación
- Actualizado para usar Vitest
- Tests habilitados con `continue-on-error: true` para transición gradual

### 4. Documentación Actualizada

- **`docs/nodes-v2/13-testing.md`:**
  - Actualizado estado de migración
  - Añadida información sobre configuración Vitest en raíz
  - Documentado estado de deprecación de Jest

- **`docs/nodes-v2/14-infraestructura.md`:**
  - Actualizado estado de consolidación de workflows
  - Documentado workflows deprecated
  - Añadida información sobre Vitest First approach

### 5. Plan de Implementación

- **Nuevo archivo:** `docs/plan/issue-ROA-328.md`
  - Plan detallado de consolidación
  - Fases de implementación
  - Archivos afectados
  - Validación requerida

---

## Archivos Modificados

### Nuevos Archivos

- `vitest.config.ts` (raíz) - Configuración Vitest para backend legacy
- `docs/plan/issue-ROA-328.md` - Plan de implementación
- `CHANGELOG-ROA-328.md` - Este changelog

### Archivos Modificados

- `.github/workflows/ci.yml` - Consolidación y migración a Vitest
- `.github/workflows/tests.yml` - Actualizado a Vitest, marcado como deprecated
- `.github/workflows/integration-tests.yml` - Actualizado a Vitest, marcado como deprecated
- `package.json` - Scripts y dependencias Vitest
- `apps/backend-v2/package.json` - Vitest v4.0.14
- `apps/backend-v2/vitest.config.ts` - Configuración Vitest v4
- `docs/nodes-v2/13-testing.md` - Estado de migración
- `docs/nodes-v2/14-infraestructura.md` - Estado de consolidación

---

## Próximos Pasos

1. **Instalar dependencias:**
   ```bash
   npm install
   cd apps/backend-v2 && npm install
   ```

2. **Ejecutar tests localmente:**
   ```bash
   npm test  # Backend legacy (Vitest)
   cd apps/backend-v2 && npm test  # Backend v2 (Vitest)
   cd frontend && npm test  # Frontend (Vitest)
   ```

3. **Validar workflows CI:**
   - Verificar que workflows ejecutan correctamente
   - Verificar que coverage reports se generan
   - Verificar que artifacts se suben correctamente

4. **Migración gradual:**
   - Migrar tests individuales de Jest a Vitest según sea necesario
   - Actualizar imports en tests existentes
   - Eliminar dependencias Jest cuando todo esté migrado

5. **Cleanup (futuro):**
   - Eliminar workflows deprecated (`tests.yml`, `integration-tests.yml`)
   - Eliminar configuraciones Jest obsoletas
   - Eliminar dependencias Jest del `package.json`

---

## Notas Técnicas

- **Vitest v4.0.14:** Versión moderna, alineada entre frontend y backend
- **Coverage:** Usa `@vitest/coverage-v8` para generar reports
- **Compatibilidad:** Scripts Jest mantenidos temporalmente para transición suave
- **CI:** Workflows consolidados en `ci.yml` principal, otros marcados como deprecated

---

## Validación

- ✅ Configuraciones Vitest creadas/actualizadas
- ✅ Scripts package.json actualizados
- ✅ Workflows CI actualizados
- ✅ Documentación GDD actualizada
- ⚠️ Tests locales pendientes de ejecución
- ⚠️ Validación CI pendiente de ejecución

---

**Estado:** ✅ Implementación Completa  
**Próximo:** Validación local y CI

