---

name: gdd-sync-skill
description: Sincroniza nodos GDD tras cualquier cambio en código o arquitectura.
triggers:

- "GDD"
- "spec update"
- "nodo"
- "graph"
- "coverage"
  used_by:
- orchestrator
- test-engineer
- back-end-dev
- front-end-dev
  steps:
- paso1: "Detectar qué nodos en docs/nodes/ son afectados por cambios recientes"
- paso2: "Leer nodos relevantes para entender dependencias"
- paso3: "Identificar qué métricas necesitan actualización (coverage, health, dependencies)"
- paso4: "Ejecutar: node scripts/validate-gdd-runtime.js --full"
- paso5: "Actualizar cobertura en nodos afectados (Coverage Source: auto, NO manual)"
- paso6: "Ejecutar: node scripts/resolve-graph.js <nodos-afectados>"
- paso7: "Actualizar 'Agentes Relevantes' en nodos si aplica"
- paso8: "Validar: node scripts/score-gdd-health.js --ci (debe >=87)"
- paso9: "Ejecutar: node scripts/predict-gdd-drift.js --full (<60 risk)"
- paso10: "Generar reporte de sincronización"
  output: |
- Nodos actualizados: docs/nodes/{nodos-afectados}.md
- Reporte de validación: docs/gdd/validation-report-{id}.md
- Health score actualizado (debe ser >= 87)
- Drift risk (debe ser < 60)
- Lista de dependencias resueltas
  gdd_phases:
- FASE_0: "Assessment con GDD - Resolver nodos antes de empezar"
- FASE_4: "Actualizar 'Agentes Relevantes' en nodos"
- FASE_15.1: "Coverage Authenticity - SIEMPRE auto, NUNCA manual"
- FASE_15.3: "Documentation Integrity - Mantener tamaños"
  validacion:
- comandos_obligatorios:
  - "node scripts/resolve-graph.js <nodos>"
  - "node scripts/validate-gdd-runtime.js --full"
  - "node scripts/score-gdd-health.js --ci"
- thresholds:
  health: ">= 87"
  drift: "< 60"
  coverage: "Source: auto (NO manual)"
  reglas:
- "❌ NUNCA modificar cobertura manualmente en nodos"
- "❌ NUNCA cargar spec.md completo, solo nodos relevantes"
- "✅ SIEMPRE actualizar 'Agentes Relevantes' después de invocar agentes"
- "✅ SIEMPRE validar antes de commit"
- "✅ SIEMPRE mantener Coverage Source: auto"
  ejemplos:
- contexto: "Se añadió feature de Shield moderation"
  nodos_afectados:
  - "docs/nodes/shield.md"
  - "docs/nodes/moderacion.md"
    accion: |
  1. Resolver: node scripts/resolve-graph.js shield moderacion
  2. Actualizar cobertura en shield.md (Source: auto)
  3. Actualizar "Agentes Relevantes": test-engineer, guardian
  4. Validar: node scripts/validate-gdd-runtime.js --full
  5. Generar reporte
- contexto: "Cambios en workers"
  nodos_afectados: - "docs/nodes/queue.md" - "docs/nodes/workers.md"
  accion: | 1. Resolver nodos 2. Actualizar coverage desde coverage-summary.json (auto) 3. Actualizar dependencias entre workers 4. Validar health score
  coverage_authenticity:
- workflow: |
  1. npm test --coverage → genera coverage-summary.json
  2. auto-repair-gdd.js --auto-fix → actualiza nodos automáticamente
  3. Commit con valores reales
- prohibido: "Ajustar coverage manualmente en nodos"
- penalty: "-20 health points si se hace manual"
  health_management:
- principio: "❌ NUNCA ajustar thresholds sin investigación"
- workflow_ci_falla: | 1. Ver score-gdd-health.js --ci 2. Actualizar nodos con valores reales 3. Solo entonces ajustar threshold con justificación
  references:
- "docs/GDD-ACTIVATION-GUIDE.md"
- "docs/GDD-TELEMETRY.md"
- "docs/GDD-PHASE-15.md"
- "CLAUDE.md - GDD sections"
