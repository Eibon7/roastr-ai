# GDD v2 - Node Docs Discovery

**Fecha:** 2025-12-08  
**Objetivo:** Descubrir qué archivos en `docs/nodes-v2/` corresponden a cada `node_id` del system-map

---

## Mapeo Descubierto

### Nodos con Archivos Identificados

| Node ID | Archivo Real | Título del Archivo | Confianza |
|---------|--------------|-------------------|-----------|
| `roasting-engine` | `06-motor-roasting.md` | "GDD Node — Motor de Roasting v2" | ✅ Alta |
| `analysis-engine` | `05-motor-analisis.md` | "GDD Node — Motor de Análisis v2" | ✅ Alta |
| `shield-engine` | `07-shield.md` | "GDD Node — Shield (Sistema Antitrolls) v2" | ✅ Alta |
| `integraciones-redes-sociales` | `04-integraciones.md` | "GDD Node — Integraciones con Redes Sociales v2" | ✅ Alta |
| `billing` | `billing.md` | "GDD Node — Billing v2" | ✅ Alta (ya correcto) |
| `infraestructura` | `14-infraestructura.md` | "GDD Node — Infraestructura v2" | ✅ Alta |
| `frontend-user-app` | `09-panel-usuario.md` | "GDD Node — Panel de Usuario (Frontend v2)" | ✅ Alta |
| `frontend-admin` | `10-panel-administracion.md` | "GDD Node — Panel de Administración v2" | ✅ Alta |
| `ssot-integration` | `15-ssot-integration.md` | "GDD Node — SSOT Integration v2" | ✅ Alta |
| `workers` | `08-workers.md` | "GDD Node — Workers del Sistema v2" | ✅ Alta |
| `auth` | `02-autenticacion-usuarios.md` | "GDD Node — Autenticación y Gestión de Usuarios v2" | ✅ Alta |
| `settings-loader-and-feature-flags` | `11-feature-flags.md` | "GDD Node — Feature Flags v2" | ✅ Alta |
| `gdpr-and-legal` | `12-gdpr-legal.md` | "GDD Node — GDPR y Legal v2" | ✅ Alta |
| `testing-v2` | `13-testing.md` | "GDD Node — Testing v2" | ✅ Alta |

### Nodos con Dudas

| Node ID | Estado | Observaciones |
|---------|--------|---------------|
| `observabilidad` | ⚠️ NO ENCONTRADO | No hay archivo específico. Mencionado en `14-infraestructura.md` pero no tiene documento dedicado. |

### Archivos Sin Nodo Asociado

| Archivo | Observaciones |
|---------|---------------|
| `01-arquitectura-general.md` | "GDD Node — Arquitectura General del Sistema v2" - No corresponde a ningún node_id específico del system-map. Podría ser un documento general. |
| `03-billing-polar.md` | "GDD Node — Sistema de Billing (Polar) v2" - Parece ser una variante de `billing.md`. Verificar si es necesario o duplicado. |

---

## Sugerencias de Actualización

### Para system-map-v2.yaml

**Actualizar `docs:` de cada nodo con el archivo real encontrado:**

```yaml
nodes:
  roasting-engine:
    docs:
      - docs/nodes-v2/06-motor-roasting.md
  analysis-engine:
    docs:
      - docs/nodes-v2/05-motor-analisis.md
  shield-engine:
    docs:
      - docs/nodes-v2/07-shield.md
  integraciones-redes-sociales:
    docs:
      - docs/nodes-v2/04-integraciones.md
  billing:
    docs:
      - docs/nodes-v2/billing.md  # Ya correcto
  infraestructura:
    docs:
      - docs/nodes-v2/14-infraestructura.md
  frontend-user-app:
    docs:
      - docs/nodes-v2/09-panel-usuario.md
  frontend-admin:
    docs:
      - docs/nodes-v2/10-panel-administracion.md
  ssot-integration:
    docs:
      - docs/nodes-v2/15-ssot-integration.md
  workers:
    docs:
      - docs/nodes-v2/08-workers.md
  auth:
    docs:
      - docs/nodes-v2/02-autenticacion-usuarios.md
  settings-loader-and-feature-flags:
    docs:
      - docs/nodes-v2/11-feature-flags.md
  gdpr-and-legal:
    docs:
      - docs/nodes-v2/12-gdpr-legal.md
  testing-v2:
    docs:
      - docs/nodes-v2/13-testing.md
  observabilidad:
    docs:
      # ⚠️ NO EXISTE - Requiere crear documento o asignar existente
      # Opción 1: Crear docs/nodes-v2/observabilidad.md
      # Opción 2: Si está cubierto en infraestructura.md, añadir ese path también
```

---

## Notas

1. **observabilidad**: No tiene archivo dedicado. Opciones:
   - Crear `docs/nodes-v2/observabilidad.md` nuevo
   - Si está cubierto en `14-infraestructura.md`, añadir ese path al nodo `observabilidad` también
   - Verificar si realmente necesita documento separado

2. **01-arquitectura-general.md**: No corresponde a ningún node_id. Podría ser:
   - Documento general (no asociado a nodo específico)
   - Requiere crear nodo en system-map si es necesario

3. **03-billing-polar.md**: Parece duplicado de `billing.md`. Verificar si:
   - Es necesario mantener ambos
   - Se puede consolidar
   - Uno es más específico que el otro

---

## Próximos Pasos

1. Actualizar `docs/system-map-v2.yaml` con los paths correctos
2. Decidir qué hacer con `observabilidad` (crear doc o usar existente)
3. Verificar `01-arquitectura-general.md` y `03-billing-polar.md`
4. Regenerar health score con paths correctos

