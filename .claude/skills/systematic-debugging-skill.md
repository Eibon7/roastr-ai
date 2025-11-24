---

name: systematic-debugging-skill
description: Use when encountering any bug, test failure, or unexpected behavior before proposing fixes - four-phase framework (root cause investigation, pattern analysis, hypothesis testing, implementation) that ensures understanding before attempting solutions
triggers:

- "bug"
- "test failure"
- "error"
- "unexpected behavior"
- "debug"
- "investigate"
  used_by:
- test-engineer
- back-end-dev
- front-end-dev
- github-monitor
  steps:
- paso1: "Phase 1 - Root Cause Investigation: Read error messages carefully, reproduce consistently, check recent changes, gather evidence in multi-component systems"
- paso2: "Phase 1 - Add diagnostic instrumentation: For EACH component boundary, log data entering/exiting, verify environment propagation, check state at each layer"
- paso3: "Phase 1 - Trace data flow: Find where bad value originates, trace backward through call stack until source is found"
- paso4: "Phase 2 - Pattern Analysis: Find working examples in codebase, compare against references, identify differences, understand dependencies"
- paso5: "Phase 3 - Hypothesis Testing: Form single hypothesis, test minimally (one variable at a time), verify before continuing"
- paso6: "Phase 4 - Implementation: Create failing test case, implement single fix addressing root cause, verify fix works and no other tests broken"
- paso7: "If 3+ fixes failed: STOP and question architecture - discuss with human before attempting more fixes"
  output: |
- Root cause identified and documented
- Evidence gathered showing WHERE it breaks
- Failing test case created
- Fix implemented at source
- All tests passing
  examples:
- contexto: "Test failure in shield moderation system"
  accion: |
  1. Read error message completely (line number, file, stack trace)
  2. Reproduce test failure consistently
  3. Check recent changes in shieldService.js
  4. Add diagnostic logging at component boundaries
  5. Identify root cause (wrong action type in decision matrix)
  6. Create failing test for the specific case
  7. Fix at source (decision matrix)
     output_esperado: "Root cause documentado + test passing"
- contexto: "Integration test fails for API endpoint"
  accion: | 1. Trace data flow from request → route → service → database 2. Add logging at each layer 3. Identify which layer fails 4. Compare with working similar endpoint 5. Find difference in validation logic 6. Form hypothesis and test 7. Fix validation logic
  output_esperado: "API endpoint funciona + evidencias guardadas"
  reglas:
- "❌ NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST"
- "❌ NEVER fix just the symptom"
- "❌ NEVER guess - gather evidence first"
- "✅ ALWAYS trace backward to original trigger"
- "✅ If 3+ fixes failed: Question the architecture"
- "✅ Create failing test BEFORE fix"
  red_flags:
- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "Add multiple changes, run tests"
- "I don't fully understand but this might work"
- "One more fix attempt" (when already tried 2+)
  patrones:
- "Each fix reveals new problem in different place → architectural problem"
- "Fixes require 'massive refactoring' → wrong architecture"
- "Can't isolate what worked → stop and use systematic process"
  referencias:
- "Fuente: superpowers-skills/systematic-debugging"
- "Complementa: test-generation-skill"
- "Requiere: root-cause-tracing-skill (para errores profundos)"
