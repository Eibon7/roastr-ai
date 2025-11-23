---

name: test-driven-development-skill
description: Use when implementing any feature or bugfix, before writing implementation code - write the test first, watch it fail, write minimal code to pass; ensures tests actually verify behavior by requiring failure first
triggers:

- "RED GREEN REFACTOR"
- "TDD"
- "write test first"
- "test failure"
- "commit sin tests"
  used_by:
- test-engineer
- back-end-dev
- front-end-dev
  steps:
- paso1: "Iron Law: NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST"
- paso2: "RED: Write failing test, verify it fails correctly (not errors)"
- paso3: "GREEN: Write minimal code to pass, verify test passes"
- paso4: "REFACTOR: Clean up, keep tests green"
- paso5: "Repeat for next feature"
  output: "Tests that actually verify behavior + minimal production code"
  iron_law: |
  NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST

Write code before test? Delete it. Start over.
red_flags:

- "Code before test"
- "Test passes immediately"
- "Tests added later"
- "Already manually tested"
- "Delete is wasteful"
  when_to_use: "Always - except throwaway prototypes (ask human)"
  red_green_refactor:
  red: "Write one minimal test, watch it fail for right reason"
  green: "Minimal code to pass, verify all tests pass"
  refactor: "Clean up only, keep tests green"
  rationalizations:
- "Too simple to test" → "Test takes 30 seconds, simple code breaks"
- "I'll test after" → "Passing immediately proves nothing"
- "Already manually tested" → "Ad-hoc ≠ systematic, no record"
- "Deleting X hours is wasteful" → "Sunk cost fallacy, keeping unverified code is debt"
  referencias:
- "Fuente: superpowers-skills/test-driven-development"
- "Roastr: Enforces 'commit sin tests = prohibido'"
- "Complementa: test-generation-skill"
