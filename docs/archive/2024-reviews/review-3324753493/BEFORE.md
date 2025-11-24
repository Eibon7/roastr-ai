# Before Fixes - CodeRabbit Review #3324753493

**Date:** 2025-10-10
**Review URL:** https://github.com/Eibon7/roastr-ai/pull/526#pullrequestreview-3324753493

---

## Issues Detected

### 1. MAJOR: Guardian Coverage Mismatch (docs/sync-reports/pr-515-sync.md)

**Line 70:**

```markdown
**Coverage:** 80% (estimated, pending actual test coverage run)
```

**Line 187:**

```markdown
- Note: Guardian coverage set to 80% (estimated based on 14 unit tests)
```

**Authoritative Sources Show 50%:**

- `gdd-health.json`: Guardian coverage = **50**
- `gdd-drift.json`: Guardian coverage = **"50"**
- `docs/system-health.md`: Guardian coverage = **50%**
- `docs/nodes/guardian.md`: Coverage = **50%**

**Issue:** Sync report claims 80%, but all source files show 50%

---

### 2. CAUTION: Outdated Metrics (docs/system-validation.md)

**Current State (lines 74-85):**

Guardian metrics outdated:

- `health_score: "N/A"` → should be **90** (from gdd-health.json)

Roast metrics outdated:

- `last_commit: "1d ago"` → should be **"0d ago"** (from gdd-drift.json)

---

### 3. NITPICK: Markdown Formatting

**Missing Fence Languages (MD040):**

- Lines in sync report without language specifier
- Should add ` ```text ` or ` ```bash `

**Bold as Heading (MD036):**

- Need to find `**SAFE TO CONTINUE**` and convert to `###`

---

## Markdownlint Output (Before)

```
docs/system-validation.md:52 MD032/blanks-around-lists Lists should be surrounded by blank lines
docs/system-validation.md:71:81 MD013/line-length Line length [Expected: 80; Actual: 93]
docs/system-validation.md:72:81 MD013/line-length Line length [Expected: 80; Actual: 91]
docs/system-validation.md:73:81 MD013/line-length Line length [Expected: 80; Actual: 96]
docs/system-validation.md:74:81 MD013/line-length Line length [Expected: 80; Actual: 93]
docs/system-validation.md:75:81 MD013/line-length Line length [Expected: 80; Actual: 96]
docs/system-validation.md:76:81 MD013/line-length Line length [Expected: 80; Actual: 91]
docs/system-validation.md:77:81 MD013/line-length Line length [Expected: 80; Actual: 97]
docs/system-validation.md:78:81 MD013/line-length Line length [Expected: 80; Actual: 90]
docs/system-validation.md:79:81 MD013/line-length Line length [Expected: 80; Actual: 88]
docs/system-validation.md:80:81 MD013/line-length Line length [Expected: 80; Actual: 91]
```

Note: MD013 (line-length) warnings are expected (long data lines), not part of this review.

---

## Verification Commands

### Guardian Coverage Check

```bash
grep "guardian" gdd-health.json | grep coverage
# Result: "coverage": "50"

grep "Coverage:" docs/nodes/guardian.md | tail -1
# Result: **Coverage:** 50%

grep "80%" docs/sync-reports/pr-515-sync.md
# Result: Line 70 and 187 show 80%
```

### Validation Report Metrics

```bash
grep -A2 "guardian" docs/system-validation.md
# Result: health_score: "N/A"

grep -A2 "roast" docs/system-validation.md
# Result: last_commit: "1d ago"
```

---

**Status:** Issues confirmed, ready for fixes
