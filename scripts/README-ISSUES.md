# How to Create Production-Ready GitHub Issues

This directory contains tools to create the 12 production-ready issues identified in `/PRODUCTION-READY-ISSUES.md`.

## Option 1: Python Script (Recommended)

The Python script is the easiest way to create all issues at once.

### Prerequisites
1. Install GitHub CLI: https://cli.github.com/manual/installation
2. Authenticate: `gh auth login`

### Usage
```bash
# From repository root
python3 scripts/create-production-issues.py
```

This will create all 12 issues with proper labels and formatting.

## Option 2: Manual Creation via GitHub Web UI

1. Go to https://github.com/Eibon7/roastr-ai/issues/new
2. Copy the title and body from each issue in `PRODUCTION-READY-ISSUES.md`
3. Add appropriate labels manually
4. Click "Submit new issue"

Repeat for all 12 issues.

## Option 3: One-by-one with gh CLI

```bash
# Example for Issue #1
gh issue create \
  --title "P0: Implementar campo post_mode (manual/auto) en integration_configs" \
  --label "priority:P0,area:backend" \
  --body "$(cat <<'EOF'
[Paste issue body here from PRODUCTION-READY-ISSUES.md]
EOF
)"
```

## Issue Summary

### P0 - MVP Blockers (4 issues)
1. Campo `post_mode` (manual/auto)
2. Niveles de Shield configurables
3. Separar `enabled` de `shield_enabled`
4. Múltiples cuentas del mismo tipo

### P1 - Quality (3 issues)
5. Eliminar console.logs
6. Revocación OAuth tokens
7. Endpoints de cancelación de suscripción

### P2 - Post-MVP (3 issues)
8. Consolidar servicios duplicados
9. Style Profile Extraction con feature flag
10. Event-driven queue system

### P3 - Nice-to-have (2 issues)
11. Filtros avanzados
12. GDPR cleanup opcional

## Troubleshooting

### "gh: command not found"
Install GitHub CLI: https://cli.github.com/manual/installation

### "gh: authentication required"
Run: `gh auth login` and follow the prompts

### "permission denied"
Make sure scripts are executable:
```bash
chmod +x scripts/create-production-issues.py
chmod +x scripts/create-production-issues.sh
```

## Next Steps

After creating issues:
1. Review and adjust priorities if needed
2. Assign issues to team members
3. Add to project board
4. Start with P0 issues (MVP blockers)
