# Receipt - Cursor Orchestrator - ROA-516

**Agent:** Cursor Orchestrator  
**Date:** 2025-12-28  
**Issue:** ROA-516 — Fix GDD v2 Tooling Alignment (Validator + Health Gate)  
**Status:** ✅ IMPLEMENTED (tooling-only)

---

## 📋 Executive Summary

Aligned GDD v2 tooling to treat `docs/system-map-v2.yaml` as the single source of truth for node IDs and docs mapping. Removed v1 coupling (notably `spec.md` checks) from v2 validation/scoring paths, and added v2-specific non-regression tests to prevent filename-based node inference from reappearing.

---

## ✅ Work Completed

- **Validator alignment (v2)**:
  - Node IDs loaded from `system-map-v2.yaml` (no filename inference from `docs/nodes-v2/`)
  - Docs validity = all `nodes[*].docs` paths exist
  - `spec.md` ignored in v2 validation
  - Legacy-only references are warnings/ignored (never treated as missing v2 nodes)

- **Health scoring fix (v2)**:
  - Scoring excludes v1-only metrics (coverageEvidence, agentRelevance, spec sync)
  - `--ci` mode prints `Overall Health: X/100` and enforces threshold (default 87, env override)

- **Dependency hygiene**:
  - `resolve-graph.js` migrated from `js-yaml` to `yaml` (explicit dependency already present)

- **Safety / regression tests**:
  - Added tests to ensure:
    - IDs don’t need matching filenames
    - Legacy spec references can’t fail v2 validation
    - Missing `nodes[*].docs` paths do fail validation

---

## 🧪 Evidence

- `node scripts/validate-gdd-runtime.js --full` ✅
- `node scripts/score-gdd-health.js --ci` ✅
- `node scripts/resolve-graph.js --validate` ✅
- `npm test -- tests/unit/scripts/gdd-v2-tooling-alignment.test.js` ✅

---

## 🧹 Resumen Anti-Slop

✅ Código limpio, sin AI-slop detectado.

