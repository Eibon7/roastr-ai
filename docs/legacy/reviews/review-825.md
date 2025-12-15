# CodeRabbit Review #825 - Plan

## Análisis

- **Critical: 1** - Feature broken (entitlementsService model/rqc_mode missing)
- **Major: 2** - Documentation consistency, E2E coverage gaps
- **Minor: 5** - Style, wording, metadata duplication

### Por Issue:

1. **src/services/entitlementsService.js:907-934** | Critical | Feature broken | Root cause: Polar plan mapping incomplete (missing `model`, `rqc_mode`)
2. **docs/nodes/billing.md:6-22** | Major | Docs consistency | Root cause: Duplicate metadata blocks, unclear Polar vs Stripe scope
3. **database/migrations/027_polar_subscriptions.sql:26-27** | Major | Data integrity | Root cause: Missing `updated_at` auto-update trigger
4. **tests/integration/polar-flow-e2e.test.js:72-80** | Major | Test coverage | Root cause: Webhook signature validation never tested
5. **docs/nodes/observability.md:10-11** | Minor | Docs alignment | Missing refs in Version History
6. **docs/sync-reports/pr-804-sync.md:13-17** | Minor | Style | Non-neutral tone
7. **docs/nodes/social-platforms.md:842-844** | Minor | Style | Hyphenation
8. **docs/nodes/billing.md:6-9** | Minor | Refactor | Metadata duplication

## GDD

- Nodos: billing, cost-control, multi-tenant (entitlements afectan RLS)
- Actualizar: billing.md (Polar primary clarification), cost-control.md ("Agentes Relevantes" si se invoca TestEngineer)

## Agentes

- Invocar: TestEngineer (para test case webhook signature), Guardian (security: webhook signature gap, SQL trigger missing)
- Receipts: docs/agents/receipts/cursor-test-engineer-{timestamp}.md, cursor-guardian-{timestamp}.md
- SKIP: TaskAssessor (no AC ≥3, fixes directos), FrontendDev (no UI)

## Archivos

- Mencionados:
  - src/services/entitlementsService.js
  - database/migrations/027_polar_subscriptions.sql
  - tests/integration/polar-flow-e2e.test.js
  - tests/unit/services/entitlementsService-polar.test.js (añadir asserts)
  - docs/nodes/billing.md
  - docs/nodes/observability.md
  - docs/sync-reports/pr-804-sync.md
  - docs/nodes/social-platforms.md
- Dependientes:
  - src/middleware/usageEnforcement.js (verifica model/rqc_mode)
  - src/routes/polarWebhook.js (webhook signature)
- Tests:
  - Unit: entitlementsService-polar.test.js (añadir asserts model/rqc_mode)
  - Integration: polar-flow-e2e.test.js (añadir caso webhook signature)

## Estrategia

- Orden:
  1. Critical: entitlementsService model/rqc_mode (bloquea features pagas)
  2. Major: SQL trigger, webhook signature test, docs billing.md
  3. Minor: docs style/alignment
- Commits:
  1. `fix: Add model and rqc_mode to Polar plan mapping (Critical)`
  2. `feat: Add updated_at trigger to polar_subscriptions table`
  3. `test: Add webhook signature validation E2E test`
  4. `docs: Consolidate billing.md metadata and clarify Polar vs Stripe`
  5. `docs: Minor style fixes (observability, sync-reports, social-platforms)`
- Tests:
  - `npm test tests/unit/services/entitlementsService-polar.test.js`
  - `npm test tests/integration/polar-flow-e2e.test.js`
  - `npm test` (full suite)

## Éxito

- [ ] 100% resuelto (0 pending)
- [ ] Tests: 0 failures
- [ ] Coverage: ≥90%
- [ ] GDD health ≥87
- [ ] CodeRabbit: 0 comentarios
