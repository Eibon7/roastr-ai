# ⚠️ DEPRECATED — LEGACY V1 (DO NOT MODIFY)

**Issue:** ROA-329  
**Fecha de Deprecación:** 2025-12-14  
**Estado:** ❌ DEPRECATED — Solo para referencia histórica

---

## 🚨 Política de Uso

**Los archivos en este directorio (`docs/legacy/v1/`) están DEPRECADOS y NO deben:**

- ❌ Ser modificados
- ❌ Ser usados por validadores activos
- ❌ Ser referenciados por CI/CD workflows
- ❌ Ser usados por agents o scripts de automatización
- ❌ Ser considerados como fuente de verdad

**Cualquier cambio debe hacerse en la versión v2 correspondiente.**

---

## 📋 Contenido Legacy

Este directorio contiene la documentación GDD v1 que fue deprecada y aislada:

- `system-map.yaml` → Reemplazado por `docs/system-map-v2.yaml`
- `nodes/*.md` (15 archivos) → Reemplazados por `docs/nodes-v2/**/*.md`

**Razón de deprecación:**
- GDD v2 introduce una estructura mejorada con subnodos
- System-map v2 tiene mejor gobernanza y validación
- Los scripts y validadores ahora usan exclusivamente v2

---

## 🔄 Guía de Migración

### System Map

**Legacy (v1):**
```
docs/system-map.yaml
```

**Actual (v2):**
```
docs/system-map-v2.yaml
```

**Migración:**
- Todos los scripts ahora usan `system-map-v2.yaml`
- Referencias a `system-map.yaml` deben actualizarse a `system-map-v2.yaml`

### Nodes

**Legacy (v1):**
```
docs/nodes/
├── analytics.md
├── billing.md
├── cost-control.md
├── guardian.md
├── multi-tenant.md
├── observability.md
├── persona.md
├── plan-features.md
├── platform-constraints.md
├── queue-system.md
├── roast.md
├── shield.md
├── social-platforms.md
├── tone.md
└── trainer.md
```

**Actual (v2):**
```
docs/nodes-v2/
├── 02-autenticacion-usuarios.md
├── 04-integraciones.md
├── 05-motor-analisis.md
├── 06-motor-roasting.md
├── 07-shield.md
├── 08-workers.md
├── 09-panel-usuario.md
├── 10-panel-administracion.md
├── 11-feature-flags.md
├── 12-gdpr-legal.md
├── 13-testing.md
├── 14-infraestructura.md
├── 15-ssot-integration.md
├── billing.md
└── observabilidad.md
```

**Migración:**
- Todos los scripts ahora usan `docs/nodes-v2/`
- La estructura v2 usa subnodos y frontmatter YAML
- Referencias a `docs/nodes/` deben actualizarse a `docs/nodes-v2/`

### SSOT (Single Source of Truth)

**Actual:**
```
docs/SSOT-V2.md
```

**Nota:** El SSOT v2 es la única fuente de verdad para valores y configuraciones.

---

## 🔍 Scripts Actualizados

Los siguientes scripts han sido actualizados para usar exclusivamente v2:

- ✅ `scripts/validate-gdd-runtime.js` → Usa `system-map-v2.yaml` y `docs/nodes-v2/`
- ✅ `scripts/resolve-graph.js` → Usa `system-map-v2.yaml`
- ✅ `scripts/gdd-coverage-helper.js` → Usa `system-map-v2.yaml` y `docs/nodes-v2/**`
- ✅ `scripts/score-gdd-health.js` → Usa `docs/nodes-v2/`
- ✅ `scripts/auto-repair-gdd.js` → Usa `system-map-v2.yaml` y `docs/nodes-v2/`
- ✅ `scripts/validate-gdd-cross.js` → Usa `docs/nodes-v2/`
- ✅ `scripts/watch-gdd.js` → Usa `docs/nodes-v2/` y `system-map-v2.yaml`
- ✅ `scripts/gdd-unlock.js` → Usa `system-map-v2.yaml` y `docs/nodes-v2/`
- ✅ `scripts/pre-flight-check.sh` → Usa `docs/nodes-v2/`

**Scripts Legacy (solo warnings):**
- ⚠️ `scripts/fix-mocked-coverage.js` → Añadidas advertencias de deprecación
- ⚠️ `scripts/sync-spec-md.js` → Actualizado a `nodes-v2/`

---

## ⚙️ Validadores

Todos los validadores GDD ahora:

- ✅ Ignoran explícitamente `docs/legacy/v1/**`
- ✅ Usan exclusivamente `docs/nodes-v2/` y `system-map-v2.yaml`
- ✅ No emiten warnings ni errores por archivos legacy

---

## 🚫 CI/CD Protection

El workflow `.github/workflows/gdd-validate.yml`:

- ✅ Excluye `docs/legacy/v1/**` de validaciones
- ✅ Emite warning o fail si un PR modifica archivos legacy
- ✅ Valida solo archivos v2 activos

---

## 📚 Referencias

- **Issue:** ROA-329
- **Plan de Implementación:** `docs/plan/issue-ROA-329.md`
- **SSOT v2:** `docs/SSOT-V2.md`
- **System Map v2:** `docs/system-map-v2.yaml`
- **Nodes v2:** `docs/nodes-v2/`

---

## ⚠️ Importante

**Si necesitas hacer cambios:**

1. ✅ Identifica el archivo v2 correspondiente en `docs/nodes-v2/`
2. ✅ Modifica SOLO el archivo v2
3. ❌ NO modifiques archivos en `docs/legacy/v1/`
4. ✅ Actualiza `system-map-v2.yaml` si es necesario

**Los archivos legacy se mantienen únicamente para referencia histórica.**

---

**Última actualización:** 2025-12-14  
**Mantenido por:** Documentation Agent (ROA-329)
