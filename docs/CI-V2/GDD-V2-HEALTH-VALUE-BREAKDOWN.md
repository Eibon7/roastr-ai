# GDD v2 Health Score - Value Breakdown

**Fecha:** 2025-12-08  
**Health Score:** 30/100

---

## 1. Métricas Individuales

### 1.1 System Map Alignment Score: 26.67%

**Cálculo:**
```
system_map_alignment_score = (nodesInSystemMapThatExist / nodesInSystemMap.length) * 100
                            = (4 / 15) * 100
                            = 26.67%
```

**Detalle:**
- Nodos definidos en system-map-v2.yaml: **15**
- Nodos encontrados en docs/nodes-v2/: **4**
- Nodos faltantes: **11**

**Nodos encontrados:**
1. `billing` → `billing.md` ✅
2. `infraestructura` → `14-infraestructura.md` ✅
3. `ssot-integration` → `15-ssot-integration.md` ✅
4. `workers` → `08-workers.md` ✅

**Nodos faltantes (orphan_nodes):**
1. `roasting-engine`
2. `analysis-engine`
3. `shield-engine`
4. `integraciones-redes-sociales`
5. `observabilidad`
6. `frontend-user-app`
7. `frontend-admin`
8. `auth`
9. `settings-loader-and-feature-flags`
10. `gdpr-and-legal`
11. `testing-v2`

---

### 1.2 Dependency Density Score: 30%

**Cálculo:**
```
dependency_density_score = min(100, (actualDependencies / expectedDependencies) * 100)
```

**Detalle:**
- Dependencias esperadas (según system-map-v2.yaml): **X** (calculado desde `depends_on` de cada nodo)
- Dependencias detectadas (en archivos encontrados): **Y** (calculado desde sección Dependencies de cada archivo)
- Ratio: **30%**

**Problema:** Solo 4 nodos están siendo evaluados, por lo que la mayoría de dependencias no se detectan.

---

### 1.3 Crosslink Score: 10%

**Cálculo:**
```
crosslink_score = (correctCrosslinks / totalCrosslinks) * 100
```

**Detalle:**
- Crosslinks esperados (según system-map): **X** (todas las relaciones `depends_on`)
- Crosslinks correctos detectados: **Y** (referencias encontradas en archivos)
- Ratio: **10%**

**Problema:** Con solo 4 nodos detectados, la mayoría de crosslinks no se pueden validar.

---

### 1.4 SSOT Alignment Score: 20%

**Cálculo:**
```
ssot_alignment_score = (ssotAligned / nodesInSystemMap.length) * 100
                     = (3 / 15) * 100
                     = 20%
```

**Detalle:**
- Nodos alineados con SSOT: **3** (de los 4 encontrados)
- Nodos totales: **15**
- Ratio: **20%**

**Lógica de validación:**
- Si el nodo menciona SSOT → debe tener `ssot_references` en system-map
- Si el nodo dice "None" → no debe tener `ssot_references` en system-map
- Con solo 4 nodos evaluados, la mayoría no se puede validar

---

### 1.5 Narrative Consistency Score: 100%

**Cálculo:**
```
narrative_consistency_score = 100  // Placeholder - siempre 100%
```

**Nota:** Esta métrica es un placeholder y no se calcula realmente.

---

## 2. Health Score Final

**Fórmula:**
```javascript
health_score = 
  system_map_alignment_score * 0.3 +
  dependency_density_score * 0.2 +
  crosslink_score * 0.2 +
  ssot_alignment_score * 0.2 +
  narrative_consistency_score * 0.1
```

**Cálculo actual:**
```
health_score = 
  26.67 * 0.3 +
  30.0 * 0.2 +
  10.0 * 0.2 +
  20.0 * 0.2 +
  100.0 * 0.1

health_score = 
  8.001 +
  6.0 +
  2.0 +
  4.0 +
  10.0

health_score = 30.001 ≈ 30
```

---

## 3. Breakdown por Componente

| Métrica | Valor | Peso | Contribución | Estado |
|---------|-------|------|--------------|--------|
| System Map Alignment | 26.67% | 30% | 8.00 | 🔴 Crítico |
| Dependency Density | 30.00% | 20% | 6.00 | 🔴 Crítico |
| Crosslink Score | 10.00% | 20% | 2.00 | 🔴 Crítico |
| SSOT Alignment | 20.00% | 20% | 4.00 | 🔴 Crítico |
| Narrative Consistency | 100.00% | 10% | 10.00 | ✅ OK |
| **TOTAL** | - | 100% | **30.00** | 🔴 Crítico |

---

## 4. Número de Nodos y Dependencias

### Nodos Detectados: 4

1. `billing`
2. `infraestructura`
3. `ssot-integration`
4. `workers`

### Nodos Esperados: 15

Todos los nodos definidos en `docs/system-map-v2.yaml`.

### Dependencias Detectadas

Solo se pueden detectar dependencias de los 4 nodos encontrados. Las dependencias de los 11 nodos faltantes no se pueden evaluar.

### Crosslinks Detectados

Solo se pueden validar crosslinks entre los 4 nodos encontrados. Los crosslinks que involucran los 11 nodos faltantes no se pueden validar.

---

## 5. Métrica Más Baja

**Métrica más baja:** Crosslink Score (10%)

**Razón:** Con solo 4 nodos detectados, la mayoría de las relaciones de dependencia definidas en el system-map no se pueden validar porque los nodos fuente o destino no existen en la evaluación.

---

## 6. Conclusión

El health score de **30/100 es REAL y CORRECTO** según la lógica del script. El problema no es el cálculo, sino que:

1. **Solo 4 de 15 nodos están siendo detectados** (26.67%)
2. Esto causa que todas las métricas dependientes (dependencies, crosslinks, SSOT) se vean afectadas
3. El script está funcionando correctamente, pero no puede encontrar los archivos porque los nombres no coinciden

