# Análisis de Workflows GDD/System-Map

**Fecha:** 2025-12-09  
**Análisis:** Workflows que ejecutan validaciones GDD o system-map

---

## 📋 Workflows Analizados

1. **system-map-v2-consistency.yml** - Validación v2 principal
2. **gdd-validate.yml** - Validación GDD (v1 + v2 mixto)
3. **gdd-telemetry.yml** - Telemetría GDD
4. **gdd-repair.yml** - Reparación GDD
5. **gdd-auto-monitor.yml** - Monitoreo automático GDD
6. **pre-merge-validation.yml** - Validación pre-merge (no ejecuta GDD directamente)
7. **post-merge-doc-sync.yml** - Sincronización post-merge (v1)

---

## 1️⃣ Scripts Ejecutados

### system-map-v2-consistency.yml (v2)

**Scripts ejecutados (en orden):**

1. `validate-node-ids.js --ci`
2. `validate-workers-ssot.js --ci`
3. `validate-drift.js --ci`
4. `validate-symmetry.js --ci`
5. `validate-strong-concepts.js --ci`
6. `detect-legacy-ids.js --ci`
7. `detect-guardian-references.js --ci`
8. `check-system-map-drift.js --ci`
9. `validate-v2-doc-paths.js --ci`
10. `compute-health-v2-official.js` (cálculo)
11. `calculate-gdd-health-v2.js --json` (lectura desde SSOT)

**✅ Estado:** Todos son scripts v2

### gdd-validate.yml (v1 + v2 mixto)

**Scripts v2 ejecutados (condicionales):**

- `validate-symmetry.js --ci` (si cambia system-map-v2.yaml)
- `validate-strong-concepts.js --ci` (si cambia system-map-v2.yaml o nodes-v2/)
- `validate-drift.js --ci` (si cambia SSOT-V2.md, nodes-v2/, o system-map-v2.yaml)
- `detect-guardian-references.js --ci` (si cambia system-map-v2.yaml o nodes-v2/)

**Scripts v1 ejecutados (si no es v2-only):**

- `validate-gdd-runtime.js --ci`
- `score-gdd-health.js --ci` ⚠️ **V1 LEGACY**
- `predict-gdd-drift.js --ci`

**⚠️ PROBLEMA:** Ejecuta `score-gdd-health.js` (v1) cuando no es PR v2-only

### gdd-telemetry.yml

**Scripts ejecutados:**

- `validate-gdd-runtime.js --ci || true`
- `score-gdd-health.js --ci || true` ⚠️ **V1 LEGACY**
- `predict-gdd-drift.js --ci || true`

**⚠️ PROBLEMA:** Ejecuta scripts v1 (pero con `|| true`, no bloquea)

### gdd-repair.yml

**Scripts ejecutados:**

- `validate-gdd-runtime.js --ci`
- `score-gdd-health.js --ci` ⚠️ **V1 LEGACY**

**⚠️ PROBLEMA:** Ejecuta `score-gdd-health.js` (v1)

### gdd-auto-monitor.yml

**Scripts ejecutados:**

- `validate-gdd-runtime.js --ci`
- `score-gdd-health.js --summary` ⚠️ **V1 LEGACY**

**⚠️ PROBLEMA:** Ejecuta `score-gdd-health.js` (v1)

---

## 2️⃣ Scripts v1 Detectados

### ❌ CRÍTICO: Health v1 sigue activo en múltiples workflows

**Workflows que ejecutan `score-gdd-health.js` (v1):**

1. **gdd-validate.yml:272**

   ```yaml
   node scripts/score-gdd-health.js --ci
   ```

   - **Problema:** Ejecuta v1 cuando PR no es v2-only
   - **Impacto:** Health score v1 se calcula en lugar de v2

2. **gdd-telemetry.yml:42**

   ```yaml
   node scripts/score-gdd-health.js --ci || true
   ```

   - **Problema:** Ejecuta v1 (pero no bloquea por `|| true`)
   - **Impacto:** Telemetría usa health v1

3. **gdd-repair.yml:115**

   ```yaml
   node scripts/score-gdd-health.js --ci
   ```

   - **Problema:** Ejecuta v1 después de reparación
   - **Impacto:** Reparación valida con health v1

4. **gdd-auto-monitor.yml:104**

   ```yaml
   node scripts/score-gdd-health.js --summary
   ```

   - **Problema:** Ejecuta v1 para monitoreo
   - **Impacto:** Monitoreo automático usa health v1

**✅ system-map-v2-consistency.yml:** NO ejecuta v1 (correcto)

---

## 3️⃣ Orden de Steps

### system-map-v2-consistency.yml

**Orden actual:**

1. Validate Node IDs ✅
2. Validate Workers SSOT ✅
3. Validate Drift ✅
4. Validate Symmetry ✅
5. Validate Strong Concepts ✅
6. Detect Legacy IDs ✅
7. Detect Guardian References ✅
8. Check System Map Drift ✅
9. Validate v2 Doc Paths ✅
10. Calculate GDD Health v2 ✅

**✅ Orden correcto:** Sí, coincide con el orden esperado

**⚠️ PROBLEMA MENOR:** `check-system-map-drift.js` debería ejecutarse ANTES de `validate-v2-doc-paths.js` porque:

- `check-system-map-drift.js` verifica que archivos existen
- `validate-v2-doc-paths.js` valida paths específicos

**Orden recomendado:**

1. Validate Node IDs
2. Validate Workers SSOT
3. Validate Drift
4. Validate Symmetry
5. Validate Strong Concepts
6. **Check System Map Drift** (mover aquí)
7. Detect Legacy IDs
8. Detect Guardian References
9. Validate v2 Doc Paths
10. Calculate GDD Health v2

---

## 4️⃣ Refs (HEAD vs main)

### system-map-v2-consistency.yml

**Checkout:**

```yaml
- name: Checkout code
  uses: actions/checkout@v6
  with:
    fetch-depth: 0
```

**✅ Correcto:** Usa checkout estándar (HEAD de la PR)

**Triggers:**

```yaml
on:
  pull_request:
    branches:
      - main
```

**✅ Correcto:** Se ejecuta en PRs contra `main`

**No hay uso explícito de `origin/main` o `HEAD` en los scripts** - ✅ Correcto

### gdd-validate.yml

**Checkout:**

```yaml
- name: Checkout code
  uses: actions/checkout@v6
  with:
    fetch-depth: 0
```

**Comparación de archivos:**

```bash
git diff --name-only origin/${{ github.base_ref }}...HEAD > changed-files.txt
```

**✅ Correcto:** Usa `origin/${{ github.base_ref }}` (dinámico según base branch)

---

## 5️⃣ Health v1 Sigue Activo

### ❌ CRÍTICO: Health v1 activo en 4 workflows

**Workflows afectados:**

1. **gdd-validate.yml**
   - **Línea 272:** `node scripts/score-gdd-health.js --ci`
   - **Condición:** Se ejecuta cuando PR NO es v2-only
   - **Problema:** Calcula health v1 en lugar de v2

2. **gdd-telemetry.yml**
   - **Línea 42:** `node scripts/score-gdd-health.js --ci || true`
   - **Condición:** Siempre se ejecuta (telemetría diaria)
   - **Problema:** Telemetría usa health v1

3. **gdd-repair.yml**
   - **Línea 115:** `node scripts/score-gdd-health.js --ci`
   - **Condición:** Después de reparación
   - **Problema:** Valida reparación con health v1

4. **gdd-auto-monitor.yml**
   - **Línea 104:** `node scripts/score-gdd-health.js --summary`
   - **Condición:** Monitoreo automático
   - **Problema:** Monitoreo usa health v1

**✅ system-map-v2-consistency.yml:** NO ejecuta health v1 (correcto)

---

## 6️⃣ detect-legacy-ids.js y código src/

### system-map-v2-consistency.yml

**Configuración:**

```yaml
- name: Detect Legacy IDs
  id: detect_legacy_ids
  run: |
    echo "🔍 Detecting legacy IDs..."
    node scripts/detect-legacy-ids.js --ci
    echo "✅ Legacy IDs detection completed"
  continue-on-error: false
```

**⚠️ PROBLEMA:** `continue-on-error: false` hace que el workflow FALLE si detecta legacy IDs en `src/`

**Comportamiento esperado:**

- `detect-legacy-ids.js` detecta 43 IDs legacy en código `src/`
- Estos están fuera del scope de ROA-318
- El script debería WARN pero no FAIL en CI

**Solución recomendada:**

```yaml
continue-on-error: true # O cambiar a true porque legacy en src/ es esperado
```

**O mejor aún:** Modificar `detect-legacy-ids.js` para que en modo `--ci`:

- Si encuentra legacy IDs solo en `src/` → WARN (exit 0)
- Si encuentra legacy IDs en `docs/` o `system-map-v2.yaml` → FAIL (exit 1)

---

## 7️⃣ check-system-map-drift.js - Orden Incorrecto

### system-map-v2-consistency.yml

**Orden actual:**

1. Validate Node IDs
2. Validate Workers SSOT
3. Validate Drift
4. Validate Symmetry
5. Validate Strong Concepts
6. **Detect Legacy IDs** (línea 95)
7. **Detect Guardian References** (línea 103)
8. **Check System Map Drift** (línea 111) ⚠️
9. **Validate v2 Doc Paths** (línea 119)

**⚠️ PROBLEMA:** `check-system-map-drift.js` se ejecuta DESPUÉS de `detect-legacy-ids.js` y `detect-guardian-references.js`

**Razón del problema:**

- `check-system-map-drift.js` verifica que archivos en `nodes-v2/` existen y están referenciados
- `validate-v2-doc-paths.js` valida paths específicos de cada nodo
- Si `check-system-map-drift.js` falla, `validate-v2-doc-paths.js` también fallará (redundancia)

**Orden recomendado:**

1. Validate Node IDs
2. Validate Workers SSOT
3. Validate Drift
4. Validate Symmetry
5. Validate Strong Concepts
6. **Check System Map Drift** ← MOVER AQUÍ (antes de validaciones de paths)
7. Validate v2 Doc Paths
8. Detect Legacy IDs
9. Detect Guardian References
10. Calculate GDD Health v2

**Lógica:**

- Primero verificar estructura (drift)
- Luego verificar paths específicos
- Finalmente detectar problemas (legacy, guardian)
- Al final calcular health

---

## 📊 Resumen de Issues

### ❌ CRÍTICOS

1. **Health v1 activo en 4 workflows**
   - `gdd-validate.yml` ejecuta `score-gdd-health.js` (v1)
   - `gdd-telemetry.yml` ejecuta `score-gdd-health.js` (v1)
   - `gdd-repair.yml` ejecuta `score-gdd-health.js` (v1)
   - `gdd-auto-monitor.yml` ejecuta `score-gdd-health.js` (v1)

2. **detect-legacy-ids.js falla por código src/**
   - `continue-on-error: false` hace que workflow falle
   - 43 IDs legacy en `src/` están fuera de scope ROA-318
   - Debería WARN pero no FAIL

### ⚠️ MODERADOS

3. **Orden de steps subóptimo**
   - `check-system-map-drift.js` debería ejecutarse antes de `validate-v2-doc-paths.js`
   - `check-system-map-drift.js` debería ejecutarse antes de `detect-legacy-ids.js`

### ✅ CORRECTOS

4. **system-map-v2-consistency.yml**
   - ✅ Solo ejecuta scripts v2
   - ✅ Orden de steps correcto (con excepción menor)
   - ✅ No ejecuta health v1
   - ✅ Usa refs correctos (HEAD de PR)

5. **Refs (HEAD vs main)**
   - ✅ Todos los workflows usan refs correctos
   - ✅ No hay hardcoding de `main` en scripts

---

## 🎯 Jobs que Fallan y Por Qué

### 1. system-map-v2-consistency.yml → detect-legacy-ids

**Job:** `system-map-v2-consistency`  
**Step:** `Detect Legacy IDs`  
**Razón del fallo:**

- `detect-legacy-ids.js --ci` encuentra 43 IDs legacy en código `src/`
- `continue-on-error: false` hace que el step falle
- El workflow completo falla aunque los legacy IDs en `src/` están fuera de scope

**Solución:** Cambiar a `continue-on-error: true` o modificar script para WARN en `src/`

### 2. gdd-validate.yml → score-gdd-health (v1)

**Job:** `validate-gdd`  
**Step:** `Run GDD validation` (cuando no es v2-only)  
**Razón del fallo potencial:**

- Ejecuta `score-gdd-health.js` (v1) cuando PR no es v2-only
- Si health v1 < threshold, el workflow falla
- Pero debería usar health v2 en su lugar

**Solución:** Reemplazar `score-gdd-health.js` por `compute-health-v2-official.js` + `calculate-gdd-health-v2.js`

---

## 📝 Recomendaciones

### Prioridad Alta

1. **Desactivar health v1 en workflows v2**
   - Reemplazar `score-gdd-health.js` por scripts v2 en:
     - `gdd-validate.yml`
     - `gdd-telemetry.yml`
     - `gdd-repair.yml`
     - `gdd-auto-monitor.yml`

2. **Ajustar detect-legacy-ids.js en CI**
   - Cambiar `continue-on-error: false` → `true` en `system-map-v2-consistency.yml`
   - O modificar script para WARN en `src/`, FAIL solo en `docs/`

### Prioridad Media

3. **Reordenar steps en system-map-v2-consistency.yml**
   - Mover `check-system-map-drift.js` antes de `validate-v2-doc-paths.js`
   - Mover `check-system-map-drift.js` antes de `detect-legacy-ids.js`

---

**Última actualización:** 2025-12-09
