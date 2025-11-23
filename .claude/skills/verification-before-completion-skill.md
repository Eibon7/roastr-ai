---

name: verification-before-completion-skill
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
triggers:

- "complete"
- "done"
- "finished"
- "passing"
- "working"
- "ready"
  used_by:
- all-agents
  steps:
- paso1: "Iron Law: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE"
- paso2: "Identify what command proves this claim"
- paso3: "Run the FULL command (fresh, complete)"
- paso4: "Read full output, check exit code, count failures"
- paso5: "Verify: Does output confirm the claim?"
- paso6: "Only then: Make the claim"
  output: "Evidence-based completion claims with verification"
  iron_law: |
  NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE

Skip any step = lying, not verifying
gate_function:

- "1. IDENTIFY: What command proves this claim?"
- "2. RUN: Execute FULL command (fresh, complete)"
- "3. READ: Full output, check exit code"
- "4. VERIFY: Does output confirm claim?"
- "5. ONLY THEN: Make the claim"
  red_flags:
- "Should work now"
- "Probably"
- "Seems to"
- "Looks correct"
- "Expressing satisfaction before verification"
  patterns:
  tests: "[Run npm test] [See: 34/34 pass] 'All tests pass' (NOT 'should pass')"
  build: "[Run build] [See: exit 0] 'Build passes' (NOT 'linter passed')"
  requirements: "Re-read plan → Create checklist → Verify each → Report gaps"
  agent_delegation: "Agent reports → Check VCS diff → Verify changes → Report actual state"
  rationalizations:
- "Should work" → "RUN the verification"
- "I'm confident" → "Confidence ≠ evidence"
- "Just this once" → "No exceptions"
- "I'm tired" → "Exhaustion ≠ excuse"
  referencias:
- "Fuente: superpowers-skills/verification-before-completion"
- "Roastr: Prevents false claims before PR"
- "Critical para: Pre-Flight Checklist"
