# Legacy IDs → v2 Mapping

**Generado:** 2025-12-09  
**Fuente:** `scripts/detect-legacy-ids.js`

---

## 📋 Mapeo Oficial Legacy → v2

| Legacy ID | v2 ID | Tipo | Estado |
|-----------|-------|------|--------|
| `roast` | `roast-generation` | Node | ⚠️ En código (43 refs) |
| `shield` | `shield-moderation` | Node | ⚠️ En código (10 refs) |
| `billing` | `billing-integration` | Node | ⚠️ En system-map + código |
| `analytics` | `analytics-dashboard` | Node | ⚠️ En código (1 ref) |
| `persona` | `persona-config` | Node | ⚠️ En código (1 ref) |
| `social-platforms` | `platform-integrations` | Node | ✅ Migrado |
| `frontend-dashboard` | `admin-dashboard` | Node | ✅ Migrado |
| `plan-features` | `plan-configuration` | Node | ✅ Migrado |
| `cost-control` | `cost-management` | Node | ✅ Migrado |
| `queue-system` | `queue-management` | Node | ✅ Migrado |
| `multi-tenant` | `tenant-management` | Node | ✅ Migrado |
| `observability` | `monitoring` | Node | ✅ Migrado |
| `trainer` | `model-training` | Node | ✅ Migrado |
| `guardian` | `null` (deprecated) | Node | ✅ Eliminado |

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

