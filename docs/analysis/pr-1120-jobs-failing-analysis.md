# Análisis Completo: Jobs Failing en PR #1120

**PR:** #1120
**Rama:** `feature/roa-318-cleanup-legacy-v2`
**Fecha:** 2025-12-09
**Workflows afectados:** System Map v2 Consistency Check

---

## 📊 Estado Actual

### Jobs Passing ✅

- Build Check
- CodeRabbit
- Completion Validation Required
- Guardian Agent - Protected Domains Check
- Lint and Test
- Security Audit
- e2e-tests
- guard
- test
- validate-gdd

### Jobs Failing ❌

- **System Map v2 Consistency** (2 runs failing)
  - Run 20078860447 (1m47s) - Health score 0/100
  - Run 20078861665 (37s) - JSON parse error

---

## 🔍 Root Causes Identificadas

### 1. **PROBLEMA CRÍTICO: Script calculate-gdd-health-v2.js NO respeta flag --json**

**Descripción:**
El script `scripts/calculate-gdd-health-v2.js` NO implementa un modo `--json` silencioso. Siempre outputea logs usando `logger.info()`, `logger.warn()`, etc., independientemente de los flags.

**Evidencia:**

```bash
# Cuando se ejecuta con --json, el output incluye logs:
$ node scripts/calculate-gdd-health-v2.js --json
[INFO] 2025-12-09T21:44:26.676Z: 📖 Leyendo métricas oficiales desde SSOT-V2.md (Sección 15)...
[INFO] 2025-12-09T21:44:26.680Z: ✅ gdd-health-v2.json generado (valores desde SSOT)
[INFO] 2025-12-09T21:44:26.680Z: ✅ docs/GDD-V2-HEALTH-REPORT.md generado (valores desde SSOT)
...
```

**Impacto:**

- El workflow redirige stdout + stderr a `gdd-health-v2.json`:
  ```bash
  node scripts/calculate-gdd-health-v2.js --json > gdd-health-v2.json 2>&1
  ```
- El archivo resultante NO es JSON válido (logs + JSON mezclados)
- `jq` no puede parsear el archivo
- El health score se convierte en 0 por el fallback
- CI falla porque 0 < 95

**Código problemático:**

```javascript
// scripts/calculate-gdd-health-v2.js:212-243
function main() {
  try {
    logger.info('📖 Leyendo métricas oficiales desde SSOT-V2.md (Sección 15)...\n');
    // ... más logger.info() calls
    // ❌ NO hay check de flag --json para suprimir logs
  }
}
```

---

### 2. **Workflow system-map-v2-consistency.yml ejecuta en eventos "push"**

**Descripción:**
El workflow se dispara en eventos `push` a ramas `feature/**`, NO solo en `pull_request`.

**Evidencia:**

```yaml
# .github/workflows/system-map-v2-consistency.yml:14-21
on:
  pull_request:
    branches: [main]
  push:
    branches: ['feature/**'] # ← Se ejecuta en push a feature branches
```

**Impacto:**

- Cada push a la rama dispara el workflow
- En modo "push" (línea 234), el check de health falla con `exit 1` si score < 95
- No hay tolerancia como en modo "pull_request" (que solo genera warnings)

**Código problemático:**

```yaml
# Línea 233-242
if (( $(echo "$HEALTH_SCORE < 95" | bc -l 2>/dev/null || echo "1") )); then
  if [ "${{ github.event_name }}" = "pull_request" ]; then
    echo "⚠️ ... treating as WARNING for PR"
    # Don't fail CI for PRs
  else
    echo "❌ Health score $HEALTH_SCORE is below 95 threshold"
    exit 1  # ← FALLA en eventos "push"
  fi
fi
```

---

### 3. **JSON inválido causa SyntaxError en step "Comment PR"**

**Descripción:**
El step "Comment PR with results" (línea 275-340) intenta parsear el JSON usando `JSON.parse()` en Node.js, pero el archivo contiene logs + JSON.

**Evidencia:**

```
Run 20078861665:
SyntaxError: Expected ',' or '}' after property value in JSON at position 101 (line 4 column 32)
    at JSON.parse (<anonymous>)
    at eval (eval at callAsyncFunction (/home/runner/work/_actions/actions/github-script/v8/dist/index.js:36187:16), <anonymous>:20:23)
```

**Impacto:**

- El step falla al intentar leer `gdd-health-v2.json`
- No se puede generar el comentario en el PR
- El workflow completo falla

**Código problemático:**

```javascript
// Línea 296-300
if (fs.existsSync('gdd-health-v2.json')) {
  const health = JSON.parse(fs.readFileSync('gdd-health-v2.json', 'utf8'));
  // ❌ Falla porque el archivo NO es JSON válido
}
```

---

### 4. **Fallback a score=0 es demasiado estricto**

**Descripción:**
Cuando el script falla o el JSON es inválido, el workflow genera un fallback con score=0 y status="unknown".

**Evidencia:**

```yaml
# Línea 218-221
node scripts/calculate-gdd-health-v2.js --json > gdd-health-v2.json 2>&1 || {
  echo "⚠️ Health score reading completed with warnings"
  echo '{"overall_score": 0, "status": "unknown"}' > gdd-health-v2.json
}
```

**Impacto:**

- El score 0 siempre falla el threshold check (0 < 95)
- No hay distinción entre "error de parsing" y "health realmente 0"
- Mensajes engañosos: "Health score 0 is below 95 threshold"

---

## 🎯 Todas las Posibles Causas (Checklist Completo)

### A. Causas de script calculate-gdd-health-v2.js

- [x] **A1. Script NO implementa modo --json silencioso**
  - Siempre outputea logs a stdout/stderr
  - NO chequea `process.argv` para flag `--json`
  - Logger no está configurado para silenciarse

- [x] **A2. Script escribe JSON a archivo pero también outputea logs**
  - Genera `gdd-health-v2.json` correctamente
  - Pero TAMBIÉN outputea logs que contaminan stdout
  - Workflow redirige ambos al mismo archivo

- [ ] **A3. Script podría fallar al leer SSOT-V2.md** (NO aplica en este caso)
  - SSOT-V2.md existe y tiene sección 15 completa
  - Localmente funciona al 100%

- [ ] **A4. Script podría tener regex mal construida** (NO aplica)
  - Los regex para extraer métricas funcionan correctamente
  - Localmente extrae health_score: 100

### B. Causas del workflow system-map-v2-consistency.yml

- [x] **B1. Workflow ejecuta en eventos "push", NO solo "pull_request"**
  - Se dispara en push a `feature/**`
  - Lógica de threshold es más estricta para "push"

- [x] **B2. Redirección de stdout + stderr contamina JSON**
  - Línea 218: `> gdd-health-v2.json 2>&1`
  - Mezcla logs con JSON

- [x] **B3. Fallback a score=0 es demasiado estricto**
  - No distingue entre error de parsing y health bajo
  - Siempre falla threshold check

- [x] **B4. Step "Comment PR" no tiene manejo de JSON inválido**
  - JSON.parse() falla sin try-catch
  - Workflow completo falla

- [ ] **B5. Condición de full_validation podría skipear steps** (NO aplica)
  - Líneas 204, 214: `if: github.event.inputs.full_validation != 'false' || github.event_name == 'workflow_dispatch'`
  - En push events, esta condición es falsy
  - **WAIT**: Esto SÍ aplica - los steps se skipean en push events!

### C. Causas de configuración de environment

- [ ] **C1. bc no está instalado en runner** (POCO probable)
  - Runner ubuntu-latest tiene bc por defecto
  - Otros workflows funcionan

- [ ] **C2. jq no está instalado** (NO aplica)
  - jq funciona en otros steps
  - El problema es el JSON inválido, no jq

- [ ] **C3. Node.js versión incompatible** (NO aplica)
  - Usa Node 20, compatible
  - Otros jobs con Node 20 pasan

### D. Causas de contenido del PR

- [x] **D1. SSOT-V2.md es nuevo archivo en esta rama**
  - `git diff main...HEAD` muestra que SSOT-V2.md es nuevo
  - Esto dispara el workflow en push

- [ ] **D2. Sección 15 podría estar incompleta** (NO aplica)
  - Sección 15 está completa con todas las métricas
  - Health score: 100/100

- [ ] **D3. Formato de tabla en sección 15 incorrecto** (NO aplica)
  - Regex extrae correctamente los valores
  - Localmente funciona perfectamente

---

## 🐛 Causa Raíz DEFINITIVA

### Causa Primaria: Script calculate-gdd-health-v2.js

**El script NO tiene implementación de modo --json silencioso.**

```javascript
// ❌ FALTA esta lógica:
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');

if (!jsonMode) {
  logger.info('📖 Leyendo métricas...');
  // ... logs normales
} else {
  // Silenciar logger
  console.log(JSON.stringify(metrics, null, 2));
}
```

### Causa Secundaria: Workflow redirecciona stdout + stderr

**El workflow asume que el script outputea SOLO JSON, pero no es así.**

```yaml
# ❌ PROBLEMA:
node scripts/calculate-gdd-health-v2.js --json > gdd-health-v2.json 2>&1
# Esto mezcla logs + JSON en el mismo archivo
```

### Causa Terciaria: Condición de full_validation

**Los steps de health check se skipean en eventos "push".**

```yaml
# Línea 204, 214:
if: github.event.inputs.full_validation != 'false' || github.event_name == 'workflow_dispatch'
```

- En `push` events, `github.event.inputs.full_validation` NO existe
- La condición es falsy
- **Los steps de health check SE SKIPEAN**

**PERO** el step "Comment PR" (línea 275) ejecuta siempre con `if: always()` e intenta leer el JSON que NO FUE GENERADO.

---

## 📝 Resumen Ejecutivo

**3 problemas interrelacionados:**

1. **Script NO implementa --json mode** → Outputea logs + JSON
2. **Workflow redirige stdout+stderr** → JSON contaminado con logs
3. **Condición de full_validation** → Steps se skipean en push, pero "Comment PR" ejecuta siempre

**Resultado:**

- En eventos "push": Health check se skipea, pero "Comment PR" intenta leer JSON inexistente
- En eventos "pull_request": Health check ejecuta, genera JSON inválido, "Comment PR" falla al parsear

---

## ✅ Soluciones Propuestas

### Solución 1: Implementar modo --json en script (RECOMENDADA)

```javascript
// scripts/calculate-gdd-health-v2.js
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');

function main() {
  try {
    if (!jsonMode) logger.info('📖 Leyendo métricas...');

    const metrics = readMetricsFromSSOT();

    if (jsonMode) {
      // SOLO outputear JSON, sin logs
      console.log(JSON.stringify(metrics, null, 2));
      process.exit(0);
    }

    // Comportamiento normal con logs
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(metrics, null, 2), 'utf8');
    logger.info('✅ gdd-health-v2.json generado');
    // ...
  }
}
```

### Solución 2: Arreglar redirección en workflow

```yaml
# Opción A: Redirigir solo stdout
node scripts/calculate-gdd-health-v2.js --json > gdd-health-v2.json 2>/dev/null

# Opción B: Leer desde archivo generado
node scripts/calculate-gdd-health-v2.js
cat gdd-health-v2.json | jq -r '.health_score // 0'
```

### Solución 3: Arreglar condición de full_validation

```yaml
# Línea 204, 214: Cambiar condición
if: github.event_name == 'pull_request' || github.event_name == 'push' || github.event_name == 'workflow_dispatch'

# O más simple:
if: always()  # Ejecutar siempre
```

### Solución 4: Añadir try-catch en "Comment PR"

```javascript
// Línea 296-307
if (fs.existsSync('gdd-health-v2.json')) {
  try {
    const health = JSON.parse(fs.readFileSync('gdd-health-v2.json', 'utf8'));
    // ...
  } catch (e) {
    console.log('⚠️ Could not parse health JSON:', e.message);
    comment += '| Health Score | ❌ Parse Error |\n';
  }
}
```

---

## 🎯 Recomendación Final

**Implementar las 4 soluciones en orden:**

1. ✅ **Solución 1** (script): Implementar modo --json silencioso
2. ✅ **Solución 3** (workflow): Arreglar condición para que ejecute siempre
3. ✅ **Solución 4** (workflow): Añadir try-catch en parsing
4. ⚠️ **Solución 2** (opcional): Mejorar redirección (ya no necesario si #1 funciona)

**Esto garantiza:**

- JSON limpio y válido ✅
- Health check ejecuta en todos los eventos ✅
- Errores de parsing no rompen workflow ✅
- Backward compatibility mantenida ✅

---

**Autor:** Claude (Análisis de PR #1120)
**Fecha:** 2025-12-09
