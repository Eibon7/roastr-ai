# Plan: Corregir mocks de costControl en los workers (Issue #905 y #906)

**Issue:** #905 / #906  
**Título:** Fix costControl mock pattern en `FetchCommentsWorker.test.js` y `AnalyzeToxicityWorker.test.js`  
**Priority:** P1 (Media)  
**Estimación:** 1-2 horas  
**AC Count:** 5 (test suites + patrón + validación del helper)

---

## Estado Actual

Los dos suites unitarios de `FetchCommentsWorker` y `AnalyzeToxicityWorker` fallan con:

```
TypeError: Cannot read properties of undefined (reading 'allowed')
```

La raíz está en el mock de `CostControlService`:

```javascript
jest.mock('../../../src/services/costControl', () => {
  return jest.fn().mockImplementation(() => mockCostControlService);
});

const mockCostControlService = {
  canPerformOperation: jest.fn(),
  ...
};
```

`canPerformOperation` no devuelve un objeto `{ allowed, reason }`, por lo que los workers caen antes de llegar al flujo real. Además, la inicialización duplicada no permite reutilizar la configuración entre suites ni resetear permisos específicos por caso.

## Acceptance Criteria

1. `tests/unit/workers/FetchCommentsWorker.test.js` pasa con las 15 pruebas corregidas (Issue #905 AC1).
2. `tests/unit/workers/AnalyzeToxicityWorker.test.js` pasa con las 18 pruebas corregidas (Issue #905 AC2).
3. El patrón de mock de `costControl` usa un helper configurable que garantiza que `canPerformOperation()` siempre devuelve `{ allowed, reason }` (Issue #905 AC3 + Issue #906 AC2).
4. El helper permite configurar `allowed`/`disallowed` y se resetea entre tests (Issue #906 AC3).
5. `npm test -- tests/unit/workers/FetchCommentsWorker.test.js tests/unit/workers/AnalyzeToxicityWorker.test.js` pasa sin errores (Issue #906 AC1 + Issue #905 AC4).

## Pasos de Implementación

1. **Crear el helper** `tests/helpers/costControlMockFactory.js` que:
   - Se importa antes de `jest.mock`.
   - Devuelve una instancia con `canPerformOperation`, `recordUsage` e `initialize` como `jest.fn()`.
   - Guarda el resultado actual de permiso y expone `_setPermissionResult`, `_setAllowed` y `_reset`.
2. **Actualizar `FetchCommentsWorker.test.js` y `AnalyzeToxicityWorker.test.js`** para:
   - Requerir el helper (`../../helpers/costControlMockFactory`).
   - Instanciar el mock antes de `jest.mock('../../../src/services/costControl', ...)`.
   - Resetear el estado del mock en `afterEach`.
   - Configurar `mockCostControlService._setAllowed(true)` (o equivalente) si algún escenario requiere controlar el permiso.
3. **Validar que ambos suites unitarios coinciden con el comando de acceptance** y revisar los logs para detectar si el helper necesita más campos (`resourceType`, `reason`, etc.).

## Validación

```bash
npm test -- tests/unit/workers/FetchCommentsWorker.test.js tests/unit/workers/AnalyzeToxicityWorker.test.js
```

## Archivos Afectados

- `tests/helpers/costControlMockFactory.js` (nuevo helper flexible)
- `tests/unit/workers/FetchCommentsWorker.test.js` (usa el helper + reset)
- `tests/unit/workers/AnalyzeToxicityWorker.test.js` (idem)
- `docs/agents/receipts/` (recibo de TestEngineer)

## Agentes Relevantes

- **TestEngineer** – Fix directo a suites de test + creación de helper reusable


