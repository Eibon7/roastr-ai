---
name: visual-validation-skill
description: Ejecuta validación visual de UI con Playwright MCP y genera evidencias.
triggers:
  - "UI change"
  - "frontend"
  - "visual"
  - "component"
  - "screenshot"
used_by:
  - ui-designer
  - front-end-dev
  - test-engineer
  - whimsy-injector
steps:
  - paso1: "Conectar a Playwright MCP server (ya configurado en settings.local.json)"
  - paso2: "Identificar componentes/rutas afectadas por cambios"
  - paso3: "Lanzar navegación a páginas relevantes con mcp.playwright.browse"
  - paso4: "Capturar screenshots en múltiples viewports (desktop, tablet, mobile)"
  - paso5: "Ejecutar tests de accesibilidad automáticos (a11y)"
  - paso6: "Simular interacciones de usuario (clicks, hovers, form submissions)"
  - paso7: "Revisar consola del navegador y network logs"
  - paso8: "Generar reporte visual con capturas y métricas"
output: |
  - Screenshots multi-viewport: docs/test-evidence/issue-{id}/screenshots/
    - desktop-{page}.png
    - tablet-{page}.png
    - mobile-{page}.png
  - Reporte visual: docs/test-evidence/issue-{id}/ui-report.md
  - Logs de accesibilidad: docs/test-evidence/issue-{id}/a11y-logs.txt
  - Network logs: docs/test-evidence/issue-{id}/network-log.json
examples:
  - contexto: "Se implementó nuevo componente UserProfile"
    accion: |
      1. Navegar a /profile
      2. Capturar en 1920x1080 (desktop), 768x1024 (tablet), 375x667 (mobile)
      3. Probar interacción: click en "Edit" button
      4. Verificar que modal aparece correctamente
      5. Capturar estado hover de botones
    output: "6 screenshots + ui-report.md con métricas a11y"
  - contexto: "Cambios en formulario de login"
    accion: |
      1. Navegar a /login
      2. Capturar estado inicial
      3. Simular focus en input de email
      4. Capturar estado de error al submit incorrecto
      5. Validar que contraste cumple WCAG AA
    output: "Capturas de estados + reporte de contraste"
viewports:
  desktop: "1920x1080"
  tablet: "768x1024"
  mobile: "375x667"
checks:
  - "Contraste de colores (WCAG AA mínimo)"
  - "Focus visible en elementos interactivos"
  - "Alt text en imágenes"
  - "Labels en formularios"
  - "Responsive sin roturas"
  - "Loading states visibles"
  - "Error states con mensajes claros"
tools:
  - mcp.playwright.browse: "Navegar páginas"
  - mcp.playwright.screenshot: "Capturar estado visual"
  - mcp.playwright.inspect: "Inspeccionar elementos"
rules:
  - SIEMPRE capturar en 3 viewports mínimo
  - Incluir estados: loading, error, empty, success
  - Verificar a11y en cada captura
  - Documentar cualquier inconsistencia visual
  - Comparar con specs en docs/ui.md si existen
references:
  - "docs/ui-review.md"
  - "docs/test-evidence/ - Evidencias visuales"
  - "CLAUDE.md - Visual validation"

