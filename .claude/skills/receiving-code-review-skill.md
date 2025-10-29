---
name: receiving-code-review-skill
description: Use when receiving code review feedback, before implementing suggestions - requires technical rigor and verification, not performative agreement or blind implementation
triggers:
  - "review feedback"
  - "code review comments"
  - "suggestions"
used_by:
  - orchestrator
  - all-agents
steps:
  - paso1: "READ: Complete feedback without reacting"
  - paso2: "UNDERSTAND: Restate requirement (or ask)"
  - paso3: "VERIFY: Check against codebase reality"
  - paso4: "EVALUATE: Technically sound for THIS codebase?"
  - paso5: "RESPOND: Technical acknowledgment or reasoned pushback"
  - paso6: "IMPLEMENT: One item at a time, test each"
output: "Verified feedback implemented or reasoned pushback"
forbidden_responses:
  - "❌ 'You're absolutely right!'"
  - "❌ 'Great point!' / 'Excellent feedback!'"
  - "❌ 'Let me implement that now' (before verification)"
  - "✅ Restate technical requirement"
  - "✅ Ask clarifying questions"
  - "✅ Push back with reasoning if wrong"
  - "✅ Just start working (actions > words)"
handling_unclear:
  - "IF any item unclear → STOP, don't implement"
  - "ASK for clarification on unclear items"
  - "Items may be related - partial understanding = wrong implementation"
pushback_when:
  - "Suggestion breaks existing functionality"
  - "Reviewer lacks full context"
  - "Violates YAGNI (unused feature)"
  - "Technically incorrect for this stack"
  - "Conflicts with architectural decisions"
yagni_check:
  - "IF reviewer suggests 'properly' implementing feature"
  - "grep codebase for actual usage"
  - "IF unused: Remove it (YAGNI)?"
  - "IF used: Then implement properly"
acknowledging_correct:
  - "✅ 'Fixed. [Brief description]'"
  - "✅ '[Just fix it and show in code]'"
  - "❌ 'You're absolutely right!'"
  - "❌ 'Thanks for catching that!'"
  - "❌ ANY gratitude expression"
bottom_line: |
  External feedback = suggestions to evaluate, not orders to follow.
  
  Verify. Question. Then implement.
  
  No performative agreement. Technical rigor always.
referencias:
  - "Fuente: superpowers-skills/receiving-code-review"
  - "Roastr: Evita implementar feedback sin verificar"

