# ROA-323 — Migración final de IDs legacy v1 → v2 (SSOT aligned)

## 1. Legacy IDs eliminados
- Colas: `generate_reply` → `generate_roast`, `billing` → `billing_update`, `post_response` → `social_posting`.
- Workers legacy referenciados: GenerateReplyWorker, BillingWorker, PublisherWorker (registrados ahora con colas v2; archivos legacy se mantienen).
- Pseudo-v2 eliminados de tooling: roast-generation, shield-moderation, platform-integrations, plan-configuration, persona-config, cost-management, queue-management, tenant-management, monitoring, analytics-dashboard, model-training, guardian.

## 2. Mapeo final legacy → v2
| Legacy | v2 oficial | Ámbito |
| --- | --- | --- |
| generate_reply | generate_roast | Queue / worker |
| billing (cola) | billing_update | Queue / worker |
| post_response | social_posting | Queue / worker |
| roast | roasting-engine | Nodo |
| shield | shield-engine | Nodo |
| billing (nodo) | billing-integration | Nodo |
| social-platforms | integraciones-redes-sociales | Nodo |
| frontend-dashboard | frontend-admin | Nodo |
| observability | observabilidad | Nodo |
| plan-features / cost-control / queue-system / multi-tenant / analytics / trainer / persona | Sin mapeo v2 (se detectan como legacy/no mapping) |

## 3. Cambios aplicados
- Workers/colas: WorkerManager, GenerateReplyWorker, BillingWorker, PublisherWorker, AnalyzeToxicityWorker, CLI (queue-manager, worker-status, start-workers) alineados a generate_roast, billing_update, social_posting.
- Tests (unit/integration/e2e/helpers) actualizados a nuevas colas.
- Tooling/validadores: detect-legacy-ids, validate-node-ids, validate-workers-ssot, resolve-graph, get-label-mapping, auto-gdd-activation, gdd-cross-validator, enrich-gdd-nodes, mapping docs; pseudo-v2 removidos.
- Docs: LEGACY-TO-V2-MAPPING actualizado; reporte actual agregado.

## 4. Validadores ejecutados (final)
- detect-legacy-ids: ✅ sin legacy.
- validate-node-ids: ✅ sin errores.
- validate-v2-doc-paths: ✅.
- validate-workers-ssot: ✅ con warnings conocidos (falta sección 8.1 en SSOT).
- check-system-map-drift: ✅ con warnings de archivos orphaned en docs/nodes-v2 (no tocados por alcance).
- validate-ssot-health: ✅ warning por placeholder en SSOT (existente).
- calculate-gdd-health-v2: ✅ health 100.

## 5. Riesgos y pendientes conocidos
- Warnings deliberadamente no resueltos: archivos orphaned en docs/nodes-v2 (11) y placeholder en SSOT sección 15.
- No se modificó system-map-v2.yaml ni los docs orphaned.
- No se renombraron archivos legacy de workers; solo se alinearon colas/IDs.

## 6. Cumplimiento SSOT Governance
- Solo se usaron IDs oficiales de system-map-v2.yaml y SSOT-V2; sin invención de IDs.
- Pseudo-v2 eliminados de tooling.
- Detector y validador ajustados para no marcar texto de dominio como legacy, solo IDs/colas/worker registrations.



