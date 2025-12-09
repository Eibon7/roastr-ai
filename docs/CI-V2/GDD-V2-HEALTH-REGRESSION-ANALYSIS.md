# GDD v2 Health Score - Regression Analysis

**Fecha:** 2025-12-08  
**Commit con 100/100:** `7d21f1b7` (ROA-258)  
**Health Score en 7d21f1b7:** 100/100  
**Health Score Actual:** 30/100  
**Regresión:** -70 puntos

---

## 1. Comparación de Scripts

### Script en commit 7d21f1b7 (100/100)

**Archivo:** `scripts/calculate-gdd-health-v2.js`  
**Líneas:** 464  
**Lógica `findNodeFile()`:** Idéntica a la actual

```javascript
function findNodeFile(nodeName) {
  // 1. Intenta match exacto: ${nodeName}.md
  // 2. Si no existe, busca formato numerado: XX-${nodeName}.md
  // 3. NO usa el campo docs: del system-map-v2.yaml
}
```

### Script Actual (30/100)

**Archivo:** `scripts/calculate-gdd-health-v2.js`  
**Líneas:** 464  
**Lógica `findNodeFile()`:** Idéntica al commit 7d21f1b7

**Conclusión:** El script NO ha cambiado entre el commit 100/100 y el actual.

---

## 2. Comparación de Archivos de Nodos

### Archivos en commit 7d21f1b7 (100/100)

```
01-arquitectura-general.md
02-autenticacion-usuarios.md
03-billing-polar.md
04-integraciones.md
05-motor-analisis.md
06-motor-roasting.md
07-shield.md
08-workers.md
09-panel-usuario.md
10-panel-administracion.md
11-feature-flags.md
12-gdpr-legal.md
13-testing.md
14-infraestructura.md
15-ssot-integration.md
billing.md
```

### Archivos Actuales

```
01-arquitectura-general.md
02-autenticacion-usuarios.md
03-billing-polar.md
04-integraciones.md
05-motor-analisis.md
06-motor-roasting.md
07-shield.md
08-workers.md
09-panel-usuario.md
10-panel-administracion.md
11-feature-flags.md
12-gdpr-legal.md
13-testing.md
14-infraestructura.md
15-ssot-integration.md
billing.md
```

**Conclusión:** Los archivos son IDÉNTICOS. No ha habido cambios en los nombres de archivos.

---

## 3. Comparación de system-map-v2.yaml

### system-map-v2.yaml en commit 7d21f1b7

- **Total nodos:** 15
- **Nombres de nodos:** Idénticos a los actuales
- **Campo `docs:`:** Especifica archivos como `docs/nodes-v2/roasting-engine.md`, etc.

### system-map-v2.yaml Actual

- **Total nodos:** 15
- **Nombres de nodos:** Idénticos al commit 7d21f1b7
- **Campo `docs:`:** Especifica archivos como `docs/nodes-v2/roasting-engine.md`, etc.

**Conclusión:** El system-map-v2.yaml NO ha cambiado entre el commit 100/100 y el actual.

---

## 4. Comparación de Health Scores

### Health Score en commit 7d21f1b7 (100/100)

```json
{
  "nodes_detected": 15,
  "nodes_missing": 0,
  "system_map_alignment_score": 100,
  "dependency_density_score": 100,
  "crosslink_score": 100,
  "ssot_alignment_score": 100,
  "health_score": 100
}
```

### Health Score Actual (30/100)

```json
{
  "nodes_detected": 4,
  "nodes_missing": 11,
  "system_map_alignment_score": 26.67,
  "dependency_density_score": 30,
  "crosslink_score": 10,
  "ssot_alignment_score": 20,
  "health_score": 30
}
```

---

## 5. ¿Qué Cambió?

### Análisis de Diferencias

**Script:** ❌ NO cambió (idéntico)  
**Archivos de nodos:** ❌ NO cambiaron (mismos nombres)  
**system-map-v2.yaml:** ❌ NO cambió (mismos nodos, mismos nombres)

### Hipótesis Principal

**El health score de 100/100 en el commit 7d21f1b7 fue INCORRECTO o se generó de manera diferente.**

Posibles explicaciones:

1. **El script nunca funcionó correctamente** - El 100/100 fue un error o se generó manualmente
2. **Había archivos con nombres exactos** que luego fueron eliminados/renombrados (pero no aparecen en el historial)
3. **El script usaba el campo `docs:` del system-map** en ese momento, pero luego se perdió esa funcionalidad
4. **El health score se calculó de otra manera** (script diferente, mapeo estático, etc.)

### Evidencia

- El commit `00ce3c52` dice "remove static NODE_NAME_MAPPING" - esto sugiere que antes había un mapeo estático
- El commit `00ce3c52` tiene health score 100/100 con 15 nodos detectados
- El script actual NO puede encontrar los archivos porque los nombres no coinciden
- El system-map-v2.yaml especifica archivos en `docs:` pero el script NO los usa

---

## 6. Mapeo Esperado vs Real

### Nodos en system-map-v2.yaml (campo `docs:`)

| Nodo                                | Archivo esperado (docs:)               | Archivo real                   | ¿Coincide?             |
| ----------------------------------- | -------------------------------------- | ------------------------------ | ---------------------- |
| `roasting-engine`                   | `roasting-engine.md`                   | `06-motor-roasting.md`         | ❌ NO                  |
| `analysis-engine`                   | `analysis-engine.md`                   | `05-motor-analisis.md`         | ❌ NO                  |
| `shield-engine`                     | `shield-engine.md`                     | `07-shield.md`                 | ❌ NO                  |
| `integraciones-redes-sociales`      | `integraciones-redes-sociales.md`      | `04-integraciones.md`          | ❌ NO                  |
| `billing`                           | `billing.md`                           | `billing.md`                   | ✅ SÍ                  |
| `infraestructura`                   | `infraestructura.md`                   | `14-infraestructura.md`        | ✅ SÍ (match numerado) |
| `observabilidad`                    | `observabilidad.md`                    | ❌ NO EXISTE                   | ❌ NO                  |
| `frontend-user-app`                 | `frontend-user-app.md`                 | `09-panel-usuario.md`          | ❌ NO                  |
| `frontend-admin`                    | `frontend-admin.md`                    | `10-panel-administracion.md`   | ❌ NO                  |
| `ssot-integration`                  | `ssot-integration.md`                  | `15-ssot-integration.md`       | ✅ SÍ (match numerado) |
| `workers`                           | `workers.md`                           | `08-workers.md`                | ✅ SÍ (match numerado) |
| `auth`                              | `auth.md`                              | `02-autenticacion-usuarios.md` | ❌ NO                  |
| `settings-loader-and-feature-flags` | `settings-loader-and-feature-flags.md` | `11-feature-flags.md`          | ❌ NO                  |
| `gdpr-and-legal`                    | `gdpr-and-legal.md`                    | `12-gdpr-legal.md`             | ❌ NO                  |
| `testing-v2`                        | `testing-v2.md`                        | `13-testing.md`                | ❌ NO                  |

**Resultado:** Solo 4 nodos coinciden (26.67%)

---

## 7. Por Qué el Script No Encuentra los Archivos

### Problema 1: Nombres No Coinciden

El script busca archivos en formato `XX-${nodeName}.md`, pero:

- Busca: `XX-roasting-engine.md`
- Archivo real: `06-motor-roasting.md`
- Extrae: `motor-roasting`
- Compara: `motor-roasting` vs `roasting-engine`
- **No coinciden** → No encuentra el archivo

### Problema 2: El Script NO Usa el Campo `docs:`

El `system-map-v2.yaml` especifica explícitamente qué archivo usar en el campo `docs:`, pero el script NO lo utiliza:

```yaml
roasting-engine:
  docs:
    - docs/nodes-v2/roasting-engine.md # ← Este campo existe pero el script lo ignora
```

El script solo pasa `nodeName` a `findNodeFile()`, no pasa `nodeData` que contiene el campo `docs:`.

---

## 8. Cambios desde el Commit 100/100

### Commits Relevantes

1. **7d21f1b7** (2025-12-07): Health score 100/100 reportado
2. **00ce3c52** (2025-12-07): Eliminado NODE_NAME_MAPPING estático
3. **Commits posteriores:** Solo cambios en workflows y scripts de validación, NO en el script de health v2

### Archivos Modificados desde 7d21f1b7

- `.github/workflows/gdd-validate.yml` - Cambios en workflow
- `scripts/validate-*.js` - Nuevos scripts de validación
- `scripts/detect-*.js` - Nuevos scripts de detección
- `.cursor/rules/*.mdc` - Nuevas reglas
- **NO se modificó `scripts/calculate-gdd-health-v2.js`**

---

## 9. Conclusión sobre la Regresión

**El health score de 100/100 en el commit 7d21f1b7 fue INCORRECTO o se generó de manera diferente.**

**Evidencia:**

1. El script NO ha cambiado
2. Los archivos NO han cambiado
3. El system-map NO ha cambiado
4. El script actual NO puede encontrar los archivos porque los nombres no coinciden
5. El script NO usa el campo `docs:` del system-map que especifica explícitamente qué archivo usar

**Hipótesis más probable:**

- El health score de 100/100 se generó cuando había un mapeo estático (NODE_NAME_MAPPING) que fue eliminado en el commit 00ce3c52
- O el health score se generó manualmente/incorrectamente
- O había archivos con nombres exactos que fueron eliminados/renombrados fuera del historial de git

**El health score actual de 30/100 es CORRECTO** según la lógica del script actual, que refleja que solo 4 de 15 nodos están siendo detectados.
