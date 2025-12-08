# GDD v2 Health Report

**Fecha:** 2025-12-08  
**Versión:** 2.0  
**Health Score:** 19.83/100  
**Estado:** 🔴 CRÍTICO

---

## 📊 Resumen Ejecutivo

El Health Check v2 del GDD evalúa la coherencia entre:

- **Nodos reales** en `docs/nodes-v2/` (1 nodo detectado de 15 definidos)
- **System Map v2** en `docs/system-map-v2.yaml` (15 nodos definidos)
- **Alineación SSOT** con `docs/SSOT-V2.md`

**Estado General:** 🔴 **CRÍTICO** - Solo 1 de 15 nodos tiene documentación en los paths declarados en el system-map

---

## 📈 Puntuaciones Detalladas

| Métrica                   | Puntuación  | Peso | Contribución | Estado       |
| ------------------------- | ----------- | ---- | ------------ | ------------ |
| **System Map Alignment**  | 6.67%       | 30%  | 2.00         | 🔴 Crítico  |
| **Dependency Density**    | 25.00%      | 20%  | 5.00         | 🔴 Crítico  |
| **Crosslink Score**       | 7.50%       | 20%  | 1.50         | 🔴 Crítico  |
| **SSOT Alignment**        | 6.67%       | 20%  | 1.33         | 🔴 Crítico  |
| **Narrative Consistency** | 100.00%     | 10%  | 10.00        | ✅ Perfecto  |
| **HEALTH SCORE FINAL**    | **19.83/100** | -    | -            | 🔴 CRÍTICO |

**Cálculo:** (6.67 × 0.30) + (25.00 × 0.20) + (7.50 × 0.20) + (6.67 × 0.20) + (100.00 × 0.10) = 19.83

---

## 🔍 Análisis Detallado

### 1. System Map Alignment Score: 6.67%

**Definición:** % de nodos presentes en system-map-v2.yaml que existen realmente en docs/nodes-v2/ en los paths declarados

**Resultado:**

- Nodos en system-map-v2.yaml: **15**
- Nodos v2 reales encontrados: **1**
- Nodos faltantes: **14**

🔴 **Solo 1 nodo tiene documentación en el path declarado**

**Nodo detectado:**
- `billing` → `docs/nodes-v2/billing.md` ✅

**Nodos faltantes (paths declarados no existen):**
- `roasting-engine` → `docs/nodes-v2/roasting-engine.md` ❌
- `analysis-engine` → `docs/nodes-v2/analysis-engine.md` ❌
- `shield-engine` → `docs/nodes-v2/shield-engine.md` ❌
- `integraciones-redes-sociales` → `docs/nodes-v2/integraciones-redes-sociales.md` ❌
- `infraestructura` → `docs/nodes-v2/infraestructura.md` ❌
- `observabilidad` → `docs/nodes-v2/observabilidad.md` ❌
- `frontend-user-app` → `docs/nodes-v2/frontend-user-app.md` ❌
- `frontend-admin` → `docs/nodes-v2/frontend-admin.md` ❌
- `ssot-integration` → `docs/nodes-v2/ssot-integration.md` ❌
- `workers` → `docs/nodes-v2/workers.md` ❌
- `auth` → `docs/nodes-v2/auth.md` ❌
- `settings-loader-and-feature-flags` → `docs/nodes-v2/settings-loader-and-feature-flags.md` ❌
- `gdpr-and-legal` → `docs/nodes-v2/gdpr-and-legal.md` ❌
- `testing-v2` → `docs/nodes-v2/testing-v2.md` ❌

---

### 2. Dependency Density Score: 25.00%

**Definición:** Nº de referencias detectadas / nº esperado según system map

**Resultado:**

- Dependencias detectadas: Calculado desde el único nodo encontrado
- Dependencias esperadas: Calculado desde `depends_on` en system-map-v2.yaml
- Ratio: **25.00%**

🔴 **Baja densidad de dependencias** - Solo se pueden detectar dependencias del nodo `billing`

---

### 3. Crosslink Score: 7.50%

**Definición:** % de dependencias esperadas que están correctamente referenciadas

**Resultado:**

- Crosslinks correctos: Calculado desde el único nodo encontrado
- Crosslinks totales: Calculado desde `depends_on` en system-map-v2.yaml
- Ratio: **7.50%**

🔴 **Bajo crosslink score** - Solo se pueden validar crosslinks del nodo `billing`

---

### 4. SSOT Alignment Score: 6.67%

**Definición:** % de nodos que usan valores del SSOT correctamente

**Resultado:**

- Nodos alineados: 1 de 15
- Ratio: **6.67%**

🔴 **Baja alineación SSOT** - Solo se puede validar el nodo `billing`

---

### 5. Narrative Consistency Score: 100.00%

**Definición:** Evalúa si los nodos describen procesos compatibles entre sí

**Resultado:** **100.00%** (placeholder - requiere análisis más profundo)

---

## ⚠️ Warnings

1. Solo 1 nodos v2 reales de 15 definidos en system-map-v2.yaml
2. 14 nodos definidos en system-map-v2.yaml no tienen documentación en docs/nodes-v2/ en los paths declarados
3. Densidad de dependencias baja: 25.0%
4. Alineación SSOT incompleta: 6.7%

---

## 🔧 Cambios Aplicados

**Fix aplicado:** El script ahora usa **exclusivamente** los paths declarados en `nodeData.docs[]` del system-map-v2.yaml.

**Antes:**
- El script intentaba inferir nombres de archivos
- Buscaba archivos por nombre de nodo
- Usaba búsqueda por formato numerado como fallback

**Después:**
- El script usa EXACTAMENTE el path declarado en `nodeData.docs[0]`
- NO infiere nombres
- NO busca por nombre de nodo
- Si el path no existe → warn y marca como missing

**Resultado:** El health score refleja la realidad: los paths declarados en el system-map no coinciden con los archivos reales.

---

## 📝 Notas Técnicas

- **Script usado:** `scripts/calculate-gdd-health-v2.js`
- **Fuente de datos:** `docs/system-map-v2.yaml` (campo `docs:`)
- **Valores:** Todos calculados dinámicamente, sin hardcoding
- **Mapeos estáticos:** Ninguno
- **Inferencia:** Eliminada completamente

---

**Generated by:** GDD Health Check v2 Calculator  
**Last Updated:** 2025-12-08T15:47:35.622Z
