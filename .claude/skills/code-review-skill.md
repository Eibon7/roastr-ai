---
name: code-review-skill
description: Aplica reglas de calidad y feedback de CodeRabbit en PRs antes de merge.
triggers:
  - "review"
  - "PR"
  - "feedback"
  - "CodeRabbit"
  - "quality"
used_by:
  - github-guardian
  - orchestrator
  - github-monitor
steps:
  - paso1: "Leer commits recientes y archivos modificados en el PR"
  - paso2: "Consultar docs/patterns/coderabbit-lessons.md para patrones conocidos"
  - paso3: "Analizar código contra checklist de docs/QUALITY-STANDARDS.md"
  - paso4: "Detectar patrones problemáticos que CodeRabbit reportaría"
  - paso5: "Verificar: console.logs, TODOs sin documentar, código duplicado"
  - paso6: "Validar cumplimiento de naming conventions en NAMING_CONVENTIONS.md"
  - paso7: "Revisar estructura y formato de código"
  - paso8: "Generar feedback estructurado con sugerencias específicas"
output: |
  - Comentarios sugeridos para el PR
  - Reporte de revisión: docs/review/issue-{id}.md
  - Lista de issues detectadas con prioridad (P0/P1/P2)
  - Checklist de correcciones necesarias antes de merge
examples:
  - contexto: "Detectados console.logs en código de producción"
    accion: "Sugerir usar logger.js y remover logs, luego ejecutar grep para verificar"
    feedback: "❌ P0: console.logs en línea 42, 58. Usar utils/logger.js. Remover antes de merge."
  - contexto: "Variables con nombres ambiguos"
    accion: "Sugerir renombrar siguiendo convenciones del proyecto"
    feedback: "⚠️ P2: Variable 'data' renombrar a 'userProfile' para claridad."
patrones_code_rabbit:
  - "console.log en lugar de logger"
  - "hardcoded strings sin constants"
  - "función demasiado larga (>50 líneas)"
  - "código duplicado sin abstraer"
  - "falta de error handling"
  - "variables con nombres no descriptivos"
  - "sin validación de inputs"
checklist_pre_merge:
  - [ ] 0 console.logs en código de producción
  - [ ] 0 TODOs sin documentar o resueltos
  - [ ] Naming conventions respetadas
  - [ ] Error handling presente
  - [ ] Input validation implementada
  - [ ] Código modular y DRY
  - [ ] Documentación actualizada (spec.md, nodos GDD)
  - [ ] Tests pasando al 100%
expected_code_rabbit_score: "0 comentarios"
rules:
  - Si CodeRabbit reporta algo → arreglar TODO antes de merge
  - Preferir prevenir que curar (mejor escribir código correcto que arreglar después)
  - Quality > Velocity (calidad > velocidad)
  - Código debe parecer escrito por la misma persona
references:
  - "docs/QUALITY-STANDARDS.md"
  - "docs/patterns/coderabbit-lessons.md"
  - "NAMING_CONVENTIONS.md"
  - "CLAUDE.md - Quality Standards (CRÍTICO)"

