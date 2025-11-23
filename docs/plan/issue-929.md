# Plan de Implementación - Issue #929

**Issue:** [Coverage] Fase 3.1: Tests para Services de Negocio Críticos (39-74% → 75-85%+)  
**Prioridad:** 🔴 CRÍTICA  
**Esfuerzo Estimado:** 6-8 días  
**AC Count:** 10  
**Labels:** enhancement, high priority, backend

---

## Estado Actual

### Cobertura de Services (Antes)

| Service | Coverage Actual | Target | Gap | Prioridad |
|---------|----------------|--------|-----|-----------|
| shieldService.js | 38.6% | 75%+ | +36.4% | CRÍTICA |
| queueService.js | 39.8% | 75%+ | +35.2% | CRÍTICA |
| authService.js | 68.9% | 85%+ | +16.1% | ALTA |
| costControl.js | 73.8% | 85%+ | +11.2% | MEDIA |

**Impacto esperado en cobertura global:** +5-8%

### Archivos de Test Existentes

**shieldService:**
- `tests/unit/services/shieldService.test.js` (existe, básico)
- `tests/unit/services/shieldService-edge-cases.test.js` (existe)
- Necesita: Expandir con métodos no cubiertos

**queueService:**
- `tests/unit/services/queueService.test.js` (26 tests, básico)
- Cobertura: 11.91% lines (28/235 lines)
- Necesita: Expandir dramáticamente

**authService:**
- Tests existentes NO encontrados en búsqueda
- Necesita: Crear desde cero

**costControl:**
- `tests/unit/services/costControl.test.js` (45 tests)
- Coverage: 73.8% (ya bien)
- Necesita: Edge cases adicionales

---

## Pasos de Implementación

### Fase 1: shieldService.js (38.6% → 75%+) 🔴 CRÍTICA

**Archivos:**
- Expandir: `tests/unit/services/shieldService.test.js`
- Revisar: `tests/unit/services/shieldService-edge-cases.test.js`
- Código: `src/services/shieldService.js`

**Casos a agregar:**
1. **Métodos principales:**
   - `analyzeComment()` - Análisis de toxicidad completo
   - `executeAction()` - Ejecución de acciones Shield
   - `getOffenderHistory()` - Historial de infractores
   - `updateOffenderHistory()` - Actualización de historial

2. **Edge cases:**
   - Comment sin organization_id
   - Toxicity score = null/undefined
   - Platform no soportada
   - API externa falla (Perspective)
   - Recidivism edge cases (0, 1, 10+ offenses)

3. **Seguridad:**
   - Red lines validation
   - Threshold overrides
   - Platform-specific actions
   - Circuit breaker activación

**Objetivo:** 75%+ coverage, ~30 tests adicionales

---

### Fase 2: queueService.js (39.8% → 75%+) 🔴 CRÍTICA

**Archivos:**
- Expandir: `tests/unit/services/queueService.test.js`
- Código: `src/services/queueService.js`

**Casos a agregar:**
1. **Métodos principales:**
   - `addJob()` - Añadir trabajos (v1.2.0 normalized return)
   - `getNextJob()` - Obtener siguiente trabajo con prioridad
   - `completeJob()` - Completar trabajo
   - `failJob()` - Mover a DLQ
   - `retryDLQJob()` - Reintentar desde DLQ
   - `getQueueStats()` - Estadísticas de cola

2. **Redis vs Database fallback:**
   - Redis disponible → usa Redis
   - Redis no disponible → fallback a DB
   - Ambos fallan → error apropiado
   - Distributed locks (acquire/release)

3. **Priority queues:**
   - Priority 1 (critical) primero
   - Priority 5 (low) último
   - Multiple priorities en cola

4. **DLQ handling:**
   - Max retries alcanzado → DLQ
   - Retry con exponential backoff
   - Clear DLQ
   - Get DLQ jobs

**Objetivo:** 75%+ coverage, ~40 tests adicionales

---

### Fase 3: authService.js (68.9% → 85%+) 🟡 ALTA

**Archivos:**
- Crear: `tests/unit/services/authService.test.js`
- Código: `src/services/authService.js`

**Casos a agregar:**
1. **Métodos principales:**
   - `authenticate()` - Autenticación de usuario
   - `validateToken()` - Validación de JWT
   - `refreshToken()` - Refresh token
   - `revokeToken()` - Revocación de token
   - `verifyPermissions()` - Verificación de permisos

2. **Edge cases:**
   - Token expirado
   - Token inválido
   - Token revocado
   - Usuario no existe
   - Usuario deshabilitado

3. **Seguridad:**
   - JWT signature validation
   - Token expiration
   - Rate limiting bypass attempts
   - Organization isolation (RLS)
   - Admin vs user permissions

**Objetivo:** 85%+ coverage, ~35 tests nuevos

---

### Fase 4: costControl.js (73.8% → 85%+) 🟢 MEDIA

**Archivos:**
- Expandir: `tests/unit/services/costControl.test.js`
- Código: `src/services/costControl.js`

**Casos a agregar:**
1. **Edge cases adicionales:**
   - Plan limit exactly at boundary (10, 1000, 5000)
   - Monthly reset logic
   - Concurrent usage increment (race condition)
   - Plan downgrade mid-month
   - Plan upgrade mid-month
   - Invalid organization_id

2. **Lógica de negocio:**
   - Cost calculation accuracy
   - Token tracking per model
   - Resource type validation
   - Organization-level limits

**Objetivo:** 85%+ coverage, ~15 tests adicionales

---

## Agentes a Usar

### TestEngineer (Principal) 🧪
**Trigger:** Cambios en `src/services/` sin tests correspondientes  
**Workflow:**
```bash
# En Cursor Composer (Cmd+I)
@tests/unit/services/ @src/services/shieldService.js
"Generate comprehensive tests for shieldService.js following test-generation-skill.
Cover: main methods, edge cases, security validation, mock external APIs.
Target: 75%+ coverage with 0 failures."
```

### Guardian 🛡️
**Trigger:** Cambios en security-critical services (authService, shieldService)  
**Workflow:**
```bash
node scripts/guardian-gdd.js --full
# Manual audit de tests de seguridad
```

### TaskAssessor 📋
**Ya invocado:** Plan creado (este documento)

---

## Archivos Afectados

### Tests (Nuevos/Modificados)
- ✅ `tests/unit/services/shieldService.test.js` (expandir +30 tests)
- ✅ `tests/unit/services/queueService.test.js` (expandir +40 tests)
- 🆕 `tests/unit/services/authService.test.js` (crear +35 tests)
- ✅ `tests/unit/services/costControl.test.js` (expandir +15 tests)

### Código (No modificar - solo leer)
- `src/services/shieldService.js`
- `src/services/queueService.js`
- `src/services/authService.js`
- `src/services/costControl.js`

### Documentación (Actualizar)
- `docs/nodes/shield.md` (actualizar coverage)
- `docs/nodes/queue-system.md` (actualizar coverage)
- `docs/coverage-improvement-priorities.md` (marcar como completo)
- `docs/test-evidence/issue-929/` (generar evidencias)

---

## Validación Requerida

### Pre-Flight Checklist
- [ ] Leer `docs/patterns/coderabbit-lessons.md` ✅ (FASE 0)
- [ ] Leer nodos GDD: shield.md, queue-system.md ✅ (FASE 0)
- [ ] Plan creado en `docs/plan/issue-929.md` ✅
- [ ] TestEngineer invocado
- [ ] Todos los tests usan mocks (NO llamadas reales)
- [ ] Tests cubren: success + error + edge cases

### Durante Implementación
- [ ] shieldService.js ≥75% coverage
- [ ] queueService.js ≥75% coverage
- [ ] authService.js ≥85% coverage
- [ ] costControl.js ≥85% coverage
- [ ] 0 tests failing (100% passing)
- [ ] Métodos principales cubiertos 100%
- [ ] Edge cases cubiertos
- [ ] Lógica de negocio compleja cubierta
- [ ] Mocks apropiados (sin datos reales)
- [ ] Validación de seguridad (shieldService, authService)

### Pre-Merge Checklist
- [ ] Tests 100% passing: `npm test`
- [ ] Coverage ≥90%: `npm run test:coverage`
- [ ] GDD validado: `node scripts/validate-gdd-runtime.js --full`
- [ ] GDD health ≥87: `node scripts/score-gdd-health.js --ci`
- [ ] CodeRabbit = 0 comentarios: `npm run coderabbit:review`
- [ ] Receipts generados: `docs/agents/receipts/cursor-test-engineer-*.md`
- [ ] Nodos GDD actualizados: "Agentes Relevantes" + coverage
- [ ] Test evidence generado: `docs/test-evidence/issue-929/summary.md`

---

## Blockers Identificados

1. **authService.js ubicación:** Necesito verificar si existe `src/services/authService.js` o si auth está en otro lugar
2. **shieldService dependencies:** Verificar qué servicios externos requiere para mockear apropiadamente
3. **queueService Redis mock:** Necesito mock robusto de Redis + Supabase fallback

---

## Estimación de Tiempo

| Fase | Service | Tiempo | Tests | Complejidad |
|------|---------|--------|-------|-------------|
| 1 | shieldService.js | 2 días | +30 | Alta (seguridad + recidivism) |
| 2 | queueService.js | 2 días | +40 | Alta (Redis + DB fallback + DLQ) |
| 3 | authService.js | 2 días | +35 | Alta (seguridad + JWT) |
| 4 | costControl.js | 1 día | +15 | Media (edge cases) |
| **Total** | **4 services** | **7 días** | **+120 tests** | **CRÍTICA** |

---

## Referencias

- `docs/coverage-improvement-priorities.md` - Estrategia completa
- `docs/nodes/shield.md` - Documentación de Shield
- `docs/nodes/queue-system.md` - Documentación de Queue
- `docs/patterns/coderabbit-lessons.md` - Patrones de testing
- `docs/TESTING-GUIDE.md` - Guía de testing

---

**Creado:** 2025-11-23  
**Estado:** 🟡 PLANNING COMPLETE → READY FOR IMPLEMENTATION  
**Next Step:** Invocar TestEngineer para Fase 1 (shieldService)

