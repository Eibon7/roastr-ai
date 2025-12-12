# Legacy → V2 Official Mapping

**Generated:** 2025-12-11  
**Commit:** a01d8bcc  
**Sources:** system-map-v2.yaml, docs/nodes-v2/*, scripts/shared/legacy-ids.js, docs/CI-V2/ROA-323-FINAL-MIGRATION-REPORT.md


## 1. Legacy → V2 Official Mapping

| Legacy ID | V2 ID | Scope | Source |
| --- | --- | --- | --- |
| roast | roasting-engine | Node | system-map-v2.yaml |
| shield | shield-engine | Node | system-map-v2.yaml |
| social-platforms | integraciones-redes-sociales | Node | system-map-v2.yaml |
| billing | billing-integration | Node | system-map-v2.yaml |


## 2. Legacy IDs with no V2 equivalent
- plan-features
- persona
- cost-control
- queue-system
- multi-tenant
- analytics
- trainer
- guardian

## 3. Worker & Queue Migration Summary
- generate_reply → generate_roast  
- billing → billing_update  
- post_response → social_posting

## 4. Script Migration Summary
- get-label-mapping  
- resolve-graph  
- legacy-ids  
- check-system-map-drift  
- gdd-cross-validator  
- enrich-gdd-nodes  
- update-integration-status

## 5. Notes & Known Limitations
- 11 orphaned docs en nodes-v2  
- worker style_profile eliminado (legacy sin soporte en SSOT/Spec/system-map)  
- placeholder en SSOT sección 15  
- No existen pseudo-v2 en system-map
