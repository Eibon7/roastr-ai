# Plan de Resolución de Blockers - PR #1076

**Fecha:** 2025-11-26  
**PR:** #1076 - Epic #1037 Admin Panel  
**Status:** ⚠️ **NO LISTO PARA MERGE** - 5 blockers críticos

---

## 🚨 Blockers Críticos

### 1. ❌ Test Coverage: 0% (Requerido: ≥90%)

**Problema:**

- Frontend tiene solo 3 tests unitarios
- Falta `@vitest/coverage-v8` para generar coverage
- No hay tests para componentes admin

**Solución:**

1. Instalar `@vitest/coverage-v8`
2. Crear tests para:
   - Páginas admin (Users, Metrics, Feature Flags, Plans, Tones)
   - Layouts (AdminShell, AppShell, AuthLayout)
   - Guards (AuthGuard, AdminGuard)
3. Ejecutar `npm run test:coverage` y verificar ≥90%

**Estimado:** 2-3 horas

---

### 2. ❌ Epic ACs Sin Verificar (6 checkboxes)

**Problema:**
Epic #1037 tiene 6 ACs sin marcar:

- [ ] Todas las rutas de admin funcionando
- [ ] CRUD completo de usuarios
- [ ] Gestión de feature flags, planes, tonos
- [ ] Dashboard de métricas funcionando
- [ ] Solo accesible por admin
- [ ] 100% responsive

**Solución:**

1. Verificar manualmente cada AC
2. Probar en navegador cada funcionalidad
3. Marcar checkboxes en Epic #1037
4. Documentar evidencia

**Estimado:** 30 minutos

---

### 3. ❌ CodeRabbit: 4 Comentarios Accionables

**Problema:**
Hay 4 comentarios de CodeRabbit que deben resolverse

**Solución:**

1. Revisar comentarios en PR #1076
2. Resolver cada uno
3. Responder a CodeRabbit

**Estimado:** 1-2 horas (depende de los comentarios)

---

### 4. ❌ E2E Tests Faltantes

**Problema:**

- Infraestructura Playwright lista
- 0 tests E2E escritos

**Solución:**
Crear tests E2E para:

- Admin login flow
- User CRUD operations
- Feature flag toggles
- Navigation entre páginas admin

**Estimado:** 2-3 horas

---

### 5. ❌ GDD Coverage Integrity: 15 Violaciones

**Problema:**

- 15/15 nodos sin datos de cobertura
- GDD validation falla

**Solución:**

1. Ejecutar `npm test --coverage` en backend
2. Ejecutar `npm run test:coverage` en frontend
3. Ejecutar `node scripts/auto-repair-gdd.js --auto-fix`
4. Verificar que violaciones se resuelvan

**Estimado:** 30 minutos

---

## 📋 Plan de Acción Priorizado

### Fase 1: Quick Wins (1-2 horas)

1. ✅ Instalar `@vitest/coverage-v8` en frontend
2. ✅ Verificar y marcar Epic ACs
3. ✅ Resolver GDD coverage violations

### Fase 2: Tests Críticos (3-4 horas)

1. ✅ Crear tests unitarios para componentes admin
2. ✅ Aumentar coverage a ≥90%
3. ✅ Crear tests E2E básicos

### Fase 3: CodeRabbit (1-2 horas)

1. ✅ Revisar y resolver comentarios
2. ✅ Responder a CodeRabbit

---

## 🎯 Criterios de Éxito

**Antes de merge:**

- ✅ Test coverage ≥90%
- ✅ Todos los Epic ACs marcados
- ✅ 0 comentarios CodeRabbit pendientes
- ✅ Tests E2E básicos pasando
- ✅ GDD validation pasando

---

## ⏱️ Tiempo Total Estimado

**Mínimo:** 4-5 horas  
**Realista:** 6-8 horas

---

**Status:** 🔴 **BLOQUEADO** - Resolver blockers antes de merge
