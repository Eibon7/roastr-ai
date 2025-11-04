# Branch Management & Git Workflow - Lessons Learned

**Purpose:** Document critical lessons about branch management, issue isolation, and Git workflow to prevent repeated mistakes.

**Last Updated:** 2025-10-31

---

## 🚨 CRITICAL RULE: One Branch Per Issue

### ❌ MISTAKE: Working Directly on Epic/Shared Branches

**Date:** 2025-10-31
**Issue:** #680 (Mock Isolation Refactoring)
**What Happened:**

Worked directly on `feat/epic-480-week-3` (shared epic branch) instead of creating a dedicated issue branch. This caused:
- Mixed commits from different issues
- Difficulty tracking work per issue
- Potential conflicts with other work on epic branch
- Violation of branch guard policy

**Incorrect Flow:**
```bash
# ❌ WRONG
git checkout feat/epic-480-week-3
# work on issue #680
git commit -m "feat(test): Issue #680 work"
git push origin feat/epic-480-week-3  # WRONG! Pollutes epic branch
```

### ✅ CORRECT APPROACH: Dedicated Branch Per Issue

**Correct Flow:**
```bash
# ✅ CORRECT
git checkout -b fix/issue-680-mock-isolation main
echo "fix/issue-680-mock-isolation" > .issue_lock
git add .issue_lock
git commit -m "chore: Set issue lock for #680"

# Work on issue
git commit -m "feat(test): Implement mock isolation pattern (#680)"
git push -u origin fix/issue-680-mock-isolation

# Create PR to main (or epic if needed)
gh pr create --base main --head fix/issue-680-mock-isolation
```

---

## 🔒 Branch Naming Convention

**Pattern:** `<type>/issue-<number>-<short-description>`

**Types:**
- `fix/` - Bug fixes
- `feat/` - New features
- `refactor/` - Code refactoring
- `test/` - Test-related changes
- `docs/` - Documentation only
- `chore/` - Maintenance tasks

**Examples:**
```bash
fix/issue-680-mock-isolation
feat/issue-595-persona-encryption
refactor/issue-483-test-mocks
test/issue-618-jest-compatibility
```

---

## 🛡️ Issue Lock Enforcement

**Always update `.issue_lock`** before starting work:

```bash
# 1. Create branch
git checkout -b fix/issue-123-description

# 2. Set lock IMMEDIATELY
echo "fix/issue-123-description" > .issue_lock

# 3. Commit lock
git add .issue_lock
git commit -m "chore: Set issue lock for #123"
```

**Why This Matters:**
- Pre-commit hooks validate you're on correct branch
- Prevents accidental commits to wrong branch
- Forces discipline in branch management
- Makes git log cleaner and more traceable

---

## 🌳 Git Worktree for Maximum Isolation

**Recommended for complex/long-running issues:**

```bash
# Create isolated worktree
git worktree add ../roastr-issue-680 -b fix/issue-680-mock-isolation

# Work in isolated directory
cd ../roastr-issue-680
echo "fix/issue-680-mock-isolation" > .issue_lock
git add .issue_lock
git commit -m "chore: Set issue lock"

# Do all work here - completely isolated from main repo
# ...

# When done
cd ../roastr-ai
git worktree remove ../roastr-issue-680
```

**Benefits:**
- Complete isolation (no branch switching needed)
- Can run tests in both environments simultaneously
- No risk of mixing work
- Clean separation of concerns

---

## 🔄 Recovery: Moving Commits to Correct Branch

**If you committed to wrong branch:**

```bash
# 1. Create correct branch from before your commits
git checkout -b fix/issue-680-mock-isolation <hash-before-commits>

# 2. Cherry-pick your commits
git cherry-pick <commit1> <commit2> <commit3>

# 3. Update issue lock
echo "fix/issue-680-mock-isolation" > .issue_lock
git add .issue_lock
git commit -m "chore: Set issue lock"

# 4. Push correct branch
git push -u origin fix/issue-680-mock-isolation

# 5. Clean wrong branch
git checkout <wrong-branch>
git reset --hard <hash-before-commits>
git push origin <wrong-branch> --force-with-lease
```

**What I Did for Issue #680:**
```bash
git checkout -b fix/issue-680-mock-isolation b1513450
git cherry-pick 8163f025 a85cd827 0a321a05
echo "fix/issue-680-mock-isolation" > .issue_lock
git add .issue_lock && git commit -m "chore: Set issue lock"
git push -u origin fix/issue-680-mock-isolation

git checkout feat/epic-480-week-3
git reset --hard b1513450
git push origin feat/epic-480-week-3 --force-with-lease
```

---

## 📋 Pre-Work Checklist

Before starting ANY issue:

- [ ] Verify current branch: `git rev-parse --abbrev-ref HEAD`
- [ ] Check issue lock: `cat .issue_lock`
- [ ] Create dedicated branch: `git checkout -b <type>/issue-<num>-<desc>`
- [ ] Set issue lock: `echo "<branch-name>" > .issue_lock`
- [ ] Commit lock: `git add .issue_lock && git commit -m "chore: Set issue lock"`
- [ ] Verify hooks active: `ls -la .git/hooks/`
- [ ] (Optional) Create worktree for isolation

---

## 🎯 Key Principles

1. **One Branch = One Issue**
   - Never mix multiple issues in one branch
   - Never work directly on epic/shared branches

2. **Always Use Issue Lock**
   - First commit on new branch MUST be setting .issue_lock
   - Hooks will enforce this

3. **Prefer Worktrees for Complex Work**
   - Provides complete isolation
   - Reduces risk of mistakes
   - Enables parallel work

4. **Clean Branch History**
   - Keeps git log traceable
   - Makes code review easier
   - Simplifies debugging

5. **Epic Branches Are Integration Points**
   - Only merge completed PRs into epic branches
   - Never commit directly to epic branches
   - Epic branches merge into main

---

## 🔗 Related Documentation

- **Branch Guard Policy:** `.husky/pre-commit` (branch validation)
- **Issue Lock System:** CLAUDE.md (🔐 Rama protegida / Candado por issue)
- **Git Workflow:** docs/CONTRIBUTING.md (if exists)
- **PR Process:** CLAUDE.md (Reglas de PR)

---

## 📈 Success Metrics

**Before this lesson:**
- ❌ Committed to wrong branch (feat/epic-480-week-3)
- ❌ Mixed issue work with epic work
- ❌ Had to force-push to clean up

**After applying this lesson:**
- ✅ Clean branch per issue
- ✅ Issue lock enforced
- ✅ Traceable git history
- ✅ Easy code review
- ✅ No branch pollution

---

## 🎓 Bottom Line

**NEVER work directly on shared/epic branches.**
**ALWAYS create a dedicated branch per issue.**
**ALWAYS set .issue_lock FIRST.**

This is not optional. This is mandatory for production-quality work.

---

**Maintained by:** Claude Code Orchestrator
**First Recorded:** 2025-10-31 (Issue #680)
**Status:** ACTIVE - MUST FOLLOW
