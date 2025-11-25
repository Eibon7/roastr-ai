# Plan: Issue #1018 - Memory & Resource Issues (CRITICAL)

**Issue:** #1018  
**Prioridad:** 🔴 P0 - Production Blocking  
**Tipo:** Bug, Performance  
**Labels:** `bug`, `priority:P0`, `area:workers`, `area:performance`  
**Estimación:** 1-2 días

---

## 📋 Resumen

Tests están fallando debido a problemas de memoria y recursos. Workers crashean durante ejecución de tests, lo que indica posibles memory leaks o tests mal diseñados que consumen demasiada memoria.

**Impacto producción:** 🔴 **CRÍTICO** - Sistema puede ser inestable, workers pueden crashear en producción

---

## 🎯 Tests Afectados (~15 tests)

### Tests Críticos Fallando

1. **`tests/unit/services/shieldService-edge-cases.test.js`**
   - Error: `Jest worker ran out of memory and crashed`
   - Impacto: Shield service no puede probarse completamente

2. **`tests/unit/workers/AnalyzeToxicityWorker-*.test.js`** (múltiples archivos)
   - Error: `Jest worker encountered 4 child process exceptions`
   - Impacto: Worker de análisis de toxicidad no puede probarse

3. **`tests/unit/middleware/notificationRateLimiter.test.js`**
   - Error: `Jest worker encountered 4 child process exceptions`
   - Impacto: Rate limiting no puede probarse

4. **`tests/unit/routes/shield-round5.test.js`**
   - Error: `Jest worker encountered 4 child process exceptions`
   - Impacto: Shield routes no pueden probarse

---

## 🔍 Causa Raíz Identificada

1. **Tests consumen demasiada memoria:**
   - Tests pueden estar creando demasiados mocks o datos
   - Posibles memory leaks en código de producción
   - Workers pueden estar acumulando estado entre tests

2. **Jest workers sobrecargados:**
   - Demasiados tests pesados ejecutándose en paralelo
   - Configuración de Jest puede necesitar ajustes
   - Worktrees causando mocks duplicados (conflictos)

3. **Código de producción con memory leaks:**
   - Event listeners no removidos
   - Timers/intervals no limpiados
   - Conexiones no cerradas

---

## ✅ Acceptance Criteria

- [ ] Todos los tests de workers pasan sin crashes de memoria
- [ ] Shield service tests completan sin memory errors
- [ ] No hay memory leaks detectados en workers
- [ ] Jest workers ejecutan sin excepciones
- [ ] Performance de tests mejorada (tiempo de ejecución)
- [ ] Código de producción optimizado para memoria

---

## 🔧 Solución Propuesta

### 1. Optimizar Configuración Jest (Inmediato)

**Archivo:** `jest.config.js`

```javascript
module.exports = {
  // ... existing config ...

  // Memory optimization
  maxWorkers: '50%', // Reducir workers paralelos
  workerIdleMemoryLimit: '512MB', // Límite de memoria por worker

  // Test isolation
  resetMocks: true,
  restoreMocks: true,
  clearMocks: true,

  // Coverage optimization
  collectCoverage: false // Deshabilitar en desarrollo para reducir memoria
};
```

### 2. Añadir Cleanup en Tests (Crítico)

**Patrón a aplicar en todos los tests afectados:**

```javascript
// tests/unit/services/shieldService-edge-cases.test.js
afterEach(() => {
  // Limpiar mocks
  jest.clearAllMocks();

  // Limpiar timers
  jest.clearAllTimers();

  // Limpiar módulos si es necesario
  jest.resetModules();
});

afterAll(async () => {
  // Limpiar conexiones si aplica
  // await connection.close();

  // Forzar garbage collection si disponible
  if (global.gc) {
    global.gc();
  }
});
```

### 3. Arreglar Memory Leaks en Código de Producción

**Archivos a revisar:**

- `src/workers/BaseWorker.js` - Limpiar intervals y timers
- `src/workers/AnalyzeToxicityWorker.js` - Limpiar conexiones y listeners
- `src/services/shieldService.js` - Limpiar event listeners
- `src/middleware/notificationRateLimiter.js` - Limpiar stores de rate limiting

**Patrón de cleanup:**

```javascript
class Worker {
  constructor() {
    this.timers = [];
    this.listeners = [];
  }

  start() {
    const timer = setInterval(() => {}, 1000);
    this.timers.push(timer);

    process.on('event', this.handler);
    this.listeners.push({ event: 'event', handler: this.handler });
  }

  stop() {
    // Limpiar timers
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers = [];

    // Limpiar listeners
    this.listeners.forEach(({ event, handler }) => {
      process.removeListener(event, handler);
    });
    this.listeners = [];
  }
}
```

### 4. Optimizar Workers

- Implementar límites de memoria en workers
- Añadir monitoring de memoria
- Implementar circuit breakers para memory pressure

---

## 📊 Validación

### Tests a Ejecutar

```bash
# Tests específicos que deben pasar
npm test -- tests/unit/services/shieldService-edge-cases.test.js --maxWorkers=1
npm test -- tests/unit/workers/AnalyzeToxicityWorker.test.js --maxWorkers=1
npm test -- tests/unit/middleware/notificationRateLimiter.test.js --maxWorkers=1
npm test -- tests/unit/routes/shield-round5.test.js --maxWorkers=1
```

### Métricas de Éxito

- ✅ 0 crashes de memoria
- ✅ Todos los tests pasan
- ✅ Tiempo de ejecución < 2x tiempo actual
- ✅ Memory usage estable durante tests

---

## 🚨 Riesgos de Producción

**Si no se arregla:**

- Workers pueden crashear en producción bajo carga
- Sistema puede volverse inestable
- Posibles memory leaks que degraden performance con el tiempo

**Impacto negocio:**

- 🔴 Alto - Sistema puede fallar en producción
- 🔴 Alto - Pérdida de confianza de usuarios
- 🔴 Alto - Posibles problemas de escalabilidad

---

## 📝 Notas Adicionales

- Estos tests son críticos porque prueban funcionalidad core del sistema
- Los arreglos deben ser production-ready, no solo hacks para tests
- Considerar añadir monitoring de memoria en producción después del fix

### ⚠️ Problema Crítico: Worktrees y Jest

**Problema:** Jest escanea todos los worktrees durante la construcción del haste map (ANTES de aplicar filtros), causando:

- Mocks duplicados detectados
- Uso excesivo de memoria (4GB+)
- Crashes de heap
- Colisiones de nombres de módulos (package.json duplicados)

**Estado Actual:**

- Worktrees activos: issue-442, issue-1018, issue-1019
- Worktrees inactivos detectados: 914, 920, 929, 930, 931, 932, 933, 940, 972, 973
- Jest configuración actualizada pero el problema persiste porque Jest construye haste map antes de aplicar filtros

**Soluciones Implementadas:**

1. ✅ Configuración Jest optimizada (`maxWorkers: '50%'`, `workerIdleMemoryLimit: '512MB'`)
2. ✅ Cleanup en tests (`afterEach`/`afterAll` con `jest.clearAllMocks()`, `jest.clearAllTimers()`)
3. ✅ Memory leaks arreglados en `BaseWorker.js`
4. ✅ Límite de memoria Node.js aumentado a 4GB
5. ✅ `modulePathIgnorePatterns` y `watchPathIgnorePatterns` configurados

**Solución Temporal (Recomendada AHORA):**

```bash
# Limpiar worktrees antiguos (mantener solo 442, 1018, 1019)
git worktree prune
# O eliminar manualmente los worktrees antiguos
git worktree remove ../roastr-ai-worktrees/issue-914
# ... etc para cada worktree antiguo
```

**Solución Permanente (Recomendada FUTURO):**

- Mover worktrees fuera del directorio raíz del proyecto (ej: `../worktrees/`)
- O usar un directorio `.worktrees/` fuera del proyecto y actualizar `.gitignore`
- Considerar usar `hasteImpl` personalizado en Jest para excluir worktrees del escaneo inicial

---

## 🔗 Referencias

- Jest Memory Issues: https://jestjs.io/docs/troubleshooting#memory-issues
- Node.js Memory Management: https://nodejs.org/en/docs/guides/simple-profiling/
- CodeRabbit Lessons: `docs/patterns/coderabbit-lessons.md`

---

## 📋 Checklist de Implementación

- [ ] Actualizar `jest.config.js` con optimizaciones de memoria
- [ ] Añadir cleanup en `shieldService-edge-cases.test.js`
- [ ] Añadir cleanup en todos los tests de `AnalyzeToxicityWorker`
- [ ] Añadir cleanup en `notificationRateLimiter.test.js`
- [ ] Añadir cleanup en `shield-round5.test.js`
- [ ] Revisar y arreglar memory leaks en `BaseWorker.js`
- [ ] Revisar y arreglar memory leaks en `AnalyzeToxicityWorker.js`
- [ ] Revisar y arreglar memory leaks en `shieldService.js`
- [ ] Ejecutar tests y validar que pasan sin crashes
- [ ] Validar GDD y generar receipts

---

**Creado:** 2025-01-XX  
**Estado:** En progreso  
**Agentes:** TestEngineer, Backend Developer
