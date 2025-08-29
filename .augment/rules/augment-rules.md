---
type: "always_apply"
---

# Augment Rules

## Auto-approval
- Auto-approve creating commits in feature branches.
- Auto-approve creating pull requests in feature branches.
- Do NOT auto-approve merges into `main` or `release/*`.

## Safety
- Always run tests before pushing commits.
- If tests fail, stop and request user input.
- If there are security-related changes (auth, Stripe, Supabase, secrets), always request approval.