# ROA-308 — SSOT Strict Governance Rule Implementation

**Issue:** ROA-308  
**Status:** ✅ Implemented  
**Date:** 2025-12-05  
**Version:** SSOT Strict Governance v3.0

---

## Objetivo

Implementar SSOT Strict Governance Rule v3 para garantizar que todo el trabajo en el repositorio respete estrictamente SSOT v2, Spec v2, System Map v2 y Nodos GDD v2.

---

## Fuentes Autorizadas

Esta implementación se basa exclusivamente en:

- **SSOT v2:** `docs/SSOT/roastr-ssot-v2.md`
- **Spec v2:** `docs/spec/roastr-spec-v2.md`
- **System Map v2:** `docs/system-map-v2.yaml`
- **Nodos v2:** `docs/nodes-v2/*.md`

---

## Componentes Implementados

### 1. Scripts CI de Validación

#### 1.1 `scripts/ci/validate-ssot-compliance.js`

**Fuentes:**
- `docs/SSOT/roastr-ssot-v2.md` (líneas 5-10, 39-46, 95-96, 208-232, 646-658)
- `docs/nodes-v2/15-ssot-integration.md` (línea 138)

**Funcionalidad:**
- Valida que código cumple reglas SSOT v2
- Detecta planes legacy v1
- Detecta referencias a Stripe
- Verifica feature flags autorizados

#### 1.2 `scripts/ci/detect-legacy-v1.js`

**Fuentes:**
- `docs/SSOT/roastr-ssot-v2.md` (líneas 39-46, 95-96)
- `docs/nodes-v2/15-ssot-integration.md` (líneas 78-80)

**Funcionalidad:**
- Detecta referencias a planes legacy (`free`, `basic`, `creator_plus`)
- Detecta referencias a Stripe
- Solo verifica archivos en `apps/backend-v2/`

#### 1.3 `scripts/ci/detect-hardcoded-values.js`

**Fuentes:**
- `docs/nodes-v2/15-ssot-integration.md` (línea 132)
- `docs/spec/roastr-spec-v2.md` (líneas 151-160)

**Funcionalidad:**
- Detecta valores hardcoded que deberían venir de SSOT
- Verifica planes, feature flags, thresholds, weights
- Excluye settings loaders (permitidos)

#### 1.4 `scripts/ci/validate-feature-flags.js`

**Fuentes:**
- `docs/SSOT/roastr-ssot-v2.md` (líneas 208-236)

**Funcionalidad:**
- Valida que solo se usen feature flags autorizados
- Lista de 15 flags autorizados del SSOT
- Rechaza flags no autorizados

#### 1.5 `scripts/ci/validate-hexagonal-architecture.js`

**Fuentes:**
- `docs/spec/roastr-spec-v2.md` (líneas 600-637)

**Funcionalidad:**
- Valida arquitectura hexagonal en capa de dominio (`/services/`)
- Detecta violaciones: HTTP calls, DB directa, Express, workers, serialización
- Solo verifica archivos en `apps/backend-v2/src/services/`

#### 1.6 `scripts/ci/validate-system-map-dependencies.js`

**Fuentes:**
- `docs/system-map-v2.yaml`

**Funcionalidad:**
- Valida simetría de dependencias (`depends_on` ↔ `required_by`)
- Verifica que todos los nodos referenciados existan
- Valida bidireccionalidad de relaciones

### 2. Workflow CI

#### 2.1 `.github/workflows/ssot-governance-validation.yml`

**Fuentes:**
- `docs/nodes-v2/15-ssot-integration.md` (líneas 136-141)

**Funcionalidad:**
- Ejecuta todos los validadores SSOT en CI
- Se activa en PRs que modifican `apps/backend-v2/**`, `docs/SSOT/**`, `docs/spec/**`, etc.
- Todos los jobs son bloqueantes (`continue-on-error: false`)

**Jobs:**
1. `validate-ssot-compliance` - Validación general SSOT
2. `detect-legacy-v1` - Detección de legacy v1
3. `detect-hardcoded-values` - Detección de valores hardcoded
4. `validate-feature-flags` - Validación de feature flags
5. `validate-hexagonal-architecture` - Validación de arquitectura
6. `validate-system-map-dependencies` - Validación de dependencias
7. `all-validations` - Job final que requiere todos los anteriores

### 3. Regla Cursor

#### 3.1 `.cursor/rules/ssot-strict-governance.mdc`

**Estado:** ✅ Ya instalada (v3.0)

**Fuentes:**
- Regla definida por usuario en ROA-308
- Basada en SSOT v2, Spec v2, System Map v2, Nodos v2

**Funcionalidad:**
- Define fuentes permitidas
- Establece prohibiciones absolutas
- Define jerarquía de precedencia
- Establece condiciones de STOP
- Define regla anti-heurísticas

---

## Checklist de Implementación

### Scripts CI
- [x] `scripts/ci/validate-ssot-compliance.js` creado
- [x] `scripts/ci/detect-legacy-v1.js` creado
- [x] `scripts/ci/detect-hardcoded-values.js` creado
- [x] `scripts/ci/validate-feature-flags.js` creado
- [x] `scripts/ci/validate-hexagonal-architecture.js` creado
- [x] `scripts/ci/validate-system-map-dependencies.js` creado

### Workflow CI
- [x] `.github/workflows/ssot-governance-validation.yml` creado
- [x] Todos los jobs configurados como bloqueantes
- [x] Triggers configurados correctamente

### Documentación
- [x] `docs/plan/roa-308-ssot-governance-implementation.md` creado

### Regla Cursor
- [x] `.cursor/rules/ssot-strict-governance.mdc` verificado (ya existía v3.0)

---

## Validadores Implementados

### Bloqueantes (7)

1. **SSOT Compliance Validator** - Valida cumplimiento general SSOT
2. **Legacy v1 Detector** - Detecta referencias legacy
3. **Hardcoded Values Detector** - Detecta valores hardcoded
4. **Feature Flags Validator** - Valida feature flags autorizados
5. **Hexagonal Architecture Validator** - Valida arquitectura hexagonal
6. **System Map Dependencies Validator** - Valida dependencias system-map
7. **Evidence Validator** - (Ya existente en pre-merge-validation.yml)

### Warnings (1)

1. **AI-Slop Detector** - (Implementado en regla Cursor, no en CI)

---

## Restricciones Cursor Implementadas

Todas las restricciones están definidas en `.cursor/rules/ssot-strict-governance.mdc`:

1. ✅ Detección de extensiones propuestas
2. ✅ Detección de violaciones SSOT
3. ✅ Verificación de fuentes obligatorias
4. ✅ Aplicación de jerarquía de precedencia
5. ✅ Aplicación de regla anti-heurísticas

---

## Trazabilidad

Cada componente implementado está trazado a sus fuentes:

- **Scripts CI:** Basados en SSOT v2, Spec v2, System Map v2, Nodos v2
- **Workflow CI:** Basado en `docs/nodes-v2/15-ssot-integration.md:136-141`
- **Regla Cursor:** Basada en SSOT Strict Governance v3.0 (definida por usuario)

---

## Próximos Pasos

1. ✅ Validar que todos los scripts son ejecutables
2. ✅ Verificar que el workflow CI se activa correctamente
3. ⏳ Probar validadores en PR de prueba
4. ⏳ Documentar uso de validadores para desarrolladores

---

## Notas

- Todos los scripts son ejecutables (`#!/usr/bin/env node`)
- Todos los scripts tienen documentación de fuentes
- El workflow CI usa Node.js 20 y npm ci
- Los validadores solo verifican `apps/backend-v2/**` (código v2)
- Los settings loaders están excluidos de validación de hardcoded values

---

**Última actualización:** 2025-12-05  
**Implementado por:** FASE 3 de ROA-308  
**Estado:** ✅ Completo

