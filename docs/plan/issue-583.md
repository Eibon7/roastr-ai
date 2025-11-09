# Issue #583: Update RLS Integration Tests for Current Schema

**Priority:** P0 (CRITICAL)
**Estimación:** 2-3 días
**Status:** Open
**Node:** multi-tenant
**Related Tests:** tests/integration/multi-tenant-rls-issue-412.test.js, tests/integration/database/security.test.js

---

## Estado Actual

### Problema Identificado

Los tests de integración de RLS (Row Level Security) están desactualizados y NO cubren todas las tablas que actualmente tienen RLS habilitado en el schema de la base de datos.

**Cobertura actual:**
- `multi-tenant-rls-issue-412.test.js`: Solo testea `posts`, `comments`, `roasts` (3 tablas)
- `database/security.test.js`: Solo testea `roasts_metadata`, `roastr_style_preferences`, `analysis_usage` (3 tablas adicionales)

**Total actual:** 6 tablas testeadas de ~35 tablas con RLS

### Tablas con RLS NO Testeadas

#### Categoría 1: Usage & Billing (CRÍTICO - afecta facturación)
1. ✅ `usage_counters` - Credits v2
2. ✅ `credit_consumption_log` - Audit de créditos
3. ✅ `usage_resets` - Tier validation
4. ✅ `pending_plan_changes` - Tier validation
5. ✅ `usage_tracking` - Enhanced usage tracking
6. ✅ `usage_limits` - Usage limits per org
7. ✅ `usage_alerts` - Usage alerts
8. ✅ `usage_records` - Schema.sql
9. ✅ `monthly_usage` - Schema.sql
10. ✅ `account_entitlements` - Entitlements system

#### Categoría 2: Core Tables (ALTO - funcionalidad crítica)
11. ✅ `integration_configs` - Platform credentials (SECURITY)
12. ✅ `responses` - Generated responses
13. ✅ `user_behaviors` - Shield tracking
14. ✅ `shield_actions` - Shield moderation
15. ✅ `organizations` - Organization data
16. ✅ `organization_members` - Membership

#### Categoría 3: User Data (MEDIO - privacidad usuario)
17. ✅ `user_style_profile` - User preferences
18. ✅ `user_subscriptions` - Subscription data
19. ✅ `user_activities` - Activity log
20. ✅ `account_deletion_requests` - GDPR

#### Categoría 4: Admin & Features (BAJO - funcionalidad avanzada)
21. ✅ `feature_flags` - Feature management
22. ✅ `admin_audit_logs` - Admin actions
23. ✅ `audit_logs` - Security audit
24. ✅ `rqc_reviews` - RQC system
25. ✅ `plan_limits` - Plan configuration
26. ✅ `plan_limits_audit` - Plan changes audit
27. ✅ `job_queue` - Worker jobs

---

## Acceptance Criteria

### AC1: Actualizar multi-tenant-rls-issue-412.test.js

**Objetivo:** Extender tests actuales para incluir todas las tablas críticas de multi-tenant

**Tablas a añadir:**
- [ ] `organizations` - Verificar aislamiento por tenant
- [ ] `organization_members` - Verificar membresía
- [ ] `integration_configs` - SECURITY: Verificar aislamiento de credentials
- [ ] `usage_records` - Verificar aislamiento de billing
- [ ] `monthly_usage` - Verificar summaries por tenant
- [ ] `responses` - Verificar respuestas generadas
- [ ] `user_behaviors` - Verificar tracking Shield
- [ ] `user_activities` - Verificar activity log

**Tests a implementar por tabla:**
- Listados restringidos por organization_id
- Accesos directos por ID verifican organization_id
- Accesos cruzados devuelven 404/forbidden (RLS blocks)

### AC2: Actualizar database/security.test.js

**Objetivo:** Extender tests de seguridad para cubrir nuevas tablas de tiers y usage

**Tablas a añadir:**
- [ ] `usage_counters` - RLS by user_id
- [ ] `credit_consumption_log` - RLS by user_id
- [ ] `usage_resets` - RLS by user_id
- [ ] `pending_plan_changes` - RLS by user_id
- [ ] `user_style_profile` - RLS by user_id
- [ ] `user_subscriptions` - RLS by user_id
- [ ] `account_deletion_requests` - RLS by user_id

**Tests a implementar:**
- RLS WITH CHECK policies (prevent cross-tenant insert/update)
- User isolation (users can only access their own data)
- Service role bypass (verify supabaseServiceClient works)

### AC3: Nuevos Tests para Tablas de Uso Organizacional

**Objetivo:** Crear tests específicos para tablas con RLS organizacional complejo

**Archivo:** `tests/integration/usage-rls.test.js` (nuevo)

**Tablas:**
- [ ] `usage_tracking` - org_isolation policy
- [ ] `usage_limits` - org_isolation policy
- [ ] `usage_alerts` - org_isolation policy

**Tests a implementar:**
- Organization members can access org data
- Non-members cannot access org data
- Owner can access all org data
- Admin can access org data
- Regular member can access org data (según permisos)

### AC4: Tests para Tablas de Admin y Features

**Objetivo:** Verificar RLS en tablas de administración

**Archivo:** `tests/integration/admin-rls.test.js` (nuevo)

**Tablas:**
- [ ] `feature_flags` - RLS policies
- [ ] `admin_audit_logs` - RLS policies
- [ ] `audit_logs` - RLS policies
- [ ] `plan_limits` - RLS policies
- [ ] `plan_limits_audit` - RLS policies

### AC5: Tests para Shield Actions

**Objetivo:** Verificar RLS en acciones de Shield

**Archivo:** `tests/integration/shield-rls.test.js` (nuevo)

**Tablas:**
- [ ] `shield_actions` - org_isolation policy
- [ ] Verificar que solo org puede ver sus acciones Shield
- [ ] Verificar que otras orgs no pueden ver acciones de otros

### AC6: Documentación y Evidencia

- [ ] Actualizar `docs/nodes/multi-tenant.md` con nueva cobertura de tests
- [ ] Generar evidencia de tests en `docs/test-evidence/issue-583/`
- [ ] Actualizar coverage report
- [ ] Añadir tabla de cobertura RLS por tabla

---

## Pasos de Implementación

### Paso 1: Preparación (30 min)

1. Leer `docs/nodes/multi-tenant.md` - Entender políticas RLS
2. Leer `docs/patterns/coderabbit-lessons.md` - Patrones de tests
3. Revisar helpers: `tests/helpers/tenantTestUtils.js`
4. Identificar patrones de RLS en schema

### Paso 2: Actualizar multi-tenant-rls-issue-412.test.js (3-4 horas)

**Implementar tests para 8 tablas:**

```javascript
// Template para cada tabla
describe('AC1: Listados restringidos - <table_name>', () => {
  test('GET /<table> returns only Tenant A data', async () => {
    const { data, error } = await testClient
      .from('<table_name>')
      .select('*');

    expect(error).toBeNull();
    expect(data.every(r => r.organization_id === tenantA.id)).toBe(true);
  });
});

describe('AC2: Accesos directos - <table_name>', () => {
  test('GET /<table>/:id returns 200 for own tenant', async () => {
    // ...
  });

  test('GET /<table>/:id returns null for other tenant', async () => {
    // ...
  });
});

describe('AC3: Accesos cruzados - <table_name>', () => {
  test('Tenant A cannot read Tenant B data', async () => {
    // ...
  });
});
```

**Tablas:** organizations, organization_members, integration_configs, usage_records, monthly_usage, responses, user_behaviors, user_activities

### Paso 3: Actualizar database/security.test.js (2-3 horas)

**Implementar tests para 7 tablas user-scoped:**

```javascript
describe('RLS WITH CHECK Policies - <table_name>', () => {
  test('should prevent cross-user data insertion', async () => {
    // Try to insert data for another user
    const { error } = await supabaseServiceClient
      .from('<table_name>')
      .insert({
        user_id: anotherUserId, // Different user
        // ... other fields
      });

    expect(error).toBeTruthy();
    expect(error.message).toContain('policy');
  });

  test('should allow valid same-user operations', async () => {
    // Insert should succeed for same user
    const { error } = await supabaseServiceClient
      .from('<table_name>')
      .insert({
        user_id: testUserId,
        // ... other fields
      });

    expect(error).toBeNull();
  });
});
```

**Tablas:** usage_counters, credit_consumption_log, usage_resets, pending_plan_changes, user_style_profile, user_subscriptions, account_deletion_requests

### Paso 4: Crear usage-rls.test.js (2 horas)

**Implementar tests para usage tables con org_isolation:**

```javascript
describe('Usage Tracking RLS Integration Tests', () => {
  let orgA, orgB, memberOrgA, nonMember;

  beforeAll(async () => {
    // Setup orgs and members
  });

  describe('usage_tracking - org_isolation', () => {
    test('Organization members can access org data', async () => {
      // Test member access
    });

    test('Non-members cannot access org data', async () => {
      // Test isolation
    });
  });

  // Similar para usage_limits, usage_alerts
});
```

### Paso 5: Crear admin-rls.test.js (1-2 horas)

**Implementar tests para admin tables:**

```javascript
describe('Admin Tables RLS Integration Tests', () => {
  describe('feature_flags', () => {
    test('should have proper RLS policies', async () => {
      // Test RLS
    });
  });

  // Similar para admin_audit_logs, audit_logs, plan_limits
});
```

### Paso 6: Crear shield-rls.test.js (1 hora)

**Implementar tests para Shield actions:**

```javascript
describe('Shield Actions RLS Integration Tests', () => {
  test('Organization can only see their own shield actions', async () => {
    // Test isolation
  });
});
```

### Paso 7: Validación y Documentación (1-2 horas)

1. Ejecutar suite completa: `npm test -- rls`
2. Verificar coverage: `npm run test:coverage`
3. Generar evidencia: screenshots + logs
4. Actualizar `multi-tenant.md`
5. Crear reporte de cobertura

---

## Estructura de Archivos

```
tests/integration/
├── multi-tenant-rls-issue-412.test.js       [UPDATE - +8 tablas]
├── database/
│   └── security.test.js                     [UPDATE - +7 tablas]
├── usage-rls.test.js                        [NEW - 3 tablas]
├── admin-rls.test.js                        [NEW - 5 tablas]
└── shield-rls.test.js                       [NEW - 1 tabla]

docs/test-evidence/issue-583/
├── rls-coverage-report.md                   [NEW]
├── multi-tenant-tests.log                   [NEW]
├── usage-rls-tests.log                      [NEW]
├── admin-rls-tests.log                      [NEW]
└── shield-rls-tests.log                     [NEW]
```

---

## Risks & Mitigations

### Risk 1: Test Data Cleanup
**Riesgo:** Tests failing debido a data residual de tests anteriores
**Mitigación:** Usar unique IDs por test, cleanup en afterAll hooks

### Risk 2: RLS Policies Incorrectas
**Riesgo:** Descubrir que algunas tablas NO tienen RLS o tienen políticas incorrectas
**Mitigación:** Documentar findings, crear issues separadas para fixes de schema

### Risk 3: Service Role vs User Role
**Riesgo:** Confundir cuando usar supabaseServiceClient vs supabaseClient
**Mitigación:** Documentar claramente en cada test qué client usar y por qué

---

## Definition of Done

- [ ] ✅ Todos los tests pasan al 100%
- [ ] ✅ Coverage ≥90% para archivos de tests RLS
- [ ] ✅ 24+ tablas con RLS testeadas (vs 6 actuales)
- [ ] ✅ Documentación actualizada en multi-tenant.md
- [ ] ✅ Evidencia generada en docs/test-evidence/issue-583/
- [ ] ✅ 0 comentarios CodeRabbit
- [ ] ✅ CI/CD passing
- [ ] ✅ Self-review completado

---

## Notas

- Este issue NO modifica schema, solo tests
- Si se descubren issues de RLS en schema, crear issues separadas
- Priorizar tablas de billing/security (Categoría 1 y 2) sobre admin (Categoría 4)
- Usar patrones existentes de `multi-tenant-rls-issue-412.test.js` como template

---

**Generado:** 2025-11-09
**Autor:** Orchestrator Agent
**Aprobado por:** Pending review
