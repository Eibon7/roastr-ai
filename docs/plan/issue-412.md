# Plan de Implementación: Issue #412 - Multi-tenant RLS Integration Tests

**Fecha:** 2025-10-05
**Issue:** #412 - [Integración] Multi-tenant (RLS) – aislamiento estricto
**Priority:** P0 (Critical)
**Type:** test:integration, area:multitenant
**Recomendación Assessment:** FIX

---

## Estado Actual (del Assessment)

### ✅ Implementación Existente
- **Database Schema:** 9 tablas con RLS policies activas
  - `organizations`, `posts`, `comments`, `roasts`, `toxic_comments`
  - `moderation_actions`, `usage_logs`, `subscriptions`, `queue_jobs`
- **Políticas RLS:** Implementadas usando `current_setting('app.current_tenant_id')`
- **Documentación:** `docs/nodes/multi-tenant.md` completo (707 líneas)
- **Supabase Client:** Configurado para RLS

### ❌ Gaps Críticos Identificados
- **CERO tests de integración** para RLS
- No validación de aislamiento tenant_id
- No tests de prevención cross-tenant
- No verificación de auditoría de accesos
- **Riesgo:** Políticas en producción SIN testing

---

## Criterios de Aceptación (5)

| AC # | Criterio | Estado | Plan |
|------|----------|--------|------|
| **AC1** | Listados restringidos por tenant_id automáticamente | ❌ | Tests para GET /api/posts, /api/comments, /api/roasts |
| **AC2** | Accesos directos por ID verifican tenant_id | ❌ | Tests para GET /api/{resource}/:id con tenant correcto/incorrecto |
| **AC3** | Accesos cruzados devuelven 404/forbidden | ❌ | Tests cross-tenant GET/PUT/DELETE → 404/403 |
| **AC4** | Políticas RLS funcionan en todas las tablas críticas | ❌ | Tests en 9 tablas: organizations, posts, comments, roasts, toxic_comments, moderation_actions, usage_logs, subscriptions, queue_jobs |
| **AC5** | Auditoría de intentos de acceso cross-tenant | ❌ | Tests de audit_log para intentos no autorizados |

---

## Diseño de la Solución

### Arquitectura de Tests

```
tests/integration/multi-tenant-rls-issue-412.test.js
├── Setup & Teardown
│   ├── createTestTenants() - Crea Tenant A y Tenant B
│   ├── createTestData() - Seed datos aislados en cada tenant
│   ├── setTenantContext(tenantId) - Cambia contexto Supabase
│   └── cleanupTestData() - Limpia datos de test
│
├── AC1: Listados Restringidos (3 test suites)
│   ├── GET /api/posts - Solo posts del tenant actual
│   ├── GET /api/comments - Solo comments del tenant actual
│   └── GET /api/roasts - Solo roasts del tenant actual
│
├── AC2: Accesos Directos por ID (3 test suites)
│   ├── GET /api/posts/:id - 200 si mismo tenant, 404 si otro
│   ├── GET /api/comments/:id - 200 si mismo tenant, 404 si otro
│   └── GET /api/roasts/:id - 200 si mismo tenant, 404 si otro
│
├── AC3: Prevención Cross-Tenant (3 test suites)
│   ├── GET cross-tenant → 404
│   ├── PUT cross-tenant → 403
│   └── DELETE cross-tenant → 403
│
├── AC4: RLS en 9 Tablas Críticas (9 test suites)
│   ├── organizations RLS
│   ├── posts RLS
│   ├── comments RLS
│   ├── roasts RLS
│   ├── toxic_comments RLS
│   ├── moderation_actions RLS
│   ├── usage_logs RLS
│   ├── subscriptions RLS
│   └── queue_jobs RLS
│
└── AC5: Auditoría Cross-Tenant (2 test suites)
    ├── Audit log captura intentos no autorizados
    └── Alertas en intentos repetidos
```

### Estrategia de Testing

**1. Test Fixtures:**
```javascript
// Tenant A
const tenantA = {
  id: 'tenant-a-uuid',
  name: 'Acme Corp',
  posts: [...],
  comments: [...],
  roasts: [...]
}

// Tenant B
const tenantB = {
  id: 'tenant-b-uuid',
  name: 'Beta Inc',
  posts: [...],
  comments: [...],
  roasts: [...]
}
```

**2. Supabase Context Switching:**
```javascript
async function setTenantContext(tenantId) {
  // Option 1: Via Supabase set_config
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // Option 2: Via JWT claim
  const token = generateJWT({ tenant_id: tenantId });
  supabase.auth.setSession({ access_token: token });
}
```

**3. Test Pattern:**
```javascript
describe('AC1: Listados restringidos por tenant_id', () => {
  it('GET /api/posts returns only Tenant A posts when context is Tenant A', async () => {
    await setTenantContext(tenantA.id);
    const response = await request(app).get('/api/posts');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(tenantA.posts.length);
    expect(response.body.every(p => p.organization_id === tenantA.id)).toBe(true);
  });

  it('GET /api/posts returns only Tenant B posts when context is Tenant B', async () => {
    await setTenantContext(tenantB.id);
    const response = await request(app).get('/api/posts');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(tenantB.posts.length);
    expect(response.body.every(p => p.organization_id === tenantB.id)).toBe(true);
  });
});
```

---

## Fases de Implementación

### FASE 1: Setup de Test Infrastructure (1 hora)

**Archivos a crear:**
- `tests/integration/multi-tenant-rls-issue-412.test.js`
- `tests/helpers/tenantTestUtils.js` (helpers para context switching)

**Tareas:**
1. Configurar test suite base con Jest
2. Implementar `createTestTenants()` - crea 2 orgs en Supabase
3. Implementar `createTestData()` - seed posts, comments, roasts
4. Implementar `setTenantContext(tenantId)` - cambia contexto RLS
5. Implementar `cleanupTestData()` - limpia datos de test
6. Verificar que test framework corre correctamente

**Agente:** Test Engineer Agent

**Validación FASE 1:**
```bash
npm test -- multi-tenant-rls-issue-412 --testNamePattern="Setup"
```

---

### FASE 2: AC1-AC3 - Tests de Aislamiento Básico (2 horas)

**Archivos a modificar:**
- `tests/integration/multi-tenant-rls-issue-412.test.js`

**Tareas:**

**AC1 - Listados Restringidos (30 min):**
1. Test: GET /api/posts - solo posts del tenant actual
2. Test: GET /api/comments - solo comments del tenant actual
3. Test: GET /api/roasts - solo roasts del tenant actual
4. Verificar que cada endpoint filtra por `organization_id` correcto

**AC2 - Accesos Directos por ID (45 min):**
1. Test: GET /api/posts/:id - 200 si mismo tenant, 404 si otro tenant
2. Test: GET /api/comments/:id - 200 si mismo tenant, 404 si otro tenant
3. Test: GET /api/roasts/:id - 200 si mismo tenant, 404 si otro tenant
4. Verificar respuestas correctas (200 vs 404)

**AC3 - Prevención Cross-Tenant (45 min):**
1. Test: Tenant A intenta GET post de Tenant B → 404
2. Test: Tenant A intenta PUT comment de Tenant B → 403
3. Test: Tenant A intenta DELETE roast de Tenant B → 403
4. Verificar códigos HTTP correctos (404 vs 403)

**Agente:** Test Engineer Agent

**Validación FASE 2:**
```bash
npm test -- multi-tenant-rls-issue-412 --testNamePattern="AC1|AC2|AC3"
```

**Criterio de éxito:** 9 tests passing (3 por cada AC)

---

### FASE 3: AC4 - RLS en 9 Tablas Críticas (2 horas)

**Archivos a modificar:**
- `tests/integration/multi-tenant-rls-issue-412.test.js`

**Tareas:**

**Tablas a validar (9):**
1. `organizations` - Solo org actual visible
2. `posts` - Filtrado por organization_id
3. `comments` - Filtrado por organization_id
4. `roasts` - Filtrado por organization_id
5. `toxic_comments` - Filtrado por organization_id
6. `moderation_actions` - Filtrado por organization_id
7. `usage_logs` - Filtrado por organization_id
8. `subscriptions` - Filtrado por organization_id
9. `queue_jobs` - Filtrado por organization_id

**Pattern para cada tabla:**
```javascript
describe('AC4: RLS Policy - {tabla}', () => {
  it('returns only {tabla} for current tenant', async () => {
    await setTenantContext(tenantA.id);
    const { data } = await supabase.from('{tabla}').select('*');

    expect(data.every(row => row.organization_id === tenantA.id)).toBe(true);
  });

  it('blocks access to other tenant {tabla}', async () => {
    await setTenantContext(tenantA.id);
    const { data } = await supabase
      .from('{tabla}')
      .select('*')
      .eq('organization_id', tenantB.id);

    expect(data).toHaveLength(0); // RLS blocks
  });
});
```

**Agente:** Test Engineer Agent

**Validación FASE 3:**
```bash
npm test -- multi-tenant-rls-issue-412 --testNamePattern="AC4"
```

**Criterio de éxito:** 18 tests passing (2 por cada tabla)

---

### FASE 4: AC5 - Auditoría de Accesos Cross-Tenant (1 hora)

**Archivos a modificar:**
- `tests/integration/multi-tenant-rls-issue-412.test.js`
- `database/schema.sql` (si audit_log no existe)

**Tareas:**

**1. Verificar tabla audit_log (15 min):**
```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  attempted_tenant_id UUID, -- Tenant que intentó acceder
  result VARCHAR(20) NOT NULL, -- 'success' | 'blocked'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**2. Tests de auditoría (45 min):**
```javascript
describe('AC5: Auditoría de accesos cross-tenant', () => {
  it('logs unauthorized cross-tenant access attempts', async () => {
    // Tenant A intenta acceder a post de Tenant B
    await setTenantContext(tenantA.id);
    await request(app).get(`/api/posts/${tenantB.posts[0].id}`);

    // Verificar audit_log
    const { data: logs } = await supabase
      .from('audit_log')
      .select('*')
      .eq('action', 'cross_tenant_access_attempt')
      .eq('tenant_id', tenantA.id)
      .eq('attempted_tenant_id', tenantB.id);

    expect(logs).toHaveLength(1);
    expect(logs[0].result).toBe('blocked');
  });

  it('triggers alert on repeated cross-tenant attempts', async () => {
    // Simular 5 intentos cross-tenant
    for (let i = 0; i < 5; i++) {
      await setTenantContext(tenantA.id);
      await request(app).get(`/api/posts/${tenantB.posts[i].id}`);
    }

    // Verificar alerta generada
    const { data: alerts } = await supabase
      .from('security_alerts')
      .select('*')
      .eq('tenant_id', tenantA.id)
      .eq('alert_type', 'repeated_cross_tenant_attempts');

    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('high');
  });
});
```

**Agente:** Test Engineer Agent

**Validación FASE 4:**
```bash
npm test -- multi-tenant-rls-issue-412 --testNamePattern="AC5"
```

**Criterio de éxito:** 2 tests passing

---

### FASE 5: Validación Suite Completa (30 min)

**Tareas:**
1. Ejecutar suite completa de tests:
   ```bash
   npm test -- multi-tenant-rls-issue-412
   ```
2. Verificar todos los tests pasan (29 total):
   - Setup/Teardown: OK
   - AC1: 3 tests passing
   - AC2: 3 tests passing
   - AC3: 3 tests passing
   - AC4: 18 tests passing (9 tablas × 2 tests)
   - AC5: 2 tests passing
3. Generar coverage report:
   ```bash
   npm test -- multi-tenant-rls-issue-412 --coverage
   ```
4. Validar que no hay regresiones en otras suites

**Validación FASE 5:**
```bash
npm test -- multi-tenant-rls # Full suite
npm test -- billing # Verificar no regresiones
npm test -- shield # Verificar no regresiones
```

**Criterio de éxito:**
- ✅ 29/29 tests passing (100%)
- ✅ No regresiones en otras suites
- ✅ Coverage > 80% en helpers y test utils

---

### FASE 6: Evidencias y Documentación GDD (30 min)

**Archivos a crear/modificar:**
- `docs/test-evidence/issue-412/tests-passing.txt`
- `docs/test-evidence/issue-412/SUMMARY.md`
- `docs/nodes/multi-tenant.md`

**Tareas:**

**1. Generar evidencias (15 min):**
```bash
# Crear directorio
mkdir -p docs/test-evidence/issue-412

# Guardar resultados
npm test -- multi-tenant-rls-issue-412 > docs/test-evidence/issue-412/tests-passing.txt

# Generar coverage
npm test -- multi-tenant-rls-issue-412 --coverage --coverageDirectory=docs/test-evidence/issue-412/coverage
```

**2. Crear SUMMARY.md (10 min):**
```markdown
# Issue #412 - Multi-tenant RLS Integration Tests - Evidencias

**Fecha:** 2025-10-05
**Status:** ✅ COMPLETADO
**Tests:** 29/29 passing (100%)

## Resumen
[Tabla de ACs con resultados]

## Test Breakdown
[Detalle de cada suite]

## RLS Policies Validated
[9 tablas con políticas validadas]

## Security Validation
[Auditoría y prevención cross-tenant]
```

**3. Actualizar multi-tenant.md (5 min):**
- Añadir sección "Tests de Integración RLS"
- Referenciar evidencias en `docs/test-evidence/issue-412/`
- Actualizar "Última actualización" con fecha
- Verificar "Agentes Relevantes" incluye Test Engineer

**Validación FASE 6:**
```bash
# Validar GDD
node scripts/resolve-graph.js --validate

# Verificar multi-tenant.md actualizado
cat docs/nodes/multi-tenant.md | grep -A 10 "Tests de Integración"
```

---

### FASE 7: Commit y PR (30 min)

**Tareas:**

**1. Crear commit (15 min):**
```bash
git add tests/integration/multi-tenant-rls-issue-412.test.js \
        tests/helpers/tenantTestUtils.js \
        docs/test-evidence/issue-412/ \
        docs/nodes/multi-tenant.md \
        docs/plan/issue-412.md \
        docs/assessment/issue-412.md

git commit -m "test: Add comprehensive RLS integration tests - Issue #412

### Multi-tenant RLS Validation

**Tests:** 29/29 passing (100%)

**Coverage:**
- AC1: Listados restringidos por tenant_id (3 tests)
- AC2: Accesos directos verifican tenant_id (3 tests)
- AC3: Accesos cruzados → 404/forbidden (3 tests)
- AC4: RLS en 9 tablas críticas (18 tests)
- AC5: Auditoría cross-tenant (2 tests)

**Files Created:**
- tests/integration/multi-tenant-rls-issue-412.test.js (500+ lines)
- tests/helpers/tenantTestUtils.js (helper functions)

**Documentation:**
- docs/test-evidence/issue-412/ - Test results + summary
- docs/nodes/multi-tenant.md - Updated with test evidence
- docs/assessment/issue-412.md - Assessment report
- docs/plan/issue-412.md - Implementation plan

### RLS Policies Validated (9 tables)
✅ organizations, posts, comments, roasts, toxic_comments
✅ moderation_actions, usage_logs, subscriptions, queue_jobs

### Security Validation
✅ Tenant isolation enforced
✅ Cross-tenant access blocked (404/403)
✅ Audit logging functional
✅ No data leaks detected

### GDD Compliance
✅ system-map.yaml validated
✅ multi-tenant.md synchronized
✅ Agentes Relevantes updated
✅ Graph validation passing

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**2. Push y crear PR (15 min):**
```bash
git push -u origin fix/issue-412-rls-tests

gh pr create --title "Add Comprehensive RLS Integration Tests - Issue #412" --body "$(cat docs/plan/issue-412-pr-template.md)"
```

**3. Cerrar issue:**
```bash
gh issue close 412 --comment "✅ Issue #412 COMPLETADO - RLS Integration Tests

**Tests:** 29/29 passing (100%)
**PR:** #XXX
**Evidencias:** docs/test-evidence/issue-412/SUMMARY.md"
```

---

## Agentes a Usar

| Fase | Agente Principal | Agentes Secundarios |
|------|-----------------|---------------------|
| FASE 0 | Task Assessor | - |
| FASE 1 | Test Engineer | general-purpose (búsqueda) |
| FASE 2 | Test Engineer | - |
| FASE 3 | Test Engineer | - |
| FASE 4 | Test Engineer | Back-end Dev (audit_log) |
| FASE 5 | Orchestrator | - |
| FASE 6 | Documentation Agent | Orchestrator |
| FASE 7 | Orchestrator | - |

---

## Archivos Afectados

### Nuevos
- `tests/integration/multi-tenant-rls-issue-412.test.js` (500+ líneas)
- `tests/helpers/tenantTestUtils.js` (100+ líneas)
- `docs/test-evidence/issue-412/tests-passing.txt`
- `docs/test-evidence/issue-412/SUMMARY.md`
- `docs/test-evidence/issue-412/coverage/` (coverage reports)
- `docs/plan/issue-412.md` (este plan)
- `docs/assessment/issue-412.md` (assessment)

### Modificados
- `docs/nodes/multi-tenant.md` (añadir sección Tests)
- `database/schema.sql` (si audit_log falta)
- `docs/system-validation.md` (auto-generado)

### Referencias
- `database/schema.sql` (RLS policies existentes)
- `docs/nodes/multi-tenant.md` (arquitectura)

---

## Criterios de Validación Final

### Tests
- [ ] 29/29 tests passing (100%)
- [ ] AC1: 3 tests - listados restringidos ✅
- [ ] AC2: 3 tests - accesos directos verifican tenant_id ✅
- [ ] AC3: 3 tests - cross-tenant → 404/403 ✅
- [ ] AC4: 18 tests - RLS en 9 tablas ✅
- [ ] AC5: 2 tests - auditoría cross-tenant ✅

### Seguridad
- [ ] No data leaks entre tenants
- [ ] RLS policies enforce isolation
- [ ] Cross-tenant access blocked
- [ ] Audit logs capture violations

### GDD
- [ ] `node scripts/resolve-graph.js --validate` passing
- [ ] multi-tenant.md actualizado con evidencias
- [ ] Agentes Relevantes sincronizados
- [ ] Evidencias en docs/test-evidence/issue-412/

### PR
- [ ] Commit con mensaje completo
- [ ] PR con descripción detallada
- [ ] Tests passing en CI
- [ ] Issue #412 cerrado con referencia a PR

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Supabase RLS no funciona en tests | Media | Alto | Usar cliente Supabase con service_role key para bypass RLS en setup, usar anon key para tests |
| Context switching no cambia tenant | Media | Alto | Implementar helper `setTenantContext()` con verificación de `current_setting()` |
| audit_log tabla no existe | Baja | Medio | Verificar schema.sql, crear tabla si falta |
| Tests lentos (>2min) | Media | Bajo | Usar beforeAll para seed, cleanup solo al final |

---

## Tiempo Estimado Total

| Fase | Tiempo Estimado | Acumulado |
|------|----------------|-----------|
| FASE 1: Setup | 1h | 1h |
| FASE 2: AC1-AC3 | 2h | 3h |
| FASE 3: AC4 | 2h | 5h |
| FASE 4: AC5 | 1h | 6h |
| FASE 5: Validación | 30min | 6.5h |
| FASE 6: Evidencias | 30min | 7h |
| FASE 7: Commit/PR | 30min | 7.5h |

**Total:** ~7.5 horas

---

## Referencias

- **Issue:** https://github.com/Eibon7/roastr-ai/issues/412
- **Assessment:** `docs/assessment/issue-412.md`
- **Multi-tenant Node:** `docs/nodes/multi-tenant.md`
- **Database Schema:** `database/schema.sql`
- **GDD Guide:** `docs/GDD-ACTIVATION-GUIDE.md`

---

**Plan creado:** 2025-10-05
**Orchestrator:** Claude Code
**Next Step:** Ejecutar FASE 1 - Setup de Test Infrastructure
