---
name: telemetry-monitor-skill
description: Recolecta métricas de telemetría del ecosistema Claude Code (agents, skills, tokens, health).
triggers:
  - "telemetry"
  - "metrics"
  - "monitoring"
  - "claude maintainer"
used_by:
  - claude-maintainer
  - orchestrator
steps:
  - paso1: "Recolectar métricas de invocación de skills"
  - paso2: "Calcular token usage promedio por skill"
  - paso3: "Medir skill invocation ratio (uso relativo)"
  - paso4: "Capturar health score y drift score actuales"
  - paso5: "Verificar CI/CD pass rate reciente"
  - paso6: "Generar telemetry/claude-metrics.json"
output: |
  - docs/telemetry/claude-metrics.json con métricas recolectadas
  - Resumen de salud del ecosistema Claude Code
examples:
  - contexto: "ClaudeMaintainer ejecutando auditoría semanal"
    recolectar:
      - Token usage por agent/skill
      - Invocación relativa de cada skill
      - Health trends (últimos 7 días)
      - Drift trends
rules:
  - Recolectar métricas automáticamente en cada ejecución
  - Mantener historial en docs/telemetry/ (30 días)
  - NO exponer datos sensibles (usar placeholders si necesario)
checklist:
  - [ ] token_usage recolectado (avg por skill)
  - [ ] invocation_ratio calculado
  - [ ] health_scores capturados
  - [ ] drift_scores capturados
  - [ ] ci_pass_rate verificado
  - [ ] JSON generado y guardado

