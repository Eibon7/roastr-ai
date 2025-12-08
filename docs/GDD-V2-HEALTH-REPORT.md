# GDD v2 Health Report

**Fecha:** 2025-12-08  
**Versión:** 2.0  
**Health Score:** 71.83/100  
**Estado:** 🟡 DEGRADED

---

## 📊 Resumen Ejecutivo

El Health Check v2 del GDD evalúa la coherencia entre:

- **Nodos reales** en `docs/nodes-v2/` (14 nodos detectados de 15 definidos)
- **System Map v2** en `docs/system-map-v2.yaml` (15 nodos definidos)
- **Alineación SSOT** con `docs/SSOT-V2.md`

**Estado General:** 🟡 **DEGRADED** - 14 de 15 nodos tienen documentación en los paths declarados. Falta `observabilidad.md`.

---

## 📈 Puntuaciones Detalladas

| Métrica                   | Puntuación  | Peso | Contribución | Estado       |
| ------------------------- | ----------- | ---- | ------------ | ------------ |
| **System Map Alignment**  | 93.33%      | 30%  | 28.00        | 🟡 Degradado |
| **Dependency Density**    | 72.50%      | 20%  | 14.50        | 🟡 Degradado |
| **Crosslink Score**       | 30.00%      | 20%  | 6.00         | 🔴 Crítico   |
| **SSOT Alignment**        | 66.67%      | 20%  | 13.33        | 🟡 Degradado |
| **Narrative Consistency** | 100.00%     | 10%  | 10.00        | ✅ Perfecto   |
| **HEALTH SCORE FINAL**    | **71.83/100** | -    | -            | 🟡 DEGRADED |

**Cálculo:** (93.33 × 0.30) + (72.50 × 0.20) + (30.00 × 0.20) + (66.67 × 0.20) + (100.00 × 0.10) = 71.83

**Nota:** Narrative Consistency es un placeholder (100%) - aún no implementado completamente.

---

## 🔍 Análisis Detallado

### 1. System Map Alignment Score: 93.33%

**Definición:** % de nodos presentes en system-map-v2.yaml que existen realmente en docs/nodes-v2/ en los paths declarados

**Resultado:**

- Nodos en system-map-v2.yaml: **15**
- Nodos v2 reales encontrados: **14**
- Nodos faltantes: **1**

🟡 **14 de 15 nodos tienen documentación en los paths declarados**

**Nodo faltante:**
- `observabilidad` → `docs/nodes-v2/observabilidad.md` ❌ (archivo no existe)

**Nodos detectados (14):**
- `roasting-engine` → `docs/nodes-v2/06-motor-roasting.md` ✅
- `analysis-engine` → `docs/nodes-v2/05-motor-analisis.md` ✅
- `shield-engine` → `docs/nodes-v2/07-shield.md` ✅
- `integraciones-redes-sociales` → `docs/nodes-v2/04-integraciones.md` ✅
- `billing` → `docs/nodes-v2/billing.md` ✅
- `infraestructura` → `docs/nodes-v2/14-infraestructura.md` ✅
- `frontend-user-app` → `docs/nodes-v2/09-panel-usuario.md` ✅
- `frontend-admin` → `docs/nodes-v2/10-panel-administracion.md` ✅
- `ssot-integration` → `docs/nodes-v2/15-ssot-integration.md` ✅
- `workers` → `docs/nodes-v2/08-workers.md` ✅
- `auth` → `docs/nodes-v2/02-autenticacion-usuarios.md` ✅
- `settings-loader-and-feature-flags` → `docs/nodes-v2/11-feature-flags.md` ✅
- `gdpr-and-legal` → `docs/nodes-v2/12-gdpr-legal.md` ✅
- `testing-v2` → `docs/nodes-v2/13-testing.md` ✅

---

### 2. Dependency Density Score: 72.50%

**Definición:** Nº de referencias detectadas / nº esperado según system map

**Resultado:**

- Dependencias detectadas: Calculado dinámicamente desde los 14 nodos encontrados
- Dependencias esperadas: Calculado desde `depends_on` en system-map-v2.yaml
- Ratio: **72.50%**

🟡 **Densidad de dependencias moderada** - La mayoría de dependencias están documentadas, pero algunas faltan

---

### 3. Crosslink Score: 30.00%

**Definición:** % de dependencias esperadas que están correctamente referenciadas

**Resultado:**

- Crosslinks correctos: Calculado desde los 14 nodos encontrados
- Crosslinks totales: Calculado desde `depends_on` en system-map-v2.yaml
- Ratio: **30.00%**

🔴 **Bajo crosslink score** - Muchas dependencias declaradas en el system-map no están referenciadas explícitamente en los documentos

**Causa probable:** Los documentos mencionan dependencias pero no siempre usan el formato exacto que el script detecta (links markdown, backticks, etc.)

---

### 4. SSOT Alignment Score: 66.67%

**Definición:** % de nodos que usan valores del SSOT correctamente

**Resultado:**

- Nodos alineados: 10 de 15
- Ratio: **66.67%**

🟡 **Alineación SSOT moderada** - La mayoría de nodos están alineados, pero algunos necesitan ajustes

---

### 5. Narrative Consistency Score: 100.00%

**Definición:** Evalúa si los nodos describen procesos compatibles entre sí

**Resultado:** **100.00%** (placeholder - requiere análisis más profundo)

**Nota:** Esta métrica es un placeholder. Requiere implementación completa de análisis semántico.

---

## ⚠️ Warnings

1. 1 nodos definidos en system-map-v2.yaml no tienen documentación en docs/nodes-v2/ en los paths declarados
   - `observabilidad` → Requiere crear `docs/nodes-v2/observabilidad.md`

2. Alineación SSOT incompleta: 66.7%
   - Algunos nodos necesitan ajustar referencias SSOT

---

## 🔧 Cambios Aplicados

**Fix aplicado:** El script ahora usa **exclusivamente** los paths declarados en `nodeData.docs[]` del system-map-v2.yaml.

**Antes:**
- El script intentaba inferir nombres de archivos
- Buscaba archivos por nombre de nodo
- Usaba búsqueda por formato numerado como fallback
- Solo encontraba 1 de 15 nodos

**Después:**
- El script usa EXACTAMENTE el path declarado en `nodeData.docs[0]`
- NO infiere nombres
- NO busca por nombre de nodo
- Si el path no existe → warn y marca como missing
- Encuentra 14 de 15 nodos (93.33%)

**System-map actualizado:**
- Todos los paths en `docs:` apuntan a archivos reales existentes
- Solo falta `observabilidad.md` (requiere crear documento)

---

## 📝 Notas Técnicas

- **Script usado:** `scripts/calculate-gdd-health-v2.js`
- **Fuente de datos:** `docs/system-map-v2.yaml` (campo `docs:`)
- **Valores:** Todos calculados dinámicamente, sin hardcoding
- **Mapeos estáticos:** Eliminados completamente
- **Inferencia:** Eliminada completamente
- **Validación de paths:** `scripts/validate-v2-doc-paths.js` disponible

---

## 🎯 Para Alcanzar 100/100

1. **Crear `docs/nodes-v2/observabilidad.md`** con la documentación del nodo `observabilidad`
2. **Mejorar crosslinks:** Asegurar que todas las dependencias declaradas en `depends_on` estén referenciadas explícitamente en los documentos (usando formato markdown link o backticks)
3. **Mejorar SSOT alignment:** Verificar que todos los nodos tengan referencias SSOT correctas según el system-map

---

**Generated by:** GDD Health Check v2 Calculator  
**Last Updated:** 2025-12-08T16:46:12.079Z
