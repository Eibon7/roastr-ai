---
name: gdd-sync
description: Synchronize modified GDD nodes to spec.md after implementation (FASE 4) - detects changes, updates metadata, validates consistency
triggers:
  - "sync nodes"
  - "sync spec"
  - "update spec.md"
  - "post-merge sync"
  - "doc sync"
  - "FASE 4"
used_by:
  - orchestrator
  - guardian
steps:
  - paso1: "Detect modified nodes (git diff docs/nodes/ or manual list)"
  - paso2: "Validate node YAML frontmatter (id, depends_on, coverage_source)"
  - paso3: "Execute sync-gdd-nodes.js to update metadata"
  - paso4: "Execute sync-spec-md.js to merge changes to spec.md"
  - paso5: "Validate consistency with validate-gdd-runtime.js --full"
  - paso6: "Validate system-map.yaml with validate-gdd-cross.js --full"
  - paso7: "Check health score with score-gdd-health.js --ci"
  - paso8: "Generate sync report with generate-sync-report.js"
output: |
  - Modified nodes synchronized to spec.md
  - Metadata updated (Last Updated, Related PRs, Coverage)
  - Validation passed (GDD runtime + cross-validation)
  - Health score ≥87
  - Sync report generated
---

# GDD Synchronization Skill (FASE 4)

## Purpose

Synchronizes changes from modified GDD nodes back to spec.md after implementation, ensuring bidirectional consistency between the fragmented documentation (nodes) and the master document (spec.md).

## When to Use

**Automatic (Preferred):**
- Post-merge workflow: `.github/workflows/post-merge-doc-sync.yml`
- Executes automatically when PR is merged to `main`
- Creates doc-sync PR for review

**Manual (If automatic fails):**
- User requests: "Sync nodes to spec.md"
- After implementing changes without PR merge
- Emergency sync for documentation drift

## Synchronization Process

### Step 1: Detect Modified Nodes

**Automatic detection:**
```bash
# Get changed files from PR
gh api repos/Eibon7/roastr-ai/pulls/{pr}/files --jq '.[].filename' | \
  grep 'docs/nodes/' > changed-nodes.txt

# Map files to node IDs
node scripts/resolve-graph.js --from-files changed-nodes.txt --format=json > affected-nodes.json
```

**Manual detection:**
```bash
# Git diff since last sync
git diff HEAD~1 --name-only | grep 'docs/nodes/' > changed-nodes.txt

# Or specify nodes manually
echo '{"nodes": ["auth-system", "billing"], "pr": 700, "branch": "fix/auth"}' > affected-nodes.json
```

### Step 2: Validate Node Structure

**Check YAML frontmatter:**
```yaml
---
id: auth-system                    # ✅ Required: Unique identifier
section: "## Authentication"       # ✅ Required: Anchor in spec.md
depends_on:                        # ✅ Required: Dependencies ([] if none)
  - database-layer
  - api-layer
status: implemented                # ✅ Required: Current state
coverage: 85%                      # ✅ Required: Auto-generated only
coverage_source: auto              # ✅ Required: Must be 'auto'
last_updated: 2025-11-02          # ✅ Required: ISO date
related_prs:                       # ✅ Required: Related PR numbers
  - 680
  - 628
---
```

**Validation rules:**
- ❌ NEVER allow `coverage_source: manual` (-20 health points)
- ✅ `id:` must be unique across all nodes
- ✅ `depends_on:` must reference existing nodes
- ✅ `section:` must match heading in spec.md
- ✅ `coverage:` must match coverage-summary.json if available

### Step 3: Sync Node Metadata

```bash
node scripts/sync-gdd-nodes.js --pr {pr_number} --nodes affected-nodes.json
```

**Updates:**
- `last_updated:` → current date
- `related_prs:` → adds current PR number
- `coverage:` → syncs from coverage-summary.json
- Cross-references → updates links to other nodes

### Step 4: Sync to spec.md

```bash
node scripts/sync-spec-md.js --nodes affected-nodes.json
```

**Updates spec.md:**
- Inserts changelog entry at top (after main title)
- Lists affected nodes with links
- Includes PR metadata and sync date
- Does NOT modify sections directly (manual merge if needed)

**Changelog format:**
```markdown
## 🔄 Post-Merge Documentation Sync - PR #700

### 🛠️ Implementation Date: 2025-11-02

### 📋 Summary

**PR Title:** Add OAuth 2.0 for Facebook
**Branch:** `feature/facebook-oauth`
**Affected Nodes:** 3

### 📦 Affected GDD Nodes

- [`auth-system`](docs/nodes/auth-system.md)
- [`integrations-layer`](docs/nodes/integrations-layer.md)
- [`facebook-integration`](docs/nodes/facebook-integration.md)

### 📝 Changes

- Updated node metadata (Last Updated, Related PRs)
- Synced coverage information where available
- Updated cross-references in affected nodes

### 🔗 Related

- **PR:** #700
- **Branch:** `feature/facebook-oauth`
- **Sync Report:** `docs/sync-reports/pr-700-sync.md`

---
```

### Step 5: Validate Consistency

```bash
# Validate GDD runtime (all nodes consistent)
node scripts/validate-gdd-runtime.js --full

# Validate system-map.yaml
node scripts/validate-gdd-cross.js --full
```

**Exit codes:**
- `0` - Validation passed
- `1` - Warnings (review but proceed)
- `2` - Errors (block until fixed)

**Common errors:**
- Missing `id:` or `depends_on:`
- Circular dependencies
- Coverage mismatch >3%
- Broken cross-references

### Step 6: Check Health Score

```bash
node scripts/score-gdd-health.js --ci
```

**Required:** Health score ≥87 (temporary threshold until 2025-10-31)

**If <87:**
- Review what's failing (run with `--verbose`)
- Fix issues (don't adjust threshold without investigation)
- Run auto-repair if appropriate: `node scripts/auto-repair-gdd.js --auto-fix`

### Step 7: Generate Sync Report

```bash
node scripts/generate-sync-report.js \
  --pr {pr_number} \
  --nodes affected-nodes.json \
  --output docs/sync-reports/pr-{pr_number}-sync.md
```

**Report includes:**
- List of affected nodes
- Metadata changes summary
- Coverage updates
- Validation results
- Health score
- Drift analysis

### Step 8: Commit Changes

**Automatic (preferred):**
- Workflow creates branch: `docs/sync-pr-{pr_number}`
- Commits all documentation changes
- Creates PR with sync report as body
- Assigns to original PR author

**Manual:**
```bash
git add docs/nodes/
git add docs/sync-reports/
git add spec.md
git add system-map.yaml
git add gdd-status.json
git add gdd-health.json
git add gdd-drift.json

git commit -m "docs: Sync documentation - PR #700

### GDD Context
- Nodes Activated: auth-system, integrations-layer, facebook-integration
- Nodes Modified: auth-system (OAuth flow), integrations-layer (Facebook added)
- Health Score: 87 (🟢 HEALTHY)

### Updates
- spec.md: Updated affected sections
- system-map.yaml: Validated and synced
- Coverage: Synced from coverage-summary.json

Report: docs/sync-reports/pr-700-sync.md

[sync]"
```

**⚠️ IMPORTANT:** Always include GDD context in commits:
- **Nodes Activated:** What nodes were loaded for this work
- **Nodes Modified:** What nodes actually changed (with brief description)
- **Health Score:** GDD health after changes

**Why:** Provides complete traceability of context used and changes made.

## Success Criteria

✅ All modified nodes detected
✅ YAML frontmatter validated
✅ Metadata updated (Last Updated, Related PRs, Coverage)
✅ spec.md updated with changelog entry
✅ Validation passed (runtime + cross-validation)
✅ Health score ≥87
✅ Sync report generated
✅ Changes committed with `[sync]` tag

## Error Handling

### Error: Coverage source is 'manual'

**Fix:**
```bash
node scripts/auto-repair-gdd.js --auto-fix
# Reviews all nodes, sets coverage_source: auto
# Re-syncs coverage from coverage-summary.json
```

### Error: Circular dependency detected

**Fix:**
```bash
# Review affected nodes' depends_on: fields
# Remove circular references
# Example: A depends on B, B depends on A → break loop

# Validate fix
node scripts/validate-gdd-runtime.js --full
```

### Error: Health score <87

**Diagnosis:**
```bash
node scripts/score-gdd-health.js --ci --verbose
# Shows which factors are failing
```

**Fixes:**
- Coverage manual → auto-repair
- Missing metadata → add to frontmatter
- Broken cross-refs → update links
- Tests failing → fix tests FIRST (don't adjust threshold)

### Error: Sync workflow didn't run

**Check:**
```bash
gh run list --workflow=post-merge-doc-sync.yml --limit=5
```

**Manual sync:**
```bash
# Create affected-nodes.json manually
echo '{"nodes": ["auth-system"], "pr": 700, "branch": "fix/auth"}' > affected-nodes.json

# Run sync scripts
node scripts/sync-gdd-nodes.js --pr 700 --nodes affected-nodes.json
node scripts/sync-spec-md.js --nodes affected-nodes.json
node scripts/validate-gdd-runtime.js --full
```

## Examples

### Example 1: Post-merge automatic sync

**Scenario:** PR #700 merged to main, modifies `auth-system` and `billing` nodes.

**Workflow:**
1. Post-merge workflow detects changes
2. Maps files → nodes: `auth-system`, `billing`
3. Resolves dependencies: + `database-layer`, `api-layer`
4. Syncs node metadata
5. Updates spec.md with changelog
6. Validates consistency
7. Generates report: `docs/sync-reports/pr-700-sync.md`
8. Creates PR: `docs/sync-pr-700`
9. Assigns to PR author

**User action:** Review and merge doc-sync PR.

### Example 2: Manual sync after failed workflow

**Scenario:** Automatic workflow failed, need to sync manually.

**Commands:**
```bash
# Detect changed nodes
git diff HEAD~1 --name-only | grep 'docs/nodes/' > changed-nodes.txt

# Create affected-nodes.json
cat > affected-nodes.json <<EOF
{
  "nodes": ["auth-system", "billing"],
  "pr": 700,
  "branch": "fix/complete-auth",
  "title": "Complete authentication fixes"
}
EOF

# Sync nodes
node scripts/sync-gdd-nodes.js --pr 700 --nodes affected-nodes.json

# Sync spec.md
node scripts/sync-spec-md.js --nodes affected-nodes.json

# Validate
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci

# Generate report
node scripts/generate-sync-report.js \
  --pr 700 \
  --nodes affected-nodes.json \
  --output docs/sync-reports/pr-700-sync.md

# Commit
git add docs/nodes/ docs/sync-reports/ spec.md
git commit -m "docs: Sync documentation - PR #700 [sync]"
git push
```

## Integration with GDD Framework

This skill implements **FASE 4 (Synchronization)** of the GDD workflow:

```
FASE 0: Load Context (gdd skill)
   ↓
FASE 1-3: Implementation
   ↓
FASE 4: Synchronization (THIS SKILL)
   ↓
Validation Complete
```

**See also:**
- `docs/GDD-FRAMEWORK.md` - Complete GDD documentation
- `.claude/skills/gdd/SKILL.md` - Context loading (FASE 0)
- `.github/workflows/post-merge-doc-sync.yml` - Automatic sync workflow

## Reglas de Oro

### ❌ NUNCA

1. Modificar `coverage:` manualmente (debe ser auto)
2. Sincronizar sin validar frontmatter YAML
3. Mergear doc-sync PR sin review
4. Ajustar thresholds sin investigar causas
5. Ignorar errores de validación

### ✅ SIEMPRE

1. Ejecutar validación completa post-sync
2. Verificar health score ≥87
3. Generar sync report
4. Confirmar que auto-repair no aplicó parches incorrectos
5. Revisar changelog entry en spec.md
6. Verificar cross-references actualizados

## Referencias

- **Framework:** `docs/GDD-FRAMEWORK.md`
- **Scripts:**
  - `scripts/sync-gdd-nodes.js`
  - `scripts/sync-spec-md.js`
  - `scripts/validate-gdd-runtime.js`
  - `scripts/score-gdd-health.js`
  - `scripts/generate-sync-report.js`
- **Workflow:** `.github/workflows/post-merge-doc-sync.yml`
- **Related skills:** `gdd/SKILL.md`, `spec-update-skill.md`
