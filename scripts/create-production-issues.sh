#!/bin/bash
# Script to create all 12 production-ready issues in GitHub
# Run this from your local terminal with gh CLI installed

# P0 Issues
gh issue create --title "P0: Implementar campo post_mode (manual/auto) en integration_configs" \
  --label "priority:P0,area:backend" \
  --body-file <(sed -n '/^### Issue #1:/,/^---$/p' ../PRODUCTION-READY-ISSUES.md | tail -n +3 | head -n -1)

gh issue create --title "P0: Implementar niveles de Shield configurables (shield_sensitivity)" \
  --label "priority:P0,area:backend" \
  --body-file <(sed -n '/^### Issue #2:/,/^---$/p' ../PRODUCTION-READY-ISSUES.md | tail -n +3 | head -n -1)

gh issue create --title "P0: Separar enabled de shield_enabled para granularidad" \
  --label "priority:P0,area:backend,ux" \
  --body-file <(sed -n '/^### Issue #3:/,/^---$/p' ../PRODUCTION-READY-ISSUES.md | tail -n +3 | head -n -1)

gh issue create --title "P0: Soportar múltiples cuentas del mismo tipo (multi-account)" \
  --label "priority:P0,area:backend,database" \
  --body-file <(sed -n '/^### Issue #4:/,/^---$/p' ../PRODUCTION-READY-ISSUES.md | tail -n +3 | head -n -1)

# P1 Issues
gh issue create --title "P1: Eliminar 868 console.log y migrar a logger estructurado" \
  --label "priority:P1,area:logging,code-quality" \
  --body-file <(sed -n '/^### Issue #5:/,/^---$/p' ../PRODUCTION-READY-ISSUES.md | tail -n +3 | head -n -1)

gh issue create --title "P1: Implementar revocación de OAuth tokens al eliminar integración" \
  --label "priority:P1,area:security,integrations" \
  --body-file <(sed -n '/^### Issue #6:/,/^---$/p' ../PRODUCTION-READY-ISSUES.md | tail -n +3 | head -n -1)

gh issue create --title "P1: Implementar endpoints de cancelación de suscripción" \
  --label "priority:P1,area:billing" \
  --body-file <(sed -n '/^### Issue #7:/,/^---$/p' ../PRODUCTION-READY-ISSUES.md | tail -n +3 | head -n -1)

# P2 Issues
gh issue create --title "P2: Consolidar servicios duplicados (Shield, Plan, Notifications)" \
  --label "priority:P2,area:refactoring,technical-debt" \
  --body-file <(sed -n '/^### Issue #8:/,/^---$/p' ../PRODUCTION-READY-ISSUES.md | tail -n +3 | head -n -1)

gh issue create --title "P2: Implementar Style Profile Extraction con Feature Flag" \
  --label "priority:P2,area:features,pro-plus" \
  --body-file <(sed -n '/^### Issue #9:/,/^---$/p' ../PRODUCTION-READY-ISSUES.md | tail -n +3 | head -n -1)

gh issue create --title "P2: Migrar de poll-based a event-driven queue system" \
  --label "priority:P2,area:performance,workers" \
  --body-file <(sed -n '/^### Issue #10:/,/^---$/p' ../PRODUCTION-READY-ISSUES.md | tail -n +3 | head -n -1)

# P3 Issues
gh issue create --title "P3: Añadir filtros avanzados a listado de roasts y Shield events" \
  --label "priority:P3,area:frontend,ux" \
  --body-file <(sed -n '/^### Issue #11:/,/^---$/p' ../PRODUCTION-READY-ISSUES.md | tail -n +3 | head -n -1)

gh issue create --title "P3: Implementar GDPR cleanup al eliminar integración" \
  --label "priority:P3,area:privacy,gdpr" \
  --body-file <(sed -n '/^### Issue #12:/,/^---$/p' ../PRODUCTION-READY-ISSUES.md | tail -n +3 | head -n -1)

echo "✅ All 12 production-ready issues created successfully!"
