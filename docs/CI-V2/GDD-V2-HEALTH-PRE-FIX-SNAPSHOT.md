# GDD v2 Health - Pre-Fix Snapshot

**Fecha:** 2025-12-08  
**Objetivo:** Capturar el estado actual antes de aplicar fixes definitivos

---

## 1. Health Score Actual

**Health Score Total:** 19.83/100

### Métricas Individuales

- **System Map Alignment:** 6.67%
- **SSOT Alignment:** 6.67%
- **Dependency Density:** 25.00%
- **Crosslink Score:** 7.50%
- **Narrative Consistency:** 100.00% (placeholder)

---

## 2. Nodos Detectados vs Missing

**Nodos detectados:** 1 de 15

- `billing` ✅

**Nodos missing:** 14 de 15

- `roasting-engine` ❌
- `analysis-engine` ❌
- `shield-engine` ❌
- `integraciones-redes-sociales` ❌
- `infraestructura` ❌
- `observabilidad` ❌
- `frontend-user-app` ❌
- `frontend-admin` ❌
- `ssot-integration` ❌
- `workers` ❌
- `auth` ❌
- `settings-loader-and-feature-flags` ❌
- `gdpr-and-legal` ❌
- `testing-v2` ❌

---

## 3. Estado de docs[] por Nodo en system-map-v2.yaml

| Node ID                             | docs[] según system-map                              | ¿Path existe? | Estado    |
| ----------------------------------- | ---------------------------------------------------- | ------------- | --------- |
| `roasting-engine`                   | `docs/nodes-v2/roasting-engine.md`                   | ❌ NO         | Missing   |
| `analysis-engine`                   | `docs/nodes-v2/analysis-engine.md`                   | ❌ NO         | Missing   |
| `shield-engine`                     | `docs/nodes-v2/shield-engine.md`                     | ❌ NO         | Missing   |
| `integraciones-redes-sociales`      | `docs/nodes-v2/integraciones-redes-sociales.md`      | ❌ NO         | Missing   |
| `billing`                           | `docs/nodes-v2/billing.md`                           | ✅ SÍ         | Detectado |
| `infraestructura`                   | `docs/nodes-v2/infraestructura.md`                   | ❌ NO         | Missing   |
| `observabilidad`                    | `docs/nodes-v2/observabilidad.md`                    | ❌ NO         | Missing   |
| `frontend-user-app`                 | `docs/nodes-v2/frontend-user-app.md`                 | ❌ NO         | Missing   |
| `frontend-admin`                    | `docs/nodes-v2/frontend-admin.md`                    | ❌ NO         | Missing   |
| `ssot-integration`                  | `docs/nodes-v2/ssot-integration.md`                  | ❌ NO         | Missing   |
| `workers`                           | `docs/nodes-v2/workers.md`                           | ❌ NO         | Missing   |
| `auth`                              | `docs/nodes-v2/auth.md`                              | ❌ NO         | Missing   |
| `settings-loader-and-feature-flags` | `docs/nodes-v2/settings-loader-and-feature-flags.md` | ❌ NO         | Missing   |
| `gdpr-and-legal`                    | `docs/nodes-v2/gdpr-and-legal.md`                    | ❌ NO         | Missing   |
| `testing-v2`                        | `docs/nodes-v2/testing-v2.md`                        | ❌ NO         | Missing   |

---

## 4. Archivos Reales en docs/nodes-v2/

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

**Total:** 16 archivos

---

## 5. Problema Identificado

**Causa raíz:** Los paths declarados en `system-map-v2.yaml` (campo `docs:`) no coinciden con los nombres reales de los archivos en `docs/nodes-v2/`.

**Ejemplo:**

- System-map declara: `docs/nodes-v2/roasting-engine.md`
- Archivo real: `docs/nodes-v2/06-motor-roasting.md`
- **No coinciden** → Nodo marcado como missing

**Solución requerida:** Alinear los paths en `system-map-v2.yaml` con los archivos reales existentes.

---

## 6. Próximos Pasos

1. Descubrir mapeo real entre node_ids y archivos existentes
2. Actualizar `docs/system-map-v2.yaml` con paths correctos
3. Verificar que el script de health v2 use exclusivamente `nodeData.docs[]`
4. Regenerar health score con paths correctos
5. Añadir validación de paths para prevenir futuros problemas
