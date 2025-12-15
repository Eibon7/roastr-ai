# Plan de Implementación - ROA-354: Limpieza de Issues GitHub

**Issue:** ROA-354  
**Fecha:** 2025-12-09  
**Estado:** ✅ Completado  
**Tipo:** type:docs, type:analysis

---

## Objetivo

Marcar issues GDD relacionadas con legacy v1 con el label `legacy-v1` para facilitar su identificación y gestión.

---

## Análisis de Issues

### Issues Analizadas

1. **#1121** - [GDD] Validation Failed - PR #1120
   - PR: ROA-318: Limpieza estructural v2 (legacy removal + system-map alignment + DAG fix)
   - Archivos: `docs/legacy/`, `scripts/detect-legacy-ids.js`
   - **Decisión:** ✅ Marcada con `legacy-v1` (relacionada con legacy)

2. **#1117** - [GDD] Validation Failed - PR #1116
   - PR: feat: Add v2 optimized cursor rules and validation scripts (ROA-310)
   - Archivos: `scripts/detect-legacy-ids.js`, `scripts/shared/legacy-ids.js`
   - **Decisión:** ✅ Marcada con `legacy-v1` (scripts de detección de legacy)

3. **#1105** - [GDD] Validation Failed - PR #1104
   - PR: ROA-258: System Map v2 + SSOT Alignment + GDD Health 100/100
   - Archivos: No relacionados con legacy
   - **Decisión:** ❌ No marcada (no es legacy v1)

4. **#1102** - [GDD] Auto-Monitor Alert: Health Below Threshold
   - Tipo: Auto-monitor alert
   - **Decisión:** ❌ No marcada (no es legacy v1)

---

## Acciones Realizadas

### Labels

- ✅ Label `legacy-v1` verificado/creado
- ✅ Issue #1121 marcada con `legacy-v1`
- ✅ Issue #1117 marcada con `legacy-v1`

### Issues Reabiertas

- ✅ Todas las issues cerradas fueron reabiertas para mantener el estado original

---

## Resultado

**Issues marcadas con `legacy-v1`:**
- #1121
- #1117

**Issues NO marcadas (no son legacy v1):**
- #1105
- #1102

---

## Referencias

- Issues GDD: `gh issue list --label "gdd" --state open`
- Label legacy-v1: `gh label list | grep legacy-v1`
