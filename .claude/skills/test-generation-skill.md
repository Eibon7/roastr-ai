---

name: test-generation-skill
description: Genera y valida tests unitarios, de integración y E2E con cobertura completa.
triggers:

- "sin tests"
- "test fail"
- "añadir tests"
- "coverage"
  used_by:
- front-end-dev
- back-end-dev
- test-engineer
  steps:
- paso1: "Analizar archivos modificados en src/ para identificar componentes/servicios nuevos o modificados"
- paso2: "Generar tests unitarios usando Jest con mocks apropiados (sin datos reales)"
- paso3: "Generar tests de integración para flujos clave (auth, API, workers)"
- paso4: "Generar tests E2E con Playwright para UI cuando aplique"
- paso5: "Ejecutar npm test -- --coverage para validar cobertura"
- paso6: "Verificar que Coverage Source es 'auto' en nodos GDD afectados"
- paso7: "Asegurar cobertura >= 85% y 0 tests fallando"
- paso8: "Generar reporte en docs/test-evidence/issue-{id}/summary.md con resultados"
  output: |
- Tests generados en tests/unit/, tests/integration/, tests/e2e/
- Reporte de cobertura: coverage/coverage-summary.json
- Evidencias visuales: docs/test-evidence/issue-{id}/screenshots/
- Resumen: docs/test-evidence/issue-{id}/summary.md
  examples:
- contexto: "Se añadió un nuevo endpoint POST /api/roastr/persona"
  accion: "Generar tests para validar creación, actualización y borrado de persona"
  output_esperado: "tests/unit/routes/roastr-persona.test.js + tests/integration/persona-flow.test.js"
- contexto: "Se creó nuevo componente UserProfile.jsx"
  accion: "Generar tests unitarios + E2E visual con Playwright"
  output_esperado: "tests/unit/components/UserProfile.test.jsx + tests/e2e/profile-page.test.js + screenshots"
  rules:
- NUNCA usar datos reales (siempre mock data)
- Seguir patrones de tests existentes en tests/
- Cada archivo de producción debe tener su contraparte de test
- Tests deben ser aislados, reproducibles y auto-contenidos
- Usar nomenclatura descriptiva (test describe el comportamiento esperado)
  references:
- "docs/TESTING.md - Guía completa de testing"
- "docs/GDD-PHASE-15.1.md - Coverage authenticity"
- "CLAUDE.md - Commit sin tests prohibido"
