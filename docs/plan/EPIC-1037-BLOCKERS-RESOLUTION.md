# Plan de Resolución de Bloqueadores - Epic #1037

**Fecha:** 2025-11-26  
**Status:** En progreso  
**Estrategia:** Rápidos primero, luego tests

---

## 📊 Estado Actual

### Bloqueadores Pendientes

1. ✅ **Epic ACs** - Verificar y marcar checkboxes (RÁPIDO - 5 min)
2. ⚠️ **CodeRabbit Comments** - Resolver comentarios pendientes (MEDIO - 30 min)
3. ⚠️ **GDD Coverage Integrity** - 15 violaciones por falta de coverage data (MEDIO - se resuelve con tests)
4. ❌ **Test Coverage ≥90%** - Escribir tests unitarios (LENTO - 2-3 horas)
5. ❌ **Tests E2E** - Escribir tests Playwright (LENTO - 1-2 horas)

---

## 🎯 Orden de Ejecución

### FASE 1: Rápidos (15-30 min)

#### 1.1. Verificar Epic ACs ✅

**Acciones:**
- [ ] Revisar Epic #1037 en GitHub
- [ ] Verificar que todas las features están implementadas:
  - [x] Todas las rutas de admin funcionando
  - [x] CRUD completo de usuarios
  - [x] Gestión de feature flags, planes, tonos
  - [x] Dashboard de métricas funcionando
  - [x] Solo accesible por admin (AdminGuard)
  - [x] 100% responsive (shadcn/ui es responsive por defecto)
- [ ] Marcar checkboxes en GitHub issue

**Resultado esperado:** Epic #1037 con todos los ACs marcados ✅

---

#### 1.2. Resolver Comentarios CodeRabbit

**Acciones:**
- [ ] Revisar PR #1076 para comentarios no resueltos
- [ ] Verificar que docstrings ya están agregados (se hizo anteriormente)
- [ ] Resolver cualquier comentario pendiente
- [ ] Marcar comentarios como resueltos

**Resultado esperado:** 0 comentarios pendientes en PR

---

### FASE 2: Coverage Integrity (30 min - automático con tests)

#### 2.1. GDD Coverage Integrity Violations

**Problema:** 15 violaciones por "missing_coverage_data"

**Causa:** No hay `coverage-summary.json` en el worktree porque:
- Tests del frontend no están escritos aún
- No se ha ejecutado `npm run test:coverage` en el frontend

**Solución:** Se resolverá automáticamente cuando:
1. Escribamos tests unitarios (FASE 3)
2. Ejecutemos `npm run test:coverage` en frontend
3. El archivo `coverage/coverage-summary.json` se genere
4. GDD sincronice los datos

**Acción inmediata:** Documentar que se resolverá con tests

**Resultado esperado:** Violaciones resueltas después de FASE 3

---

### FASE 3: Tests de Cobertura (2-3 horas)

#### 3.1. Tests Unitarios - Prioridad Alta

**Archivos a testear (más críticos primero):**

1. **`frontend/src/lib/api.ts`** (ApiClient)
   - [ ] Constructor y configuración
   - [ ] Métodos GET, POST, PUT, PATCH, DELETE
   - [ ] Manejo de errores (ApiError)
   - [ ] CSRF token handling
   - [ ] Auth token management

2. **`frontend/src/lib/auth-context.tsx`** (AuthContext)
   - [ ] AuthProvider rendering
   - [ ] Login function
   - [ ] Logout function
   - [ ] verifyAuth function
   - [ ] Demo mode handling

3. **`frontend/src/lib/guards/admin-guard.tsx`** (AdminGuard)
   - [ ] Protección de rutas admin
   - [ ] Redirección si no es admin

4. **`frontend/src/pages/auth/login.tsx`** (LoginPage)
   - [ ] Renderizado del formulario
   - [ ] Submit handling
   - [ ] Demo login button

**Target:** 90%+ coverage en estos archivos

#### 3.2. Tests Unitarios - Prioridad Media

5. **Componentes de páginas admin:**
   - [ ] `pages/admin/users.tsx`
   - [ ] `pages/admin/feature-flags.tsx`
   - [ ] `pages/admin/plans.tsx`
   - [ ] `pages/admin/tones.tsx`
   - [ ] `pages/admin/metrics.tsx`

**Target:** 80%+ coverage por componente

**Resultado esperado:** `npm run test:coverage` muestra ≥90% coverage global

---

### FASE 4: Tests E2E (1-2 horas)

#### 4.1. Tests Playwright - Flujos Críticos

**Flujos a testear:**

1. **Login Flow:**
   - [ ] Login normal (mock backend)
   - [ ] Login demo mode
   - [ ] Redirección a dashboard después de login

2. **Admin Dashboard:**
   - [ ] Navegación entre secciones
   - [ ] Verificación de datos mockeados

3. **User Management:**
   - [ ] Listar usuarios
   - [ ] Toggle admin status (mock)
   - [ ] Toggle active status (mock)

4. **Feature Flags:**
   - [ ] Listar flags
   - [ ] Toggle flag (mock)

5. **Plans & Tones:**
   - [ ] Ver configuración
   - [ ] Editar (mock)

**Resultado esperado:** Todos los tests E2E pasando

---

## 📋 Checklist Final

Antes de marcar PR como "ready to merge":

- [ ] Epic ACs marcados ✅
- [ ] CodeRabbit: 0 comentarios pendientes
- [ ] Test Coverage: ≥90%
- [ ] Tests E2E: Todos pasando
- [ ] GDD Health: ≥87 (ya tenemos 90.3 ✅)
- [ ] GDD Coverage Integrity: Resuelto (automático con tests)
- [ ] CI/CD: Todos los checks pasando

---

## 🎯 Estrategia de Ejecución

**Orden propuesto:**
1. ✅ Epic ACs (5 min)
2. ✅ CodeRabbit comments (30 min)
3. ⏸️ Tests unitarios (2-3 horas)
4. ⏸️ Tests E2E (1-2 horas)
5. ✅ GDD Coverage Integrity (automático)

**Total estimado:** 4-5 horas

---

## 📝 Notas Técnicas

### Coverage Integrity

Las violaciones de GDD Coverage Integrity son **esperadas** en este momento porque:
- El frontend es nuevo y no tiene tests aún
- No hay `coverage-summary.json` generado
- Una vez que escribamos tests y generemos coverage, las violaciones se resolverán automáticamente

**No es un bloqueador crítico** - se resolverá en FASE 3.

### Test Coverage Target

- **Global:** ≥90%
- **Archivos críticos (api.ts, auth-context):** ≥95%
- **Componentes admin:** ≥80%

### Playwright Setup

El setup de Playwright ya está configurado. Solo necesitamos escribir los tests.

---

## 🚀 Siguiente Paso

**Inmediato:** Verificar y marcar Epic ACs en GitHub.

