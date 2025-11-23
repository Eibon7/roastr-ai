---

name: requesting-code-review-skill
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements - dispatches code reviewer to review implementation against plan or requirements before proceeding
triggers:

- "code review"
- "review needed"
- "before merge"
- "major feature"
  used_by:
- orchestrator
- all-agents
  steps:
- paso1: "Get git SHAs (BASE_SHA, HEAD_SHA)"
- paso2: "Dispatch code-reviewer with: What was implemented, plan/requirements, SHAs, description"
- paso3: "Review feedback: Critical → fix immediately, Important → fix before proceeding"
- paso4: "Note Minor issues for later"
- paso5: "Push back if reviewer wrong (with reasoning)"
  output: "Review feedback: Strengths, Issues (Critical/Important/Minor), Assessment"
  when_to_use: "After each task, major feature, before merge, when stuck"
  integration:
  subagent_driven: "Review after EACH task"
  executing_plans: "Review after each batch (3 tasks)"
  adhoc: "Review before merge, when stuck"
  red_flags:
- "Skip review because 'it's simple'"
- "Ignore Critical issues"
- "Proceed with unfixed Important issues"
- "Argue with valid technical feedback"
  pushback:
- "If reviewer wrong: Push back with technical reasoning"
- "Show code/tests proving it works"
- "Request clarification"
  referencias:
- "Fuente: superpowers-skills/requesting-code-review"
- "Roastr: Integra con code-review-skill y CodeRabbit"
