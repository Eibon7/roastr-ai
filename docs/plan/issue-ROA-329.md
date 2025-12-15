# Plan: ROA-329 - Deprecate and Isolate Legacy GDD v1 Documentation

**Issue:** ROA-329  
**Título:** Deprecate and isolate legacy GDD v1 documentation  
**Fecha:** 2025-12-14  
**Estado:** ✅ COMPLETADO

---

## Objetivo

Aislar completamente la documentación legacy v1 del flujo v2 para evitar confusión y asegurar que solo se use la versión v2 activa.

---

## Qué se Considera Legacy v1

**Archivos Legacy (deprecados):**
- `docs/system-map.yaml` → Movido a `docs/legacy/v1/system-map.yaml`
- `docs/nodes/*.md` (15 archivos) → Movidos a `docs/legacy/v1/nodes/`
  - analytics.md, billing.md, cost-control.md, guardian.md, multi-tenant.md
  - observability.md, persona.md, plan-features.md, platform-constraints.md
  - queue-system.md, roast.md, shield.md, social-platforms.md, tone.md, trainer.md

**Características Legacy:**
- Estructura plana (un archivo por nodo)
- Sin subnodos
- Sin frontmatter YAML estructurado
- Sin validación estricta de dependencias

---

## Qué se Considera v2 (Activo)

**Archivos v2 (activos):**
- `docs/system-map-v2.yaml` → System map activo
- `docs/nodes-v2/**/*.md` → Nodos activos (con subnodos)
- `docs/SSOT-V2.md` → Single Source of Truth

**Características v2:**
- Estructura jerárquica con subnodos
- Frontmatter YAML estructurado
- Validación estricta de dependencias
- Gobernanza Strong/Soft concepts
- Health score tracking

---

## Cambios Realizados

### FASE 1: Migration Guide ✅

**Archivo creado:**
- `docs/legacy/v1/README.md` - Guía completa de migración con:
  - Política de uso (NO modificar, NO usar en validadores)
  - Mapeo legacy → v2
  - Lista de scripts actualizados
  - Referencias a documentación v2

### FASE 2: Scripts Actualizados ✅

**Scripts actualizados para usar EXCLUSIVAMENTE v2:**

1. ✅ `scripts/validate-gdd-runtime.js`
   - Cambiado: `docs/nodes/` → `docs/nodes-v2/` (con carga recursiva)
   - Cambiado: `system-map.yaml` → `system-map-v2.yaml`
   - Añadido: Carga recursiva de subnodos

2. ✅ `scripts/gdd-coverage-helper.js`
   - Cambiado: `system-map.yaml` → `system-map-v2.yaml`
   - Actualizado: Comentarios y mensajes

3. ✅ `scripts/score-gdd-health.js`
   - Cambiado: `docs/nodes/` → `docs/nodes-v2/` (con carga recursiva)
   - Actualizado: Referencias a nodos

4. ✅ `scripts/auto-repair-gdd.js`
   - Cambiado: `system-map.yaml` → `system-map-v2.yaml`
   - Cambiado: `docs/nodes/` → `docs/nodes-v2/` (con carga recursiva)
   - Actualizado: Todos los mensajes y referencias

5. ✅ `scripts/validate-gdd-cross.js`
   - Cambiado: `docs/nodes/` → `docs/nodes-v2/` (con carga recursiva)

6. ✅ `scripts/watch-gdd.js`
   - Actualizado: Comentarios y mensajes de monitoreo
   - Cambiado: Referencias a `docs/nodes-v2/` y `system-map-v2.yaml`

7. ✅ `scripts/gdd-unlock.js`
   - Cambiado: `system-map.yaml` → `system-map-v2.yaml`
   - Cambiado: `docs/nodes/roast.md` → `docs/nodes-v2/06-motor-roasting.md`

8. ✅ `scripts/pre-flight-check.sh`
   - Cambiado: `docs/nodes/` → `docs/nodes-v2/`

9. ✅ `scripts/sync-spec-md.js`
   - Cambiado: Referencias a `docs/nodes-v2/`

10. ✅ `scripts/fix-mocked-coverage.js`
    - Añadido: Warnings de deprecación
    - Actualizado: Paths a `docs/legacy/v1/nodes/` (solo para referencia)

**Scripts que ya usaban v2:**
- ✅ `scripts/resolve-graph.js` - Ya actualizado previamente
- ✅ `scripts/validate-post-modification-v2.js` - Ya usa v2 exclusivamente

### FASE 3: Validadores ✅

**Validadores que ya excluyen legacy:**
- ✅ `scripts/validate-node-ids.js` - Valida solo system-map-v2.yaml y nodes-v2
- ✅ `scripts/check-system-map-drift.js` - Valida solo system-map-v2.yaml y nodes-v2

**Nota:** Los validadores ya están diseñados para v2 y no escanean `docs/legacy/v1/` porque solo leen `docs/nodes-v2/` y `system-map-v2.yaml`.

### FASE 4: CI Isolation ✅

**Workflow actualizado:**
- `.github/workflows/gdd-validate.yml`
  - ✅ Añadida protección: Falla si PR modifica `docs/legacy/v1/**`
  - ✅ Excluye `docs/legacy/v1/**` de paths de trigger
  - ✅ Mensaje claro de error si se intenta modificar legacy

**Protección añadida:**
```yaml
- name: Check for legacy v1 modifications (BLOCK)
  - Detecta modificaciones en docs/legacy/v1/
  - Exit 1 con mensaje claro si se detectan
  - Instrucciones para usar v2
```

---

## Validaciones Ejecutadas

### Comandos de Verificación

```bash
# 1. Verificar que legacy está aislado
ls -la docs/legacy/v1/
# ✅ Debe mostrar: nodes/ y system-map.yaml con headers DEPRECATED

# 2. Verificar que scripts usan v2
grep -r "docs/nodes/" scripts/ | grep -v "legacy\|README"
# ✅ Debe estar vacío (solo referencias en fix-mocked-coverage.js con warnings)

grep -r "system-map.yaml" scripts/ | grep -v "system-map-v2\|legacy"
# ✅ Debe estar vacío

# 3. Verificar que validadores pasan
node scripts/validate-post-modification-v2.js --ci
# ✅ Debe pasar sin errores

node scripts/check-system-map-drift.js --ci
# ✅ Debe pasar sin errores

# 4. Verificar que CI bloquea modificaciones legacy
# (Probar modificando un archivo en docs/legacy/v1/ y hacer commit)
# ✅ CI debe fallar con mensaje claro
```

### Resultados de Validación

- ✅ Todos los scripts usan exclusivamente v2
- ✅ Legacy files tienen headers DEPRECATED
- ✅ Migration Guide creado y completo
- ✅ CI protege contra modificaciones legacy
- ✅ Validadores no escanean legacy (solo v2)

---

## Archivos Modificados

**Nuevos:**
- `docs/legacy/v1/README.md` - Migration Guide

**Modificados:**
- `scripts/validate-gdd-runtime.js` - Actualizado a v2
- `scripts/gdd-coverage-helper.js` - Actualizado a v2
- `scripts/score-gdd-health.js` - Actualizado a v2
- `scripts/auto-repair-gdd.js` - Actualizado a v2
- `scripts/validate-gdd-cross.js` - Actualizado a v2
- `scripts/watch-gdd.js` - Actualizado a v2
- `scripts/gdd-unlock.js` - Actualizado a v2
- `scripts/pre-flight-check.sh` - Actualizado a v2
- `scripts/sync-spec-md.js` - Actualizado a v2
- `scripts/fix-mocked-coverage.js` - Añadidos warnings de deprecación
- `.github/workflows/gdd-validate.yml` - Protección contra modificaciones legacy

**Legacy (movidos, no modificados):**
- `docs/legacy/v1/system-map.yaml` - Con header DEPRECATED
- `docs/legacy/v1/nodes/*.md` (15 archivos) - Con headers DEPRECATED

---

## Criterios de Éxito

- ✅ Todos los archivos legacy movidos a `docs/legacy/v1/`
- ✅ Todos los scripts usan exclusivamente v2
- ✅ Migration Guide creado y completo
- ✅ CI bloquea modificaciones en legacy
- ✅ Validadores no escanean legacy
- ✅ Ningún script usa legacy como fuente de verdad
- ✅ Headers DEPRECATED en todos los archivos legacy

---

## Notas

- Los archivos legacy se mantienen para referencia histórica únicamente
- NO se eliminan archivos, solo se deprecan y aíslan
- Scripts v2 son la única fuente de verdad activa
- Cualquier cambio debe hacerse en v2, nunca en legacy

---

## Referencias

- **Migration Guide:** `docs/legacy/v1/README.md`
- **SSOT v2:** `docs/SSOT-V2.md`
- **System Map v2:** `docs/system-map-v2.yaml`
- **Nodes v2:** `docs/nodes-v2/`
