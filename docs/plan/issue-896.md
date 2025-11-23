# Plan de Implementación: Issue #896

## Fase 5: Documentar E2E Requirements - ~10-15 suites

**Fecha:** 2025-11-21
**Prioridad:** P2 (BAJA)
**Esfuerzo estimado:** 1 hora
**Labels:** `priority:P2`, `test:e2e`, `epic:test-stabilization`

---

## Estado Actual

### Problema Identificado

- Tests E2E fallan porque requieren servidor corriendo o configuración específica no documentada
- Suite principal afectada: `tests/integration/shield-stability.test.js` (18 failures)
- Estimado ~10-15 suites adicionales con requisitos similares
- No hay documentación clara sobre:
  - Cuándo ejecutar tests E2E
  - Qué infraestructura requieren
  - Cómo configurar el entorno
  - Alternativas con Playwright MCP

### Suite Principal Afectada

**`tests/integration/shield-stability.test.js`** (actualmente `.skip`):

- Network Stability and Loading States (3 tests)
- Selector Resilience and Fallbacks (3 tests)
- Visual Stability Enhancements (3 tests)
- Edge Cases and Error Recovery (4 tests)
- Performance and Memory Stability (3 tests)
- Cross-browser Compatibility Stability (2 tests)

**Razón del skip:** Requiere Playwright matchers que no están disponibles en Jest

---

## Pasos de Implementación

### Fase 1: Inventario de Tests E2E (15 min)

**Objetivo:** Identificar todos los tests E2E con requirements especiales

**Acciones:**

1. Buscar tests que usan Playwright: `grep -r "require('playwright')" tests/`
2. Buscar tests que requieren servidor: `grep -r "localhost" tests/`
3. Buscar tests con `.skip` y comentarios sobre infrastructure
4. Documentar en tabla:
   - Archivo
   - Requirements (servidor, Playwright, network, etc.)
   - Estado actual (skip/passing/failing)
   - Razón

**Output:** `docs/testing/E2E-INVENTORY.md`

---

### Fase 2: Documentar Requirements (20 min)

**Objetivo:** Crear guía clara de requirements para E2E tests

**Acciones:**

1. Crear `docs/testing/E2E-REQUIREMENTS.md` con secciones:
   - **Overview:** Qué son tests E2E y cuándo ejecutarlos
   - **Infrastructure Requirements:**
     - Servidor corriendo (cómo iniciarlo)
     - Playwright instalado
     - Configuración de red
     - Variables de entorno necesarias
   - **Setup Instructions:**
     - Local development
     - CI/CD
     - Playwright MCP (alternativa)
   - **Execution:**
     - Comandos para ejecutar E2E solo
     - Comandos para skip E2E
     - Timeouts ajustados

2. Añadir sección en `docs/TESTING-GUIDE.md` linkando a E2E requirements

**Template estructura:**

```markdown
# E2E Testing Requirements

## Overview

When to run E2E tests, what they test, why they're separated.

## Infrastructure Requirements

### 1. Server Running

- How to start: `npm run start:api`
- Required port: 3000
- Health check: `curl http://localhost:3000/health`

### 2. Playwright

- Installation: `npx playwright install`
- Browsers needed: chromium, firefox, webkit

### 3. Environment Variables

- TEST_SERVER_URL=http://localhost:3000
- E2E_ENABLED=true (if you want to run E2E)

## Setup Instructions

### Local Development

[paso a paso]

### CI/CD

[configuración GitHub Actions]

### Playwright MCP Alternative

[cómo usar MCP en lugar de servidor local]

## Execution

### Run E2E only

`npm test -- tests/integration/`

### Skip E2E

`npm test -- --testPathIgnorePatterns=integration`

## Troubleshooting

Common issues + solutions
```

**Output:** `docs/testing/E2E-REQUIREMENTS.md`

---

### Fase 3: Añadir Skip Logic (15 min)

**Objetivo:** Tests E2E se skipean automáticamente si no hay infraestructura

**Acciones:**

1. Crear helper `tests/helpers/e2ePrerequisites.js`:

```javascript
/**
 * Check if E2E infrastructure is available
 * @returns {boolean} True if E2E tests can run
 */
function isE2EAvailable() {
  // Check if server is running
  if (!process.env.TEST_SERVER_URL && !process.env.E2E_ENABLED) {
    return false;
  }

  // Check if Playwright is available
  try {
    require('playwright');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Skip test if E2E infrastructure not available
 * Usage: skipIfNoE2E(test, 'requires server running');
 */
function skipIfNoE2E(testFn, reason = 'requires E2E infrastructure') {
  if (!isE2EAvailable()) {
    testFn.skip(reason, () => {});
  }
}

module.exports = { isE2EAvailable, skipIfNoE2E };
```

2. Actualizar `shield-stability.test.js` para usar helper:

```javascript
const { skipIfNoE2E } = require('../helpers/e2ePrerequisites');

describe('Shield Stability Integration Tests', () => {
  skipIfNoE2E(describe, 'requires Playwright + server');

  // Tests...
});
```

3. Aplicar pattern a otras suites E2E identificadas en Fase 1

**Output:** Helper + tests actualizados con skip logic

---

### Fase 4: CI/CD Configuration (10 min)

**Objetivo:** Configurar GitHub Actions para ejecutar E2E cuando apropiado

**Acciones:**

1. Revisar `.github/workflows/` para ver configuración actual
2. Añadir job separado para E2E tests:

```yaml
e2e-tests:
  runs-on: ubuntu-latest
  if: contains(github.event.pull_request.labels.*.name, 'test:e2e')
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
    - run: npm ci
    - run: npx playwright install
    - run: npm start & # Start server in background
    - run: sleep 5 # Wait for server
    - run: npm test -- tests/integration/
      env:
        TEST_SERVER_URL: http://localhost:3000
        E2E_ENABLED: true
```

3. Documentar en `docs/testing/E2E-REQUIREMENTS.md` sección CI/CD

**Output:** Workflow actualizado (si no existe) o documentación de workflow existente

---

## Acceptance Criteria Mapping

| AC                                          | Fase   | Verificación                                           |
| ------------------------------------------- | ------ | ------------------------------------------------------ |
| ✅ Documentación de E2E requirements creada | Fase 2 | `docs/testing/E2E-REQUIREMENTS.md` existe              |
| ✅ Tests E2E documentados con requirements  | Fase 1 | `docs/testing/E2E-INVENTORY.md` completo               |
| ✅ Skip logic añadido donde apropiado       | Fase 3 | Helper `e2ePrerequisites.js` + tests usando            |
| ✅ Instrucciones de setup claras            | Fase 2 | Sección "Setup Instructions" en requirements doc       |
| ✅ CI/CD configurado si necesario           | Fase 4 | Workflow job para E2E o documentación de config actual |

---

## Agentes Relevantes

**TestEngineer:**

- Trigger: Tests E2E, documentación de testing
- Workflow: Revisar suites E2E + validar skip logic
- Receipt: `docs/agents/receipts/cursor-test-engineer-896.md`

**Explore (opcional):**

- Trigger: Si necesito investigar estructura de tests más profunda
- Workflow: Búsqueda codebase para patterns E2E
- Receipt: `docs/agents/receipts/cursor-explore-896.md`

---

## Archivos Afectados

**Creados:**

- `docs/testing/E2E-REQUIREMENTS.md` (nuevo)
- `docs/testing/E2E-INVENTORY.md` (nuevo)
- `tests/helpers/e2ePrerequisites.js` (nuevo)

**Modificados:**

- `tests/integration/shield-stability.test.js` (actualizar skip logic)
- `docs/TESTING-GUIDE.md` (añadir link a E2E requirements)
- `.github/workflows/*.yml` (posible, depende de config actual)
- Otros tests E2E identificados en Fase 1

---

## Validación Requerida

### Pre-Commit

- [ ] Todos los archivos nuevos creados
- [ ] Skip logic implementado y testeado
- [ ] Documentación linkeada desde TESTING-GUIDE.md
- [ ] No hay tests E2E fallando sin skip apropiado

### Tests

```bash
# Verificar que tests E2E se skipean si no hay infra
npm test -- tests/integration/shield-stability.test.js
# Output esperado: Tests skipped (requires E2E infrastructure)

# Con E2E habilitado
E2E_ENABLED=true npm test -- tests/integration/shield-stability.test.js
# Output esperado: Tests ejecutan (pueden fallar por otros motivos)
```

### GDD

```bash
# No requiere actualización de nodos (solo documentación)
# Pero validar salud general
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci  # Debe >=87
```

### CodeRabbit

- [ ] 0 comentarios pendientes
- [ ] Documentación clara y completa

---

## Notas de Implementación

### Prioridades

1. **CRÍTICO:** Documentar requirements claramente para evitar confusión
2. **ALTA:** Skip logic para evitar failures en CI por falta de infra
3. **MEDIA:** CI/CD configuration
4. **BAJA:** Playwright MCP como alternativa (documentar, no implementar ahora)

### Decisiones de Diseño

- **Skip helper vs environment check:** Helper centralizado es mejor para consistencia
- **Documentación separada vs inline:** Separada en `docs/testing/` para fácil referencia
- **CI job separado vs integrado:** Depende de config actual, documentar ambas opciones

### Referencias

- Issue #480: EPIC Test Stabilization
- Issue #482: Playwright matchers en Jest
- Issue #884: Verificación de tests
- `docs/TESTING-GUIDE.md`: Guía principal de testing
- Playwright MCP: Ya configurado en proyecto

---

## Checklist Pre-Flight

Antes de marcar PR como lista:

- [ ] Todos los AC completados al 100%
- [ ] Tests pasando (E2E skipped si no hay infra)
- [ ] Documentación completa y clara
- [ ] GDD validado (health >=87)
- [ ] CodeRabbit = 0 comentarios
- [ ] Receipt de TestEngineer generado
- [ ] Links en TESTING-GUIDE.md actualizados

---

**Plan creado:** 2025-11-21  
**Última actualización:** 2025-11-21  
**Estado:** DRAFT → Continuar inmediatamente a implementación
