# Plan: Issue #277 - Implementación completa de herramientas CLI y funcionalidades avanzadas

**Issue:** #277  
**Estado:** En progreso  
**Fecha:** 2025-01-27  
**Rama:** feat/issues-276-281-277-287

## Contexto

La PR #273 cubre parcialmente los requisitos de la issue #82. Se ha avanzado en la estructura de configuración de tests y comandos CLI, pero la funcionalidad principal del CLI test runner aún no está completamente implementada. Además, la documentación no refleja lo prometido en la descripción de la PR.

## Estado Actual

### ✅ Implementado correctamente

- ✅ Umbrales de cobertura en jest.config.js (con comentarios y diferenciación por área crítica)
- ✅ Scripts añadidos a package.json (7 comandos bien estructurados, compatibles con CI)
- ✅ Utilidades de mocks multi-tenant y servicios (con retorno realista, buena arquitectura base)
- ✅ Estructura básica del CLI runner (`scripts/test/runner.js`)
- ✅ Comandos básicos: `scopes`, `platforms`, `validate`, `check`

### ✅ Completado

#### 1. CLI Runner (`scripts/test/runner.js`) - ✅ COMPLETADO

**Mejoras implementadas:**

- ✅ Implementada validación y logging mejorado de `--mock-mode` (verifica que ENABLE_MOCK_MODE se propaga)
- ✅ Implementado filtrado por plataforma que filtra tanto archivos como nombres de tests
- ✅ Mejorado manejo de errores con mensajes descriptivos
- ✅ Añadida función `filterTestsByPlatform()` para filtrado inteligente de archivos

**AC completados:**

- [x] Implementar ejecución real de tests con validación de `--mock-mode`
- [x] Implementar compatibilidad completa con `--mock-mode` (verificar que ENABLE_MOCK_MODE se propaga correctamente)
- [x] Soporte para filtrado por plataforma (--platform) que filtre archivos de test, no solo nombres
- [x] Mejorar soporte para ejecución por scope real (ahora funciona pero puede mejorarse)

#### 2. Utilidades de mocks (`tests/utils/multiTenantMocks.js`) - ✅ COMPLETADO

**Mejoras implementadas:**

- ✅ Ampliada `createMultiTenantTestScenario` para soportar parametrización completa
- ✅ Añadida función `createCustomScenario()` para escenarios personalizados
- ✅ Añadida función `validateScenarioConfig()` con validación completa
- ✅ Soporte para parametrización de plan, roles, plataformas, userCount, orgCount

**AC completados:**

- [x] Ampliar `createMultiTenantTestScenario` para soportar parametrización de plan, rol y plataformas
- [x] Añadir validaciones a las utilidades de mocks
- [x] Añadir manejo de errores descriptivos

#### 3. Documentación (`scripts/README.md`) - ✅ COMPLETADO

**Mejoras implementadas:**

- ✅ Añadidos ejemplos de uso reales para todos los comandos CLI
- ✅ Explicación detallada de `--mock-mode` (qué hace, cuándo usarlo, qué mockea)
- ✅ Explicación detallada de `--platform` (cómo filtra, plataformas disponibles)
- ✅ Explicación detallada de scopes (qué son, cómo usarlos)
- ✅ Añadida sección de casos de uso (desarrollo, CI/CD, debugging, coverage)
- ✅ Añadida sección de troubleshooting mejorada
- ✅ Documentación completa de utilidades de mocks con ejemplos de parametrización

**AC completados:**

- [x] Incluir ejemplos de uso reales de los comandos CLI
- [x] Explicar funcionamiento de `--mock-mode`, `--platform`, `--scope`
- [x] Describir todos los comandos y opciones con claridad
- [x] Incluir casos de uso y advertencias

#### 4. Mejoras recomendadas

- [ ] Unificar patrones de configuración en jest.config.js para mayor claridad
- [ ] Verificar coherencia entre archivos específicos (billing.js) y globs (workers/\*\*)
- [ ] Homogeneizar comentarios (en algunos ficheros hay referencia a la issue y en otros no)

## Pasos de Implementación

### FASE 1: Mejorar CLI Runner

1. **Mejorar `--mock-mode`:**
   - Verificar que `ENABLE_MOCK_MODE` se propaga correctamente a Jest
   - Añadir validación de que mock mode está activo
   - Añadir logging cuando mock mode está activo

2. **Mejorar `--platform`:**
   - Implementar filtrado por archivos de test que contengan el nombre de la plataforma
   - Mejorar la lógica de `--testNamePattern` para que funcione correctamente
   - Añadir validación de que la plataforma existe

3. **Mejorar ejecución por scope:**
   - Validar que los patrones de scope resuelven correctamente
   - Añadir mejor manejo de errores
   - Mejorar mensajes de feedback

### FASE 2: Ampliar Utilidades de Mocks

1. **Parametrizar `createMultiTenantTestScenario`:**

   ```javascript
   createMultiTenantTestScenario('custom', {
     plan: 'pro',
     roles: ['admin', 'member'],
     platforms: ['twitter', 'instagram'],
     userCount: 5
   });
   ```

2. **Añadir validaciones:**
   - Validar que los parámetros son válidos
   - Validar que los planes existen
   - Validar que los roles son válidos
   - Validar que las plataformas son válidas

3. **Añadir manejo de errores:**
   - Errores descriptivos cuando los parámetros son inválidos
   - Errores cuando los escenarios no existen

### FASE 3: Mejorar Documentación

1. **Añadir ejemplos de uso reales:**

   ```bash
   # Ejemplo 1: Ejecutar tests de auth con mock mode
   node scripts/test/runner.js run auth --mock-mode

   # Ejemplo 2: Ejecutar tests de servicios filtrados por Twitter
   node scripts/test/runner.js run services --platform twitter

   # Ejemplo 3: Ejecutar todos los tests con coverage
   node scripts/test/runner.js all --coverage
   ```

2. **Explicar opciones:**
   - `--mock-mode`: Qué hace, cuándo usarlo, qué servicios mockea
   - `--platform`: Cómo filtra, qué plataformas están disponibles
   - `--scope`: Qué scopes existen, cómo se organizan los tests

3. **Añadir casos de uso:**
   - Desarrollo local
   - CI/CD
   - Debugging
   - Coverage analysis

4. **Añadir advertencias:**
   - Cuándo NO usar mock mode
   - Limitaciones del filtrado por plataforma
   - Requisitos de variables de entorno

### FASE 4: Mejoras de Calidad

1. **Unificar patrones en jest.config.js:**
   - Revisar todos los umbrales
   - Asegurar coherencia entre archivos específicos y globs
   - Añadir comentarios explicativos

2. **Homogeneizar comentarios:**
   - Añadir referencias a issue #277 donde falten
   - Unificar formato de comentarios

## Archivos Afectados

### Archivos a modificar:

- `scripts/test/runner.js` - Mejorar implementación de comandos
- `tests/utils/multiTenantMocks.js` - Ampliar escenarios y parametrización
- `scripts/README.md` - Mejorar documentación
- `jest.config.js` - Unificar patrones (opcional)

### Archivos a crear:

- Ninguno

## Validación

### Tests a ejecutar:

```bash
# Validar que el runner funciona correctamente
node scripts/test/runner.js validate

# Ejecutar tests con mock mode
node scripts/test/runner.js run unit --mock-mode

# Ejecutar tests filtrados por plataforma
node scripts/test/runner.js run services --platform twitter

# Ejecutar todos los tests
node scripts/test/runner.js all --coverage
```

### Criterios de éxito:

- ✅ Todos los comandos CLI funcionan correctamente
- ✅ `--mock-mode` se propaga correctamente a Jest
- ✅ `--platform` filtra correctamente los tests
- ✅ `createMultiTenantTestScenario` soporta parametrización
- ✅ Documentación completa con ejemplos reales
- ✅ Tests pasando al 100%

## Agentes Relevantes

- **TestEngineer** - Validación de tests y mocks
- **Backend Developer** - Implementación del CLI runner
- **Documentation Agent** - Mejora de documentación

## Estado de Implementación

### ✅ FASE 1: CLI Runner - COMPLETADO

- Mejoras en `--mock-mode` con validación y logging
- Filtrado por plataforma mejorado (archivos + nombres)
- Manejo de errores mejorado

### ✅ FASE 2: Utilidades de Mocks - COMPLETADO

- Parametrización completa de escenarios
- Validación de configuración
- Manejo de errores descriptivo

### ✅ FASE 3: Documentación - COMPLETADO

- Ejemplos reales de uso
- Explicaciones detalladas de opciones
- Casos de uso y troubleshooting

### ⏳ FASE 4: Mejoras de Calidad - PENDIENTE (Opcional)

- Unificar patrones en jest.config.js (mejora menor)
- Homogeneizar comentarios (mejora menor)

## Validación Realizada

✅ Runner funciona correctamente:

- `node scripts/test/runner.js validate` - ✅ PASS
- `node scripts/test/runner.js scopes` - ✅ PASS
- Custom scenario creation - ✅ PASS

## Notas

- Este trabajo debe incluirse en la PR #273
- Una vez completado, actualizar la descripción de la PR para reflejar fielmente lo implementado
- Cerrar adecuadamente la issue original (#82)
- Las mejoras de calidad (FASE 4) son opcionales y pueden hacerse en un PR separado
