# Issue #477 - Auto-generate GDD sync metrics from JSON files

**Status:** In Planning
**Created:** 2025-10-20
**Issue:** #477
**Labels:** documentation, enhancement
**Priority:** P2
**Estimated Effort:** 2-3 hours

---

## Estado Actual (Assessment)

### Contexto
La issue #477 fue creada durante la revisión de CodeRabbit (Review #3309784384) para evitar la edición manual de métricas de sincronización GDD. Actualmente, métricas como Lighthouse scores, E2E test results, y node counts se actualizan manualmente en la documentación.

### Infraestructura Existente

**1. Coverage Auto-Generation (✅ Implementado)**
- Script: `scripts/gdd-coverage-helper.js`
- Funcionalidad: Sincroniza coverage desde `coverage/coverage-summary.json` a nodos GDD
- Status: Todos los nodos tienen `**Coverage Source:** auto`

**2. Archivos JSON Disponibles**
- `gdd-status.json` - Estado del grafo GDD (node count, health, orphans, etc.)
- `lighthouse-report.json` - Scores de accesibilidad y performance
- `coverage/coverage-summary.json` - Cobertura de tests
- Test results (CI logs, Jest output) - Resultados de tests E2E

**3. Documentos que Requieren Actualización**
- `docs/GDD-IMPLEMENTATION-SUMMARY.md` - Quick Stats section
- `docs/nodes/*.md` - Métricas individuales de nodos (coverage ya auto-generado)
- Posibles logs de sincronización

### Métricas a Auto-Generar

Según el contexto original de la issue (Review #3309784384):

1. **Lighthouse Score** (actualmente manual)
   - Source: `docs/test-evidence/*/lighthouse-report*.json`
   - Métrica: Accessibility score (e.g., 98/100)
   - Target: GDD-IMPLEMENTATION-SUMMARY.md

2. **Node Count** (actualmente manual)
   - Source: `gdd-status.json` → `nodes_validated`
   - Métrica: Total nodes documented (e.g., 13/13)
   - Target: GDD-IMPLEMENTATION-SUMMARY.md

3. **E2E Test Results** (actualmente manual)
   - Source: Test output / CI logs
   - Métrica: Passing tests (e.g., 71/85, 83.5%)
   - Target: GDD-IMPLEMENTATION-SUMMARY.md

4. **System Health Score** (parcialmente auto-generado)
   - Source: `scripts/score-gdd-health.js` output
   - Métrica: Average health score (e.g., 98.8/100)
   - Target: GDD-IMPLEMENTATION-SUMMARY.md

---

## Análisis de Gaps

### Lo que YA existe
- ✅ Coverage auto-generation (`gdd-coverage-helper.js`)
- ✅ Health scoring (`score-gdd-health.js`)
- ✅ GDD status validation (`validate-gdd-runtime.js` → `gdd-status.json`)
- ✅ Archivos JSON con datos necesarios

### Lo que FALTA
- ❌ Script para leer lighthouse-report.json y extraer scores
- ❌ Script para leer gdd-status.json y actualizar node count
- ❌ Script para leer test results y actualizar E2E metrics
- ❌ Script unificado que actualice GDD-IMPLEMENTATION-SUMMARY.md
- ❌ Integración en CI/CD para auto-sync después de builds

---

## Plan de Implementación

### Fase 1: Script de Sincronización de Métricas (Core)

**Objetivo:** Crear `scripts/sync-gdd-metrics.js` que lea archivos JSON y actualice documentación

**Componentes:**

1. **MetricsCollector Class**
   - `collectLighthouseScores()` - Lee lighthouse-report.json más reciente
   - `collectNodeCount()` - Lee gdd-status.json
   - `collectHealthScore()` - Ejecuta score-gdd-health.js o lee output
   - `collectTestResults()` - Lee test output/coverage-summary.json
   - `collectAll()` - Orquesta todas las colecciones

2. **DocumentUpdater Class**
   - `updateGDDSummary(metrics)` - Actualiza GDD-IMPLEMENTATION-SUMMARY.md
   - `updateReadme(metrics)` - Actualiza README.md (opcional)
   - `updateAll(metrics)` - Aplica todas las actualizaciones

3. **CLI Interface**
   ```bash
   node scripts/sync-gdd-metrics.js                  # Interactive mode
   node scripts/sync-gdd-metrics.js --auto           # Auto-sync all
   node scripts/sync-gdd-metrics.js --dry-run        # Preview changes
   node scripts/sync-gdd-metrics.js --ci             # CI mode (silent)
   node scripts/sync-gdd-metrics.js --metric=<name>  # Sync specific metric
   ```

**Archivos a Crear:**
- `scripts/sync-gdd-metrics.js` (nuevo)
- `tests/unit/scripts/sync-gdd-metrics.test.js` (nuevo)

**Archivos a Modificar:**
- `docs/GDD-IMPLEMENTATION-SUMMARY.md` (actualización automática)
- `.github/workflows/gdd-sync.yml` (nuevo workflow, opcional)

### Fase 2: Integración con Documentación

**Objetivo:** Asegurar que la documentación se actualiza automáticamente

**Acciones:**

1. **Agregar marcadores en documentación**
   ```markdown
   <!-- GDD_METRIC:NODE_COUNT -->13/13<!-- /GDD_METRIC:NODE_COUNT -->
   <!-- GDD_METRIC:HEALTH_SCORE -->98.8/100<!-- /GDD_METRIC:HEALTH_SCORE -->
   <!-- GDD_METRIC:LIGHTHOUSE_SCORE -->98/100<!-- /GDD_METRIC:LIGHTHOUSE_SCORE -->
   ```

2. **Implementar parser que busca y reemplaza entre marcadores**
   - Regex para detectar marcadores
   - Validación de formato
   - Preservar estructura markdown

3. **Backup antes de modificar**
   - Similar a `auto-repair-gdd.js`
   - Rollback si falla validación

### Fase 3: Tests y Validación

**Objetivo:** Garantizar calidad y prevenir regresiones

**Tests a Crear:**

1. **Unit Tests**
   - `MetricsCollector.collectLighthouseScores()` - Mock JSON, verificar parsing
   - `MetricsCollector.collectNodeCount()` - Mock gdd-status.json
   - `DocumentUpdater.updateGDDSummary()` - Mock file system
   - Error handling para archivos faltantes

2. **Integration Tests**
   - End-to-end: Generar JSON → ejecutar script → verificar actualización
   - Validar que marcadores se preservan
   - Verificar rollback en caso de error

3. **Validation Scripts**
   - `node scripts/sync-gdd-metrics.js --validate` - Verifica consistencia
   - Compara métricas en docs vs. archivos JSON
   - Alerta si desincronización >3%

### Fase 4: CI/CD Integration (Opcional)

**Objetivo:** Automatizar sincronización en cada PR

**Workflow:**

```yaml
# .github/workflows/gdd-sync.yml
name: Sync GDD Metrics

on:
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  sync-metrics:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests to generate coverage
        run: npm test -- --coverage

      - name: Sync GDD metrics
        run: node scripts/sync-gdd-metrics.js --auto --ci

      - name: Commit updated metrics
        run: |
          git config --local user.email "github-actions[bot]@users.noreply.github.com"
          git config --local user.name "github-actions[bot]"
          git add docs/
          git commit -m "chore(gdd): Auto-sync metrics from JSON reports" || echo "No changes"
          git push
```

---

## Acceptance Criteria

### AC1: Script crea/actualiza métricas desde archivos JSON
- ✅ Lee lighthouse-report.json y extrae accessibility score
- ✅ Lee gdd-status.json y extrae node count
- ✅ Lee coverage-summary.json y calcula overall coverage
- ✅ Lee test results y calcula E2E pass rate

### AC2: Documentación se actualiza automáticamente
- ✅ GDD-IMPLEMENTATION-SUMMARY.md refleja métricas actuales
- ✅ Marcadores preservados correctamente
- ✅ Formato markdown no se rompe

### AC3: Modo dry-run funciona sin modificar archivos
- ✅ Muestra preview de cambios
- ✅ No escribe archivos
- ✅ Reporta diferencias detectadas

### AC4: Tests completos y pasando
- ✅ Unit tests para MetricsCollector (mocks)
- ✅ Unit tests para DocumentUpdater (mocks)
- ✅ Integration test end-to-end
- ✅ 100% coverage en nuevo código

### AC5: CI mode para integración en workflows
- ✅ Modo silencioso (--ci)
- ✅ Exit code 0 si éxito, 1 si error
- ✅ JSON output para parsear en workflows

### AC6: Documentación actualizada
- ✅ README en script explica uso
- ✅ CLAUDE.md referencia nuevo comando
- ✅ docs/GDD-ACTIVATION-GUIDE.md incluye sync-gdd-metrics

---

## Riesgos y Mitigación

### Riesgo 1: Archivos JSON no existen o están malformados
**Mitigación:**
- Validación robusta con try/catch
- Fallback a valores actuales si JSON falta
- Logging claro de errores
- No modificar docs si datos inválidos

### Riesgo 2: Romper formato markdown al actualizar
**Mitigación:**
- Usar marcadores específicos (<!-- GDD_METRIC:* -->)
- Regex cuidadoso que preserve estructura
- Backup antes de modificar (como auto-repair)
- Rollback automático si validación falla

### Riesgo 3: Desincronización entre fuentes de verdad
**Mitigación:**
- Validar que archivos JSON son recientes (<24h)
- Comando --validate para detectar drift
- CI check que alerta si docs desactualizados

### Riesgo 4: Overhead en CI/CD
**Mitigación:**
- Script optimizado (<5s ejecución)
- Solo sincronizar si archivos JSON cambiaron
- Modo --ci sin output verboso

---

## Estimación de Esfuerzo

**Fase 1: Script Core** - 1.5h
- MetricsCollector: 0.5h
- DocumentUpdater: 0.5h
- CLI interface: 0.5h

**Fase 2: Integración Docs** - 0.5h
- Marcadores en GDD-IMPLEMENTATION-SUMMARY.md: 0.5h

**Fase 3: Tests** - 1h
- Unit tests: 0.5h
- Integration test: 0.5h

**Fase 4: CI/CD (Opcional)** - 0.5h
- Workflow YAML: 0.5h

**Total:** 2.5h - 3.5h (dentro del rango estimado original)

---

## Archivos Afectados

**Nuevos:**
- `scripts/sync-gdd-metrics.js` (~300 líneas)
- `tests/unit/scripts/sync-gdd-metrics.test.js` (~200 líneas)
- `.github/workflows/gdd-sync.yml` (opcional, ~40 líneas)

**Modificados:**
- `docs/GDD-IMPLEMENTATION-SUMMARY.md` (agregar marcadores)
- `CLAUDE.md` (documentar nuevo comando)
- `docs/GDD-ACTIVATION-GUIDE.md` (incluir en workflow)
- `package.json` (agregar npm script: `npm run gdd:sync`)

**Total estimado:** ~540 líneas nuevas, ~50 líneas modificadas

---

## Agentes Relevantes

- **Backend Developer** - Implementación del script
- **Test Engineer** - Suite de tests
- **Documentation Agent** - Actualización de documentación
- **Orchestrator** - Coordinación y planning

---

## Referencias

- Issue #477: Auto-generate GDD sync metrics from JSON files
- Review #3309784384: Contexto original de la issue
- `scripts/gdd-coverage-helper.js`: Patrón de referencia para auto-sync
- `scripts/auto-repair-gdd.js`: Patrón de backup/rollback
- `docs/GDD-IMPLEMENTATION-SUMMARY.md`: Documento objetivo

---

## Siguiente Paso

**Implementación:** Crear `scripts/sync-gdd-metrics.js` con MetricsCollector y DocumentUpdater

**Prioridad:** P2 (enhancement, no bloqueante pero mejora DX)

**Dependencias:** Ninguna (puede implementarse independientemente)
