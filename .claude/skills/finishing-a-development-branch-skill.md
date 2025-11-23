---

name: finishing-a-development-branch-skill
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work - guides completion of development work by presenting structured options for merge, PR, or cleanup
triggers:

- "implementation complete"
- "tests passing"
- "ready to integrate"
- "finish feature"
  used_by:
- executing-plans-skill
- orchestrator
  steps:
- paso1: "Verify tests pass (run test suite)"
- paso2: "If tests fail: Report failures, stop"
- paso3: "Determine base branch (main/master)"
- paso4: "Present exactly 4 options: Merge locally, Push PR, Keep as-is, Discard"
- paso5: "Execute chosen option"
- paso6: "Cleanup worktree if applicable (Options 1 & 4)"
  output: "Work completed and integrated according to choice"
  options:
  merge_locally: | 1. Switch to base branch 2. Pull latest 3. Merge feature branch 4. Verify tests on merged result 5. Delete feature branch if tests pass
  push_pr: | 1. Push branch 2. Create PR with title and description 3. Keep worktree (don't cleanup)
  keep_asis: "Keep branch and worktree, don't cleanup"
  discard: | 1. Confirm with typed 'discard' 2. Switch to base branch 3. Delete branch (force) 4. Cleanup worktree
  cleanup_worktree:
  options_cleanup: "1, 4 (merge locally, discard)"
  options_keep: "2, 3 (push PR, keep as-is)"
  red_flags:
- "Skip test verification"
- "Open-ended questions"
- "Automatic worktree cleanup"
- "No confirmation for discard"
  key_principle: "Verify tests → Present options → Execute → Cleanup"
  referencias:
- "Fuente: superpowers-skills/finishing-a-development-branch"
- "Roastr: Cierra features limpias después de verification-before-completion"
- "Complementa: using-git-worktrees-skill"
