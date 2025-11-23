---

name: using-git-worktrees-skill
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans - creates isolated git worktrees with smart directory selection and safety verification
triggers:

- "isolated workspace"
- "worktree"
- "feature isolation"
- "new feature branch"
  used_by:
- orchestrator
- writing-plans-skill
- executing-plans-skill
  steps:
- paso1: "Check existing directories (.worktrees or worktrees)"
- paso2: "Check CLAUDE.md for preference"
- paso3: "Ask user if no directory found"
- paso4: "Safety verification: Check .gitignore before creating worktree"
- paso5: "Add to .gitignore if missing, commit change"
- paso6: "Create worktree with new branch"
- paso7: "Run project setup (npm install, cargo build, etc)"
- paso8: "Verify clean baseline with tests"
- paso9: "Report location and ready status"
  output: "Isolated worktree at <full-path> with tests passing"
  directory_selection:
  priority1: ".worktrees (preferred, hidden)"
  priority2: "worktrees (alternative)"
  priority3: "~/.config/superpowers/worktrees/<project>/ (global)"
  safety_verification:
- "MUST verify .gitignore before creating project-local worktree"
- "Prevents accidentally committing worktree contents"
- "If NOT in .gitignore: Add line + commit immediately"
  creation_steps:
- "Detect project name"
- "Create worktree: git worktree add <path> -b <branch>"
- "Run project setup (auto-detect package.json, Cargo.toml, etc)"
- "Verify clean baseline: npm test / cargo test / etc"
- "Report: Worktree ready at <full-path>, tests passing"
  common_mistakes:
- "Skipping .gitignore verification → worktree contents tracked"
- "Assuming directory location → violates conventions"
- "Proceeding with failing tests → can't distinguish new from existing bugs"
  red_flags:
- "Create worktree without .gitignore verification"
- "Skip baseline test verification"
- "Assume directory location"
  referencias:
- "Fuente: superpowers-skills/using-git-worktrees"
- "Roastr: Útil para features grandes (branch isolation)"
- "Completa: finishing-a-development-branch-skill"
