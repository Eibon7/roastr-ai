# Legacy IDs → v2 Mapping

**Generado:** 2025-12-09  
**Fuente:** `scripts/detect-legacy-ids.js`

---

## 📋 Mapeo Oficial Legacy → v2 (solo IDs existentes en system-map-v2)

| Legacy ID | v2 ID (oficial) | Tipo | Estado esperado tras migrar |
|-----------|-----------------|------|-----------------------------|
| `roast` | `roasting-engine` | Node | Dejar sin legacy |
| `shield` | `shield-engine` | Node | Dejar sin legacy |
| `billing` | `billing-integration` | Node | Dejar sin legacy |
| `social-platforms` | `integraciones-redes-sociales` | Node | Dejar sin legacy |
| `frontend-dashboard` | `frontend-admin` | Node | Dejar sin legacy |
| `observability` | `observabilidad` | Node | Dejar sin legacy |

## Legacy sin equivalente v2 (señalados, no mapear)

| Legacy ID | Motivo |
|-----------|--------|
| `plan-features` | No existe nodo/subnodo v2 explícito; revisar plan-limits en billing-integration. |
| `persona` | No hay node ID dedicado; persona se gestiona en `analysis-engine`/SSOT; requiere decisión. |
| `cost-control` | No hay ID v2 de nodo; cost-control es subárea en billing-integration (plan-limits/cost tracking). |
| `queue-system` | No hay ID v2; usar infraestructura/queue-management cuando exista definición formal. |
| `multi-tenant` | No hay ID v2; multi-tenancy es parte de infraestructura; requiere definición. |
| `analytics` | No hay node v2; analytics es subnodo de observabilidad, no ID propio. |
| `trainer` | No existe en system-map-v2/SSOT. |
| `guardian` | Deprecated, prohibido. |

---

## 🎯 Acciones Requeridas

### 1. System Map v2

**Nodo legacy detectado:**
- `billing` → Migrar a `billing-integration`

**Referencias en depends_on (7):**
- `roasting-engine` → `billing` → `billing-integration`
- `analysis-engine` → `billing` → `billing-integration`
- `shield-engine` → `billing` → `billing-integration`
- `integraciones-redes-sociales` → `billing` → `billing-integration`
- `observabilidad` → `billing` → `billing-integration`
- `frontend-user-app` → `billing` → `billing-integration`
- `frontend-admin` → `billing` → `billing-integration`

### 2. Código (src/)

**⚠️ NO MODIFICAR** según instrucciones:
- 43 referencias a `roast` → `roast-generation`
- 10 referencias a `shield` → `shield-moderation`
- 4 referencias a `billing` → `billing-integration`
- 1 referencia a `analytics` → `analytics-dashboard`
- 1 referencia a `persona` → `persona-config`

**Acción:** Documentar para migración futura, NO modificar ahora.

### 3. Documentos v2

**Archivos en `docs/nodes-v2/` a revisar:**
- Verificar si usan IDs legacy en contenido
- Si es histórico → mover a `/docs/legacy/`
- Si es vigente → actualizar IDs

---

## 📝 Notas

- Los IDs legacy en código NO se modifican en esta fase (instrucción explícita)
- Solo se migran IDs en system-map-v2.yaml y documentos v2
- El mapeo se usa para validación y migración futura

---

**Última actualización:** 2025-12-09

