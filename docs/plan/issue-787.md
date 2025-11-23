# Issue #787: RLS Integration Tests Phase 2 - Usage, Admin, Shield

**Estado Actual**

- ✅ Issue #583 cubrió AC1-AC2 con tests actualizados para 15 tablas.
- ✅ **COMPLETADO:** Tests de integración RLS implementados para tablas de uso, admin y shield (AC3-AC5).
- ✅ 34 tests pasando: 15 (usage-rls) + 10 (admin-rls) + 9 (shield-rls).
- ✅ Migraciones aplicadas en Supabase para todas las tablas.
- ✅ Evidencia generada en `docs/test-evidence/issue-787/summary.md`.

**Pasos de Implementación**

1. ✅ Revisar `tests/helpers/tenantTestUtils.js` y patrones de `multi-tenant-rls-issue-412.test.js` para reutilizar utilidades y asegurar limpieza de datos.
2. ✅ Implementar `tests/integration/usage-rls.test.js` cubriendo `usage_tracking`, `usage_limits` y `usage_alerts` con escenarios: listado por tenant, accesos directos, bloqueos cross-tenant.
3. ✅ Implementar `tests/integration/admin-rls.test.js` verificando RLS para `feature_flags`, `admin_audit_logs`, `audit_logs`, `plan_limits`, `plan_limits_audit` incluyendo casos para admin vs non-admin y aislamiento organizacional.
4. ✅ Implementar `tests/integration/shield-rls.test.js` validando que `shield_actions` respeta aislamiento por organización y que accesos cruzados fallan.
5. ✅ Ejecutar suites relevantes (`npm test -- usage-rls`, etc.) y ajustar fixtures/helper si aparecen brechas (por ejemplo, seeds inexistentes, políticas faltantes).
6. ✅ Actualizar documentación de evidencia (`docs/test-evidence/issue-787/`) y nodos GDD afectados (`multi-tenant.md`, posiblemente `shield.md`, `cost-control.md`) con nueva cobertura y agentes relevantes.
7. ⏳ Validar GDD (`node scripts/validate-gdd-runtime.js --full`, `node scripts/score-gdd-health.js --ci`) y generar receipts requeridos.

**Agentes y Skills Planeados**

- `TestEngineer` (obligatorio por cambios en `tests/` y cobertura RLS).
- `Guardian` si se detectan hallazgos críticos de seguridad/RLS (por ahora preventivo, confirmar tras implementación).
- Skills automáticas: `test-generation-skill`, `gdd-sync-skill`, `verification-before-completion-skill`.

**Archivos Impactados**

- Nuevos: `tests/integration/usage-rls.test.js`, `tests/integration/admin-rls.test.js`, `tests/integration/shield-rls.test.js`.
- Posibles actualizaciones: `tests/helpers/tenantTestUtils.js`, `docs/nodes/multi-tenant.md`, `docs/test-evidence/issue-787/*`.

**Validación y Evidencia**

- Ejecutar `npm test -- usage-rls`, `npm test -- admin-rls`, `npm test -- shield-rls`, y suite completa relacionada si procede.
- Asegurar cobertura ≥90% para nuevas suites (verificar `coverage-summary.json`).
- Generar reporte en `docs/test-evidence/issue-787/summary.md` con resultados y comandos ejecutados.
- Correr validaciones GDD y registrar receipts según política.
