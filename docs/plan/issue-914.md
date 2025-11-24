# Plan de Migración: Tests RLS a supabase-test (Issue #914)

**Objetivo:** Migrar ~120 tests RLS de Supabase real a `supabase-test` para obtener velocidad (10-30x más rápido), aislamiento total y reducción de costos.

**Status:** 🟡 En progreso
**Priority:** P1
**Fase Actual:** Fase 1 - Alto Valor

---

## 📋 Estado Actual

**Tests RLS existentes usando Supabase real (JWT context switching):**

| Archivo                                     | Tests | Líneas | Velocidad       | Cobertura             |
| ------------------------------------------- | ----- | ------ | --------------- | --------------------- |
| `shield-rls.test.js`                        | ~15   | 206+   | Lento (network) | Shield actions        |
| `admin-rls.test.js`                         | ~10   | ~150   | Lento           | Admin operations      |
| `usage-rls.test.js`                         | ~8    | ~120   | Lento           | Usage tracking        |
| `sponsors-rls.test.js`                      | ~5    | ~80    | Lento           | Sponsor protection    |
| `multi-tenant-rls-issue-412.test.js`        | 30    | 489    | Lento           | Multi-tenant core     |
| `multi-tenant-rls-issue-504-direct.test.js` | 17    | 287    | Lento           | Direct RLS validation |
| `multi-tenant-rls-issue-801-crud.test.js`   | 55+   | 950+   | Lento           | CRUD operations       |

**Total:** ~140 tests, ~2,282+ líneas

**Tests nuevos usando `supabase-test` (DB local temporal):**

| Archivo                           | Tests | Líneas | Velocidad         | Cobertura        |
| --------------------------------- | ----- | ------ | ----------------- | ---------------- |
| `tests/rls/shield.test.js`        | 3     | 221    | 10-30x más rápido | Shield basic     |
| `tests/rls/tenants.test.js`       | ~5    | ~200   | 10-30x más rápido | Multi-tenant     |
| `tests/rls/subscriptions.test.js` | ~4    | ~150   | 10-30x más rápido | Subscriptions    |
| `tests/rls/roast.test.js`         | ~3    | ~180   | 10-30x más rápido | Roast generation |
| `tests/rls/persona.test.js`       | ~2    | ~120   | 10-30x más rápido | Persona          |

**Total:** 13 tests, ~871 líneas (Issue #912)

---

## 🎯 Patrón de Migración

### ❌ Viejo (JWT context switching - LENTO):

```javascript
// tests/integration/shield-rls.test.js
const {
  createTestTenants,
  setTenantContext,
  testClient,
  serviceClient
} = require('../helpers/tenantTestUtils');

beforeAll(async () => {
  const tenants = await createTestTenants(); // Crea users, orgs en Supabase REAL
  tenantA = tenants.tenantA;
});

test('Shield RLS isolation', async () => {
  await setTenantContext(tenantA.userId, tenantA.id); // JWT sign + auth.setSession

  const { data: actions } = await testClient // ← Network call a Supabase
    .from('shield_actions')
    .select('*')
    .eq('organization_id', tenantA.id);

  expect(actions.length).toBe(1);
});
```

**Problemas:**

- ❌ Requiere Supabase real (slow network calls)
- ❌ JWT signing + auth.setSession overhead
- ❌ Tests comparten DB (potential interference)
- ❌ Costos de bandwidth + recursos

### ✅ Nuevo (supabase-test - RÁPIDO):

```javascript
// tests/rls/shield-complete.test.js
const { getConnections } = require('supabase-test');
const { getTestConfig } = require('../setup/supabase-test.config');
const { createMigrationsSeed } = require('./helpers/load-migrations');

let db, pg, teardown;

beforeAll(async () => {
  const config = getTestConfig();
  const result = await getConnections(config, [
    createMigrationsSeed() // Carga todas las migraciones en DB temporal local
  ]);

  db = result.db; // DB temporal aislada
  pg = result.pg; // Client raw para setup
  teardown = result.teardown;
});

afterAll(async () => {
  await teardown(); // Limpia DB temporal
});

beforeEach(() => {
  db.beforeEach(); // Savepoint para aislamiento
});

afterEach(() => {
  db.afterEach(); // Rollback a savepoint
});

test('Shield RLS isolation', async () => {
  // Setup usando pg (sin RLS)
  const userAResult = await pg.query(`
    INSERT INTO users (id, email, plan)
    VALUES (gen_random_uuid(), 'user-a@test.com', 'pro')
    RETURNING id;
  `);
  const userAId = userAResult.rows[0].id;

  const orgAResult = await pg.query(
    `
    INSERT INTO organizations (id, name, slug, owner_id, plan_id)
    VALUES (gen_random_uuid(), 'Org A', 'org-a', $1, 'pro')
    RETURNING id;
  `,
    [userAId]
  );
  const orgAId = orgAResult.rows[0].id;

  const shieldResult = await pg.query(
    `
    INSERT INTO shield_actions (id, organization_id, action_type, content_hash, platform, reason)
    VALUES (gen_random_uuid(), $1, 'block', 'hash-a', 'twitter', 'toxic')
    RETURNING id;
  `,
    [orgAId]
  );

  // Simular contexto JWT (NO network call)
  db.setContext({
    role: 'authenticated',
    'jwt.claims.user_id': userAId,
    'jwt.claims.org_id': orgAId
  });

  // Query con RLS enforced (local DB, NO network)
  const actions = await db.query(
    `
    SELECT id FROM shield_actions WHERE organization_id = $1;
  `,
    [orgAId]
  );

  expect(actions.rows.length).toBe(1);
});
```

**Ventajas:**

- ✅ 10-30x más rápido (local DB, sin network)
- ✅ Aislamiento total (DB temporal por suite)
- ✅ Savepoints por test (rollback automático)
- ✅ Sin costos de bandwidth
- ✅ No requiere Supabase real

---

## 🗺️ Fases de Migración

### Fase 1: Alto Valor (1-2 semanas) ← **ACTUAL**

**Objetivo:** Migrar tests críticos con mayor impacto.

**Tests a migrar:**

1. ✅ `shield-rls.test.js` (15 tests) → `tests/rls/shield-complete.test.js`
2. ✅ `admin-rls.test.js` (10 tests) → `tests/rls/admin.test.js`
3. ✅ `usage-rls.test.js` (8 tests) → `tests/rls/usage.test.js`

**Acceptance Criteria:**

- [ ] Tests migrados ejecutan 10-30x más rápido (measure con `time npm test`)
- [ ] Coverage ≥90% (igual o mejor que original)
- [ ] Tests originales marcados como deprecated pero mantenidos
- [ ] Documentación actualizada (`docs/test-evidence/issue-914/phase-1.md`)

**Archivos afectados:**

- `tests/rls/shield-complete.test.js` (NEW)
- `tests/rls/admin.test.js` (NEW)
- `tests/rls/usage.test.js` (NEW)
- `tests/integration/shield-rls.test.js` (DEPRECATED)
- `tests/integration/admin-rls.test.js` (DEPRECATED)
- `tests/integration/usage-rls.test.js` (DEPRECATED)
- `docs/nodes/multi-tenant.md` (update test locations)

### Fase 2: Multi-tenant Básico (1 semana)

**Tests a migrar:**

1. `multi-tenant-rls-issue-504-direct.test.js` (17 tests)

**Archivos afectados:**

- `tests/rls/multi-tenant-direct.test.js` (NEW)
- `tests/integration/multi-tenant-rls-issue-504-direct.test.js` (DEPRECATED)

### Fase 3: Multi-tenant Completo (2-3 semanas)

**Tests a migrar:**

1. `multi-tenant-rls-issue-412.test.js` (30 tests)
2. `multi-tenant-rls-issue-801-crud.test.js` (55+ tests)

**Archivos afectados:**

- `tests/rls/multi-tenant-full.test.js` (NEW)
- `tests/rls/multi-tenant-crud.test.js` (NEW)
- `tests/integration/multi-tenant-rls-issue-412.test.js` (DEPRECATED)
- `tests/integration/multi-tenant-rls-issue-801-crud.test.js` (DEPRECATED)

### Fase 4: Limpieza (1 semana)

**Tests a migrar:**

1. `sponsors-rls.test.js` (5 tests)

**Limpieza:**

- Eliminar tests legacy deprecated
- Actualizar CI/CD para usar solo `tests/rls/`
- Documentación final

**Archivos afectados:**

- `tests/rls/sponsors.test.js` (NEW)
- Eliminar todos los `*-rls.test.js` de `tests/integration/`
- `.github/workflows/*.yml` (update test paths)

---

## 📊 Métricas de Éxito

**KPIs:**

- **Reducción de tiempo:** ≥80% (10-30x más rápido)
- **Reducción de costos:** 100% (sin bandwidth a Supabase)
- **Mejora de confiabilidad:** ≥50% (menos flakiness por network)
- **Mejora de mantenibilidad:** ≥30% (código más simple)

**Mediciones (Fase 1):**

```bash
# Antes (Supabase real)
time npm test -- tests/integration/shield-rls.test.js
# Ejemplo: 45s (network overhead + JWT signing)

# Después (supabase-test)
time npm test -- tests/rls/shield-complete.test.js
# Esperado: 2-4s (local DB, sin network)
```

---

## 🧪 Checklist de Migración (por archivo)

Para cada test migrado:

1. **Setup:**
   - [ ] Usar `getConnections()` con `getTestConfig()`
   - [ ] Cargar migraciones con `createMigrationsSeed()`
   - [ ] Configurar `beforeAll/afterAll` con `teardown()`
   - [ ] Configurar `beforeEach/afterEach` con savepoints

2. **Data Setup:**
   - [ ] Reemplazar `createTestTenants()` con raw `pg.query()`
   - [ ] Crear users, orgs, data con INSERT directo (sin RLS)
   - [ ] Almacenar IDs para uso en tests

3. **Test Logic:**
   - [ ] Reemplazar `setTenantContext()` con `db.setContext()`
   - [ ] Reemplazar `testClient.from()` con `db.query()`
   - [ ] Mantener mismas assertions

4. **Deprecation:**
   - [ ] Añadir comment al archivo viejo: `/** @deprecated Use tests/rls/<name>.test.js (Issue #914) */`
   - [ ] Mantener tests viejos (no eliminar hasta Fase 4)

5. **Documentation:**
   - [ ] Actualizar `docs/nodes/multi-tenant.md` (test locations)
   - [ ] Añadir test evidence en `docs/test-evidence/issue-914/`
   - [ ] Actualizar coverage en nodos GDD afectados

6. **Validation:**
   - [ ] `npm test -- tests/rls/<name>.test.js` (100% passing)
   - [ ] Measure: `time npm test -- tests/rls/<name>.test.js` (≥10x faster)
   - [ ] Coverage: `npm run test:coverage` (≥90%)

---

## 🛠️ Helper Utilities

**Existing:**

- ✅ `tests/setup/supabase-test.config.js` - Config helper
- ✅ `tests/rls/helpers/load-migrations.js` - Migration loader

**To Create:**

- 🔜 `tests/rls/helpers/setup-test-data.js` - Common data setup patterns
- 🔜 `tests/rls/helpers/rls-assertions.js` - Common RLS assertion helpers

---

## 🔄 Workflow

**Por cada test migrado:**

```bash
# 1. Crear nuevo test en tests/rls/
cp tests/rls/shield.test.js tests/rls/shield-complete.test.js

# 2. Adaptar usando patrón supabase-test
# (ver template arriba)

# 3. Ejecutar y validar
npm test -- tests/rls/shield-complete.test.js

# 4. Medir velocidad
time npm test -- tests/integration/shield-rls.test.js  # Antes
time npm test -- tests/rls/shield-complete.test.js     # Después

# 5. Marcar viejo como deprecated
# Añadir: /** @deprecated Use tests/rls/shield-complete.test.js (Issue #914) */

# 6. Actualizar docs
# - docs/nodes/multi-tenant.md
# - docs/test-evidence/issue-914/phase-1.md
```

---

## 📚 Referencias

- **Issue #912:** Implementación inicial de supabase-test
- **Issue #914:** Esta migración
- **Docs:**
  - `docs/GDD-ACTIVATION-GUIDE.md` - GDD workflow
  - `docs/TESTING-GUIDE.md` - Testing standards
  - `docs/nodes/multi-tenant.md` - Multi-tenant node
  - `docs/patterns/coderabbit-lessons.md` - Patrones aprendidos

---

## 🚀 Next Steps (Fase 1)

1. ✅ Plan creado (este archivo)
2. 🔄 Migrar `shield-rls.test.js` → `tests/rls/shield-complete.test.js`
3. ⏳ Migrar `admin-rls.test.js` → `tests/rls/admin.test.js`
4. ⏳ Migrar `usage-rls.test.js` → `tests/rls/usage.test.js`
5. ⏳ Validar métricas (10-30x más rápido)
6. ⏳ Documentar resultados

---

**Maintained by:** Test Engineer
**Review Frequency:** Weekly during migration
**Last Updated:** 2025-11-24
**Version:** 1.0.0
