---
name: writing-plans-skill
description: Use when design is complete and you need detailed implementation tasks for engineers with zero codebase context - creates comprehensive implementation plans with exact file paths, complete code examples, and verification steps assuming engineer has minimal domain knowledge
triggers:
  - "implementation plan"
  - "detailed tasks"
  - "zero context"
  - "complete plan"
  - "file paths"
used_by:
  - orchestrator
  - task-assessor
  - back-end-dev
  - front-end-dev
steps:
  - paso1: "Announce: Using writing-plans skill to create implementation plan"
  - paso2: "Create comprehensive plan with exact file paths, complete code examples, verification steps"
  - paso3: "Assume engineer has zero context and questionable taste"
  - paso4: "Provide bite-sized tasks (2-5 minutes each)"
  - paso5: "Start with header: Goal, Architecture, Tech Stack"
  - paso6: "For each task: Files, Steps (write test → run → implement → test → commit), Code examples"
  - paso7: "Reference skills with @ syntax when needed"
  - paso8: "Save to docs/plans/YYYY-MM-DD-<feature-name>.md"
  - paso9: "Offer execution choice: Subagent-driven or parallel session"
output: |
  - Comprehensive plan saved to docs/plans/
  - Bite-sized tasks with exact paths
  - Complete code examples
  - Verification steps
  - Execution handoff
granularity:
  - "Each step is 2-5 minutes"
  - "Write failing test → step"
  - "Run it → step"
  - "Implement minimal code → step"
  - "Run tests → step"
  - "Commit → step"
plan_header:
  - "Goal: One sentence describing what this builds"
  - "Architecture: 2-3 sentences about approach"
  - "Tech Stack: Key technologies/libraries"
task_structure:
  - "Task N: Component Name"
  - "Files: Create/Modify/Test with exact paths"
  - "Steps: With complete code examples"
  - "Commands: Exact commands with expected output"
remember:
  - "Exact file paths always"
  - "Complete code in plan (not 'add validation')"
  - "Exact commands with expected output"
  - "Reference relevant skills with @ syntax"
  - "DRY, YAGNI, TDD, frequent commits"
execution_handoff:
  - "After saving plan, offer execution choice"
  - "Option 1: Subagent-driven (this session) - fresh subagent per task"
  - "Option 2: Parallel session - new session with executing-plans skill"
referencias:
  - "Fuente: superpowers-skills/writing-plans"
  - "Complementa: executing-plans-skill"
  - "Roastr: Útil para features complejas (AC ≥5)"

