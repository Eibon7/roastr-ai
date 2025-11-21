# Plan: Fix Database/RLS Issues - Issue #894

**Issue:** #894  
**Título:** Fase 3: Fix Database/RLS Issues - ~15-20 suites  
**Priority:** P1 (MEDIA)  
**Estimación:** 3-4 horas  
**AC Count:** 5 (requiere plan formal)

---

## Estado Actual

### Problema Identificado

Tests de RLS (Row Level Security) fallando con timeout en `beforeAll`:

```
Exceeded timeout of 30000 ms for a hook.
```

**Suite principal:** `tests/integration/multi-tenant-rls-issue-801-crud.test.js`

**Causa Root:**
- Timeout en `createTestTenants()` durante setup
- Probablemente relacionado con:
  - Conexión a Supabase
  - Creación de usuarios auth
  - JWT secret configuration

### Análisis de Dependencias

**Del análisis de `tenantTestUtils.js`:**
- Requiere: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`
- Requiere JWT secret para context switching:
  - Priority 1: `SUPABASE_JWT_SECRET`
  - Priority 2: `JWT_SECRET`
  - Priority 3: crypto.randomBytes (test only)
- `createTestTenants()` crea usuarios auth con `serviceClient.auth.admin.createUser()`

**Estado actual:**
- ✅ `SUPABASE_URL` configurado
- ✅ `SUPABASE_SERVICE_KEY` configurado
- ✅ `SUPABASE_ANON_KEY` configurado
- ❓ `SUPABASE_JWT_SECRET` o `JWT_SECRET` - PENDIENTE VERIFICAR

---

## Acceptance Criteria (5)

- [ ] **AC1:** multi-tenant-rls-issue-801-crud.test.js pasando 100%
- [ ] **AC2:** Todos los tests de RLS funcionando
- [ ] **AC3:** Aislamiento multi-tenant validado
- [ ] **AC4:** Tests ejecutados y verificados
- [ ] **AC5:** Documentación de setup de test database actualizada

---

## Pasos de Implementación

### FASE 1: Diagnóstico Completo ✅ (EN PROGRESO)

**Objetivo:** Identificar causa exacta del timeout

**Acciones:**
1. ✅ Copiar .env al worktree
2. ✅ Verificar credenciales Supabase básicas
3. ⏳ Verificar JWT_SECRET configuration
4. ⏳ Ejecutar test con logs aumentados para ver dónde cuelga
5. ⏳ Revisar conectividad a Supabase

**Archivos involucrados:**
- `.env` (credentials)
- `tests/helpers/tenantTestUtils.js` (setup functions)
- `tests/integration/multi-tenant-rls-issue-801-crud.test.js` (failing test)

**Comandos:**
```bash
# Verificar JWT secret
grep -E "JWT_SECRET|SUPABASE_JWT_SECRET" .env

# Ejecutar test con timeout aumentado + verbose
npm test -- tests/integration/multi-tenant-rls-issue-801-crud.test.js --testTimeout=60000 --verbose
```

---

### FASE 2: Implementación de Fix

**Escenario A: JWT Secret Missing**

Si falta JWT secret:
1. Obtener `SUPABASE_JWT_SECRET` de Supabase dashboard
2. Añadir a `.env`:
   ```bash
   SUPABASE_JWT_SECRET=<secret-from-dashboard>
   ```
3. Re-ejecutar tests

**Escenario B: RLS Policies No Aplicadas**

Si RLS policies no están en test database:
1. Verificar migraciones aplicadas en Supabase
2. Aplicar migraciones faltantes:
   ```sql
   -- Verify RLS enabled
   SELECT schemaname, tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' AND rowsecurity = true;

   -- Verify policies exist
   SELECT schemaname, tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```
3. Aplicar migraciones desde `database/migrations/` si faltan

**Escenario C: Timeout por Rate Limiting**

Si Supabase rate limiting:
1. Aumentar timeout en test: `jest.setTimeout(60000)`
2. Añadir retry logic en `ensureAuthUser()` (ya existe, verificar si suficiente)
3. Considerar test database local si rate limiting persistente

---

### FASE 3: Validación

**Tests a verificar:**
1. `multi-tenant-rls-issue-801-crud.test.js` (principal)
2. `multi-tenant-rls-issue-504-direct.test.js` (SELECT operations)
3. `multi-tenant-rls-issue-412.test.js` (legacy, si aplica)

**Comandos:**
```bash
# Test principal
npm test -- tests/integration/multi-tenant-rls-issue-801-crud.test.js

# Todos los tests RLS
npm test -- tests/integration/multi-tenant-rls-*

# Coverage check
npm run test:coverage -- tests/integration/multi-tenant-rls-*
```

**Criterio de éxito:**
- ✅ 0 tests fallando
- ✅ Setup completa en <30s
- ✅ Todos los AC verificados

---

### FASE 4: Documentación

**Archivos a actualizar:**
1. `docs/nodes/multi-tenant.md` - Actualizar "Testing Infrastructure" section
2. `docs/test-evidence/issue-894/` - Crear evidencia de tests pasando
3. `README.md` - Actualizar si nuevo setup requerido
4. `.env.example` - Añadir SUPABASE_JWT_SECRET si faltaba

**Template de evidencia:**
```markdown
# Test Evidence - Issue #894

**Suite:** multi-tenant-rls-issue-801-crud.test.js  
**Tests:** 55+  
**Status:** ✅ PASSING  
**Execution Time:** <30s

## Results

- AC1: ✅ multi-tenant-rls-issue-801-crud.test.js pasando 100%
- AC2: ✅ Todos los tests de RLS funcionando
- AC3: ✅ Aislamiento multi-tenant validado
- AC4: ✅ Tests ejecutados y verificados
- AC5: ✅ Documentación actualizada

## Screenshots

[Test output showing 55/55 passing]
```

---

## Agentes Relevantes

- **TestEngineer** - Fix de tests + validación coverage
- **Backend Developer** - RLS policies + database setup
- **Documentation Agent** - Actualizar docs

---

## Archivos Afectados

**Tests:**
- `tests/integration/multi-tenant-rls-issue-801-crud.test.js` - Principal
- `tests/helpers/tenantTestUtils.js` - Setup utilities

**Configuración:**
- `.env` - Credentials
- `.env.example` - Template

**Documentación:**
- `docs/nodes/multi-tenant.md` - Testing Infrastructure section
- `docs/test-evidence/issue-894/` - Evidencia

---

## Referencias

- **Issue #801:** CRUD-level RLS Testing  
- **Issue #504:** Coverage Recovery  
- **Issue #412:** Multi-tenant RLS Integration Tests  
- **Node:** `docs/nodes/multi-tenant.md`  
- **GDD Guide:** `docs/GDD-ACTIVATION-GUIDE.md`

---

**Creado:** 2025-11-20  
**Última actualización:** 2025-11-20  
**Status:** 🔄 EN PROGRESO - FASE 1 (Diagnóstico)

