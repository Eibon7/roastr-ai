# GDD v2 Health Score - Conclusión del Diagnóstico

**Fecha:** 2025-12-08  
**Health Score Actual:** 30/100  
**Health Score Esperado (post-ROA-258):** 100/100

---

## 1. ¿Es Realista que GDD v2 Esté en 30/100?

**❌ NO, no es realista.**

**Razón:** El health score de 30/100 refleja un **problema de detección/cálculo**, no un problema real del sistema.

**Evidencia:**

- Solo se están evaluando **4 nodos de 15** (26.67%)
- Los 11 nodos faltantes **SÍ existen** en `docs/nodes-v2/`, pero tienen nombres diferentes
- El script **NO puede encontrar los archivos** porque los nombres no coinciden
- El `system-map-v2.yaml` **especifica explícitamente** qué archivo usar en el campo `docs:`, pero el script **NO lo usa**

**Conclusión:** El health score de 30/100 es **técnicamente correcto** según la lógica del script actual, pero **no refleja la realidad** del sistema. El sistema tiene todos los nodos documentados, pero el script no los puede encontrar.

---

## 2. Breakdown por Métrica

### 2.1 System Map Alignment Score: 26.67%

**Valor:** 26.67%  
**Por qué:** Solo 4 de 15 nodos están siendo detectados.

**Cálculo:**

```
system_map_alignment_score = (4 / 15) * 100 = 26.67%
```

**Problema:** Los archivos existen, pero el script no los puede encontrar porque:

- Busca `roasting-engine.md` pero el archivo es `06-motor-roasting.md`
- Busca `analysis-engine.md` pero el archivo es `05-motor-analisis.md`
- Etc.

**Solución:** El script debe usar el campo `docs:` del system-map-v2.yaml.

---

### 2.2 SSOT Alignment Score: 20%

**Valor:** 20%  
**Por qué:** Solo se pueden validar 3 de los 4 nodos encontrados (y hay 15 nodos totales).

**Cálculo:**

```
ssot_alignment_score = (3 / 15) * 100 = 20%
```

**Problema:** Con solo 4 nodos evaluados, la mayoría de nodos no se pueden validar para SSOT alignment.

**Solución:** Una vez que se encuentren todos los nodos, esta métrica debería mejorar.

---

### 2.3 Dependency Density Score: 30%

**Valor:** 30%  
**Por qué:** Solo se pueden detectar dependencias de los 4 nodos encontrados.

**Cálculo:**

```
dependency_density_score = (actualDependencies / expectedDependencies) * 100
```

**Problema:** Con solo 4 nodos evaluados, la mayoría de dependencias no se pueden detectar.

**Solución:** Una vez que se encuentren todos los nodos, esta métrica debería mejorar.

---

### 2.4 Crosslink Score: 10%

**Valor:** 10%  
**Por qué:** Solo se pueden validar crosslinks entre los 4 nodos encontrados.

**Cálculo:**

```
crosslink_score = (correctCrosslinks / totalCrosslinks) * 100
```

**Problema:** Con solo 4 nodos evaluados, la mayoría de crosslinks no se pueden validar.

**Solución:** Una vez que se encuentren todos los nodos, esta métrica debería mejorar.

---

## 3. ¿Qué Cambió Exactamente desde el Commit 100/100?

### Análisis de Cambios

**Script `calculate-gdd-health-v2.js`:**

- ❌ **NO cambió** - Idéntico al commit 7d21f1b7

**Archivos en `docs/nodes-v2/`:**

- ❌ **NO cambiaron** - Mismos nombres que en el commit 7d21f1b7

**`docs/system-map-v2.yaml`:**

- ❌ **NO cambió** - Mismos nodos, mismos nombres, mismo campo `docs:`

### Conclusión sobre el Cambio

**NO ha habido cambios** en los archivos relevantes desde el commit 7d21f1b7.

**Hipótesis:** El health score de 100/100 en el commit 7d21f1b7 fue **INCORRECTO** o se generó de manera diferente (posiblemente con un mapeo estático que fue eliminado en el commit 00ce3c52).

---

## 4. ¿Qué Sospechas Concretas Tienes de Por Qué Ahora Da 30/100?

### Sospecha Principal: El Script NO Usa el Campo `docs:`

**Problema identificado:**

1. El `system-map-v2.yaml` especifica explícitamente qué archivo usar en el campo `docs:`:

   ```yaml
   roasting-engine:
     docs:
       - docs/nodes-v2/roasting-engine.md
   ```

2. El script **NO usa este campo**. Solo busca por nombre:

   ```javascript
   const filePath = findNodeFile(nodeName); // ← Solo pasa nodeName
   ```

3. La función `findNodeFile()` busca:
   - Primero: `roasting-engine.md` (no existe)
   - Luego: `XX-roasting-engine.md` (no existe, el archivo es `06-motor-roasting.md`)

4. El archivo real es `06-motor-roasting.md`, que extrae `motor-roasting`, que no coincide con `roasting-engine`.

**Solución:** El script debe usar `nodeData.docs[0]` del system-map para encontrar el archivo correcto.

---

### Sospecha Secundaria: El Health Score de 100/100 Fue Incorrecto

**Evidencia:**

- El commit `00ce3c52` dice "remove static NODE_NAME_MAPPING" - esto sugiere que antes había un mapeo estático
- El commit `00ce3c52` tiene health score 100/100 con 15 nodos detectados
- El script actual NO puede encontrar los archivos porque los nombres no coinciden
- El script NO ha cambiado desde el commit 7d21f1b7

**Hipótesis:** El health score de 100/100 se generó cuando había un mapeo estático (NODE_NAME_MAPPING) que fue eliminado, o se generó de manera incorrecta.

---

## 5. Resumen Ejecutivo

### Problema Identificado

**El script `calculate-gdd-health-v2.js` NO puede encontrar los archivos de nodos porque:**

1. Los nombres de los archivos no coinciden con los nombres de los nodos en el system-map
2. El script NO usa el campo `docs:` del system-map que especifica explícitamente qué archivo usar
3. La búsqueda por nombre numerado falla porque los nombres extraídos no coinciden

### Impacto

- **Solo 4 de 15 nodos están siendo evaluados** (26.67%)
- **Todas las métricas se ven afectadas** porque dependen de tener todos los nodos
- **El health score de 30/100 es técnicamente correcto** según la lógica del script, pero **no refleja la realidad** del sistema

### Solución Requerida

**El script debe usar el campo `docs:` del `system-map-v2.yaml` para encontrar los archivos correctos.**

En lugar de:

```javascript
const filePath = findNodeFile(nodeName);
```

Debería ser:

```javascript
const nodeData = systemMap.nodes[nodeName];
const docPath = nodeData.docs?.[0];
const filePath = docPath
  ? path.join(ROOT_DIR, docPath.replace('docs/nodes-v2/', ''))
  : findNodeFile(nodeName);
```

---

## 6. Archivos Generados

1. `docs/CI-V2/GDD-V2-HEALTH-DIAGNOSTIC-SOURCE.md` - Identificación del script y fuentes
2. `docs/CI-V2/GDD-V2-HEALTH-VALUE-BREAKDOWN.md` - Breakdown detallado de métricas
3. `docs/CI-V2/GDD-V2-HEALTH-REGRESSION-ANALYSIS.md` - Análisis de regresión
4. `docs/CI-V2/GDD-V2-HEALTH-SOURCES-VERIFICATION.md` - Verificación de fuentes
5. `docs/CI-V2/GDD-V2-HEALTH-CONCLUSION.md` - Este archivo (conclusión)

---

## 7. Próximos Pasos (NO implementar todavía)

1. **Modificar `findNodeFile()`** para usar el campo `docs:` del system-map
2. **Actualizar `loadNodesV2()`** para pasar `nodeData` a `findNodeFile()`
3. **Verificar que todos los 15 nodos se detecten correctamente**
4. **Re-ejecutar el script** y verificar que el health score vuelva a 100/100
5. **Validar que las métricas individuales estén en 100%**
