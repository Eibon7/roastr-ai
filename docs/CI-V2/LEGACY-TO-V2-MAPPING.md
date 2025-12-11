# Legacy → V2 Official Mapping

**Generated:** 2025-12-11  
**Commit:** 09c1cb82  
**Sources:** system-map-v2.yaml, docs/nodes-v2/*, scripts/shared/legacy-ids.js, docs/CI-V2/ROA-323-FINAL-MIGRATION-REPORT.md

## Legacy → V2 Official Mapping (system-map only)
| Legacy ID | V2 ID | Scope | Source |
| --- | --- | --- | --- |
| roast | roasting-engine | Node | system-map-v2.yaml |
| shield | shield-engine | Node | system-map-v2.yaml |
| social-platforms | integraciones-redes-sociales | Node | system-map-v2.yaml |
| billing | billing-integration | Node | system-map-v2.yaml |
| frontend-dashboard | frontend-admin | Node | system-map-v2.yaml |
| observability | observabilidad | Node | system-map-v2.yaml |

## Legacy IDs without a V2 equivalent (TBD)
- plan-features (no explicit v2 node/subnode)
- cost-control (no explicit v2 node/subnode)
- queue-system (no explicit v2 node/subnode)
- multi-tenant (handled within infraestructura; no standalone ID)
- analytics (covered by observabilidad; no separate ID)
- trainer (not present in system-map/SSOT)
- persona (managed under analysis-engine; no dedicated node ID)
- guardian (deprecated; must not be recreated)

## Worker/Queue Migration Summary
- Queues: generate_reply → generate_roast; billing → billing_update; post_response → social_posting.
- Official workers (SSOT/system-map): FetchComments, AnalyzeToxicity, GenerateRoast, GenerateCorrectiveReply, ShieldAction, SocialPosting, BillingUpdate, CursorReconciliation, StrikeCleanup.
- Legacy worker files may remain; registrations now use v2 queues/IDs where applicable.

## Script Migration Summary
- Updated to enforce SSOT/system-map IDs only: detect-legacy-ids, validate-node-ids, validate-workers-ssot, resolve-graph, get-label-mapping, auto-gdd-activation, gdd-cross-validator, enrich-gdd-nodes, shared/legacy-ids.
- Pseudo-v2 IDs removed from tooling; mappings restricted to real system-map IDs.

