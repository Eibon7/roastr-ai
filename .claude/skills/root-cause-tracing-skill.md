---
name: root-cause-tracing-skill
description: Use when errors occur deep in execution and you need to trace back to find the original trigger - systematically traces bugs backward through call stack, adding instrumentation when needed, to identify source of invalid data or incorrect behavior
triggers:
  - "deep error"
  - "call stack"
  - "invalid data"
  - "wrong value"
  - "trace backward"
  - "bad value"
used_by:
  - test-engineer
  - back-end-dev
  - systematic-debugging-skill
steps:
  - paso1: "Observe the symptom carefully - note exact error message, stack trace, line numbers"
  - paso2: "Find immediate cause - what code directly causes this error?"
  - paso3: "Ask what called this - trace one level up in call chain"
  - paso4: "Continue tracing backward until finding original trigger"
  - paso5: "Add instrumentation if needed: console.error() with stack traces in test code"
  - paso6: "Run with bisection if needed to identify which test/path causes issue"
  - paso7: "Fix at source where invalid data originates, not at symptom point"
  - paso8: "Add defense-in-depth validation at multiple layers"
output: |
  - Original trigger identified
  - Full trace documented showing call chain
  - Fix at source implemented
  - Defense-in-depth added at each layer
  - Bug becomes impossible to reproduce
examples:
  - contexto: "git init runs in wrong directory (symptom: error deep in git operations)"
    trace: |
      1. Error: git init in /Users/project/packages/core
      2. Immediate cause: await execFileAsync('git', ['init'], { cwd: projectDir })
      3. Called by: WorktreeManager.createSessionWorktree(projectDir)
      4. Called by: Session.initializeWorkspace()
      5. Called by: Session.create()
      6. Called by: Project.create()
      7. Original trigger: Project.create() called with empty tempDir
      8. Fix: Made tempDir a getter that throws if accessed before beforeEach
    defense_in_depth:
      - Layer 1: Project.create() validates directory
      - Layer 2: WorkspaceManager validates not empty
      - Layer 3: NODE_ENV guard
      - Layer 4: Stack trace logging
  - contexto: "Database query fails with invalid parameter"
    trace: |
      1. Error: Invalid parameter in query
      2. Immediate: Database query with NULL value
      3. Called by: ShieldService.executeAction()
      4. Called by: AnalyzeToxicityWorker.process()
      5. Called by: Worker.run()
      6. Original trigger: Worker receives incomplete context from API
      7. Fix: Added validation in context parsing + default values
principle:
  - "NEVER fix just where error appears"
  - "Trace backward until finding original trigger"
  - "Fix at source + add validation at each layer"
instrumentacion:
  - "Use console.error() not logger in tests"
  - "Log before dangerous operation, not after"
  - "Include full context: directory, cwd, env vars, timestamps"
  - "Capture stack: new Error().stack shows complete call chain"
bisection_script:
  - "Use find-polluter.sh script when multiple tests could be culprit"
  - "./find-polluter.sh '.git' 'src/**/*.test.ts'"
  - "Runs tests one-by-one, stops at first polluter"
referencias:
  - "Fuente: superpowers-skills/root-cause-tracing"
  - "Completa: systematic-debugging-skill"
  - "Roastr: Útil para debugging multi-layer (API → service → DB)"

