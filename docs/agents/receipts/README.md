# Agent Receipts

This directory contains **proof of agent invocation** for every PR that requires agent participation.

## Purpose

Receipts serve as:
1. **Audit trail** - Track which agents were invoked and why
2. **Documentation** - Record decisions and artifacts produced
3. **Enforcement** - CI validates that all required agents have receipts
4. **Transparency** - Show skip reasons when agents are intentionally omitted

## Receipt Types

### 1. Normal Receipt (Agent Invoked)

**Filename:** `<pr-number>-<agent-name>.md`
**Template:** `_TEMPLATE.md`

Used when agent was successfully invoked. Must include:
- Trigger reason (label, diff, condition)
- Decisions made
- Artifacts produced
- Guardrails verified
- Result and outcome

**Example:** `584-TestEngineer.md`

### 2. Skipped Receipt (Agent NOT Invoked)

**Filename:** `<pr-number>-<agent-name>-SKIPPED.md`
**Template:** `_TEMPLATE-SKIPPED.md`

Used when agent matched triggers but was intentionally NOT invoked. Must include:
- Why agent could apply
- Detailed skip reason
- Responsible party
- Risk assessment
- Follow-up plan

**Example:** `584-WhimsyInjector-SKIPPED.md`

## Workflow

### For Orchestrator

1. **Identify required agents:**
   ```bash
   # Based on labels
   gh issue view <number> --json labels

   # Based on diff
   git diff origin/main --name-only
   ```

2. **Cross-reference with `agents/manifest.yaml`:**
   - Check `triggers.labels`
   - Check `triggers.diffIncludes`
   - Check `triggers.conditions`

3. **For each required agent:**
   - **If invoked:** Create receipt from `_TEMPLATE.md`
   - **If skipped:** Create receipt from `_TEMPLATE-SKIPPED.md` with justification

4. **Commit receipts:**
   ```bash
   git add docs/agents/receipts/<pr>-*.md
   git commit -m "docs(agents): Add receipts for PR #<number>"
   ```

### For CI Validation

The script `scripts/ci/require-agent-receipts.js`:
1. Reads `agents/manifest.yaml`
2. Discovers changed files in PR
3. Matches against agent triggers
4. Verifies receipt exists (normal OR skipped)
5. **Fails build if receipt missing**

## Examples

### Example 1: Frontend PR

**PR #600:** New login UI

**Changed files:**
- `frontend/components/Login.jsx`
- `frontend/styles/login.css`
- `tests/e2e/login.spec.js`

**Required agents:**
- `FrontendDev` (diff: `*.jsx`, `*.css`)
- `TestEngineer` (diff: `tests/`)
- `UIDesigner` (label: `area:ui`)

**Receipts:**
- `600-FrontendDev.md` ✅
- `600-TestEngineer.md` ✅
- `600-UIDesigner-SKIPPED.md` (reason: "Design already approved in Issue #595")

### Example 2: Backend Fix

**PR #601:** Fix cost control bug

**Changed files:**
- `src/services/costControl.js`
- `tests/unit/services/costControl.test.js`

**Required agents:**
- `TestEngineer` (diff: `tests/`)
- `Guardian` (diff: `costControl.js` - sensitive file)

**Receipts:**
- `601-TestEngineer.md` ✅
- `601-Guardian.md` ✅ (exit code 0, no violations)

### Example 3: Docs Update

**PR #602:** Update integration guide

**Changed files:**
- `docs/INTEGRATIONS.md`

**Required agents:**
- None (docs-only change, no agent triggers match)

**Receipts:**
- None needed (CI passes with 0 required agents)

## Naming Convention

### Normal Receipt
```
<pr-number>-<AgentName>.md
```
Examples:
- `584-Orchestrator.md`
- `584-TestEngineer.md`
- `584-Guardian.md`

### Skipped Receipt
```
<pr-number>-<AgentName>-SKIPPED.md
```
Examples:
- `584-WhimsyInjector-SKIPPED.md`
- `584-UIDesigner-SKIPPED.md`

## Maintenance

- **Add receipt:** Every PR that triggers agents
- **Review receipts:** Code review should verify receipts are accurate
- **Archive old receipts:** Consider moving receipts >6 months old to `docs/agents/receipts/archive/YYYY/`

## CI Integration

GitHub Action job (`.github/workflows/agent-receipts.yml`):

```yaml
- name: Verify agent receipts
  run: node scripts/ci/require-agent-receipts.js
```

**Exit codes:**
- `0` - All required agents have receipts ✅
- `1` - Missing receipts ❌ (PR cannot merge)

**Output:**
```
✓ Required agents: Orchestrator, TestEngineer, Guardian
✓ Found receipt: docs/agents/receipts/584-Orchestrator.md
✓ Found receipt: docs/agents/receipts/584-TestEngineer.md
✓ Found receipt: docs/agents/receipts/584-Guardian.md
✓ All required agents have receipts
```

---

**For questions:** See `agents/manifest.yaml` for agent definitions and triggers.
