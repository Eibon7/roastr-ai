/**
 * Cost Control Mock Factory
 *
 * Proporciona mocks reutilizables para el servicio de limitación de costes (costControl).
 * El patrón crítico es instanciar el mock ANTES de llamar a `jest.mock(...)` para evitar el
 * congelamiento del módulo que ocurre durante la resolución.
 *
 * El mock expone helpers para:
 *  - configurar respuestas permitidas/denegadas
 *  - resetear entre pruebas
 *  - verificar que `canPerformOperation()` siempre retorna un objeto con `allowed`
 *
 * Ejemplo de uso:
 *
 * ```javascript
 * const { createCostControlMock } = require('../helpers/costControlMockFactory');
 * const mockCostControlService = createCostControlMock();
 *
 * jest.mock('../../src/services/costControl', () => {
 *   return jest.fn().mockImplementation(() => mockCostControlService);
 * });
 * ```
 */

function createCostControlMock(overrides = {}) {
  const defaultPermissionResult = {
    allowed: true,
    reason: 'Permiso predeterminado para tests',
    resourceType: 'fetch_comment',
    quantity: 1,
    organizationId: 'org-test',
    ...overrides
  };

  let currentPermissionResult = { ...defaultPermissionResult };

  const canPerformOperation = jest.fn(() => Promise.resolve(currentPermissionResult));
  const recordUsage = jest.fn(() => Promise.resolve({ recorded: true }));
  const initialize = jest.fn();

  function setPermissionResult(patch = {}) {
    currentPermissionResult = {
      ...defaultPermissionResult,
      ...patch
    };
    return currentPermissionResult;
  }

  function setAllowed(allowed, reason = null) {
    return setPermissionResult({
      allowed,
      reason: reason ?? (allowed ? 'Permiso explícitamente permitido' : 'Permiso denegado en test')
    });
  }

  function reset() {
    currentPermissionResult = { ...defaultPermissionResult };
    canPerformOperation.mockClear();
    recordUsage.mockClear();
  }

  return {
    canPerformOperation,
    recordUsage,
    initialize,
    _setPermissionResult: setPermissionResult,
    _setAllowed: setAllowed,
    _reset: reset
  };
}

module.exports = {
  createCostControlMock
};
