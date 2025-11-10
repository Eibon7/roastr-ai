# CodeRabbit Review - Aplicar con Máxima Calidad (OPTIMIZADO)

**Versión:** 2.0 (Optimizado para Cursor Rules + GDD + Agents)
**Última actualización:** 2025-01-XX

---

## 🎯 FASE 0 - Assessment Obligatorio (ANTES de cualquier acción)

**⚠️ CRÍTICO: Esta fase es OBLIGATORIA y debe ejecutarse PRIMERO.**

### 1. Leer CodeRabbit Lessons

```bash
# Leer patrones conocidos para evitar repetición
@docs/patterns/coderabbit-lessons.md
```

**Regla:** Identificar si los comentarios de CodeRabbit siguen patrones documentados. Si ≥2 comentarios coinciden con un patrón → actualizar `coderabbit-lessons.md` después de aplicar fixes.

### 2. Detectar Nodos GDD Afectados

**Workflow automático:**

```bash
# Detectar nodos desde archivos modificados en review
node scripts/cursor-agents/auto-gdd-activation.js --from-review <review-id>

# O manualmente desde archivos mencionados:
node scripts/resolve-graph.js <nodos-detectados>
```

**Ejemplo:** Si review menciona `src/services/shieldService.js` → nodos: `shield.md`, `multi-tenant.md`

### 3. Leer Nodos GDD Resueltos (NO spec.md completo)

```
En Cursor Chat: @docs/nodes/shield.md @docs/nodes/multi-tenant.md
```

**Regla:** NUNCA cargar spec.md completo. Solo nodos resueltos relevantes.

### 4. Detectar Agentes Necesarios

```bash
# Detección automática de triggers
node scripts/cursor-agents/detect-triggers.js
```

**Mapeo automático:**
- Security issues → Guardian
- Test coverage → TestEngineer
- Frontend changes → FrontendDev
- Architecture → TaskAssessor (si AC ≥3)

**Regla:** Generar receipt para cada agente invocado (o SKIPPED con justificación).

---

## 📋 FASE 1 - Planning Obligatorio

**Crear:** `docs/plan/review-{id}.md`

### Estructura del Plan

1. **Análisis por Severidad:**
   - Critical → Major → Minor → Nit
   - Agrupar por tipo: bugs / architecture / security / tests / documentation
   - Para cada issue: archivo, línea, tipo, impacto, root cause

2. **GDD Nodes Afectados:**
   - Lista de nodos (ya resueltos en FASE 0)
   - Qué sección del nodo se actualiza
   - Si cambia arquitectura → actualizar "Agentes Relevantes"

3. **Agentes Asignados:**
   - Lista de agentes a invocar (según detección FASE 0)
   - Justificación si se SKIPEA algún agente requerido
   - Receipts a generar: `docs/agents/receipts/cursor-{agent}-{timestamp}.md`

4. **Archivos Afectados:**
   - Lista completa de archivos mencionados en review
   - Dependientes (buscar con `grep` o `codebase_search`)
   - Tests relacionados (unit, integration, E2E)

5. **Estrategia de Implementación:**
   - Orden de ejecución (Critical primero)
   - Agrupación de commits (por severidad o por archivo)
   - Testing plan (qué tests ejecutar, qué verificar)

6. **Criterios de Éxito:**
   - 100% comentarios resueltos (CERO pending)
   - Tests pasando (0 failures)
   - Coverage mantiene/sube (≥90% o threshold especificado)
   - 0 regresiones
   - GDD health ≥87
   - CodeRabbit: 0 comentarios

**⚠️ NO PROCEDER sin plan guardado.**

---

## 🔧 FASE 2 - Aplicación por Severidad

### Critical/Major (Security)

**Workflow:**
1. Invocar Guardian agent (si no se detectó automáticamente):
   ```bash
   node scripts/guardian-gdd.js --full
   ```
2. Security Audit Skill (auto-activada):
   - Buscar patrón en codebase completo (no solo archivo mencionado)
   - Tests de explotación (si aplica)
   - Verificar políticas RLS
3. Generar receipt: `docs/agents/receipts/cursor-guardian-{timestamp}.md`

### Major (Architecture)

**Workflow:**
1. Refactorizar (NO parches temporales)
2. Actualizar GDD nodes afectados:
   - Actualizar sección relevante
   - Añadir a "Agentes Relevantes" si se invocó agente
   - Validar: `node scripts/validate-gdd-runtime.js --full`
3. Tests de integración para verificar arquitectura
4. Actualizar spec.md SOLO si cambia contrato público (API, interfaces)

### Performance

**Workflow:**
1. Medir ANTES (benchmark o métricas existentes)
2. Aplicar fix
3. Medir DESPUÉS
4. Test de performance (si aplica)
5. Documentar con números concretos

### Code Quality

**Workflow:**
1. Aplicar sugerencia de CodeRabbit
2. Buscar patrón similar en TODA la codebase (no solo donde CodeRabbit lo marcó)
3. Aplicar consistency en todos los lugares encontrados
4. Verificar con `grep` o `codebase_search`

**Ejemplo:**
```bash
# Si CodeRabbit dice "use const instead of let"
grep -rn "let " src/ | grep -v "node_modules"
# Aplicar fix en TODOS los lugares encontrados
```

### Test Coverage

**Workflow:**
1. Invocar TestEngineer agent (si no se detectó automáticamente)
2. Test Generation Skill (auto-activada):
   - Tests significativos (happy path + error + edge cases)
   - Evidencias visuales si UI afectada
   - Coverage report: `npm run test:coverage`
3. Generar receipt: `docs/agents/receipts/cursor-test-engineer-{timestamp}.md`

---

## 🚫 Reglas NO NEGOCIABLES

### ❌ Prohibido

- Quick fixes que oculten problemas arquitecturales
- "Lo arreglamos después" (deuda técnica intencional)
- Modificar tests para pasar sin fix real
- Cargar spec.md completo (solo nodos resueltos)
- Saltar FASE 0 assessment
- Commit sin tests si hay código nuevo
- Merge sin completion validation

### ✅ Obligatorio

- Refactorizar si arquitectura señalada (no parches)
- Buscar patrón en TODA la codebase (no solo donde CodeRabbit lo marcó)
- Seguir SOLID principles
- Actualizar GDD nodes si cambio arquitectura
- Actualizar "Agentes Relevantes" en nodos si se invoca agente
- Actualizar spec.md SOLO si cambio contratos públicos
- Leer `docs/patterns/coderabbit-lessons.md` en FASE 0
- Generar receipts para agentes invocados (o SKIPPED con justificación)
- Ejecutar comandos REALES de verificación (no asumir)

---

## ✅ FASE 3 - Validación Completa (verification-before-completion-skill)

**⚠️ CRÍTICO: Ejecutar comandos REALES. NO asumir resultados.**

### 1. Tests Completos

```bash
# Ejecutar suite completa
npm test

# Verificar exit code (debe ser 0)
echo $?  # Debe ser 0

# Si fallan → arreglar ANTES de continuar
```

### 2. Coverage Report

```bash
# Generar coverage
npm run test:coverage

# Verificar threshold (≥90% o especificado)
# Actualizar nodos GDD con Coverage Source: auto
```

### 3. GDD Validations

```bash
# Runtime validation
node scripts/validate-gdd-runtime.js --full
# Debe mostrar: 🟢 HEALTHY

# Health score (debe ≥87)
node scripts/score-gdd-health.js --ci
# Debe pasar (exit 0)

# Drift prediction (debe <60 risk)
node scripts/predict-gdd-drift.js --full
# Debe mostrar: 🟢 LOW RISK
```

### 4. CodeRabbit Verification

```bash
# Review completo
npm run coderabbit:review

# Verificar: 0 comentarios pendientes
# Si hay comentarios → aplicar fixes → re-commit → re-verificar
```

### 5. Generar Evidencias

```bash
# Crear directorio de evidencias
mkdir -p docs/test-evidence/review-{id}

# Generar SUMMARY.md con patterns (NO cronología)
# Template: docs/templates/SUMMARY-template.md
```

### 6. Completion Validation (ANTES de merge)

```bash
# Validación completa de completion
npm run validate:completion -- --pr={pr-number}

# Exit codes:
# 0 = 100% completo, ready to merge
# 1 = Incompleto, continuar implementación
# 2 = Critical blockers (tests/CI failing), NO mergear
```

**Regla:** NUNCA marcar como "complete" sin ejecutar este comando y verificar exit code = 0.

---

## 📝 FASE 4 - Commit & Push

### Commit Message Template

```bash
git commit -m "$(cat <<'EOF'
fix: Apply CodeRabbit Review #{id} - <título>

### Issues Addressed

- [Severity] Brief description (file:line)
- [Severity] Brief description (file:line)

### Changes

- Module: what changed
- Module: what changed

### Testing

- Added X tests, Coverage: A% → B%
- All tests passing (X/X)

### GDD

- Updated nodes: [list o N/A]
- Health score: X (≥87 required)
- Agentes Relevantes: [list o N/A]

### Agents

- Invoked: [list o N/A]
- Receipts: docs/agents/receipts/cursor-*-{timestamp}.md

EOF
)"
```

### Push

```bash
git push origin <branch>
```

**Regla:** NO mergear PR. Solo push. Usuario decide cuándo mergear.

---

## 📊 Entregables Finales

### Checklist de Completitud

- [ ] Review #{id} completo: X Critical, Y Major, Z Minor resueltos
- [ ] N archivos modificados, M tests añadidos, Coverage: A%→B%
- [ ] GDD: [nodos actualizados o N/A], Health ≥87, Drift <60
- [ ] spec.md: [sección actualizada o N/A] (solo si cambio contrato público)
- [ ] Evidencias en `docs/test-evidence/review-{id}/`
- [ ] SUMMARY.md generado con patterns (NO cronología)
- [ ] Receipts generados: `docs/agents/receipts/cursor-*-{timestamp}.md`
- [ ] CodeRabbit: 0 comentarios pendientes (verificado con `npm run coderabbit:review`)
- [ ] Tests: 0 failures (verificado con `npm test`)
- [ ] Completion validation: exit code 0 (verificado con `npm run validate:completion`)
- [ ] Push confirmado: origin/{branch} (commit: {hash})

---

## 🎯 Criterios de Calidad

### Requisitos NO NEGOCIABLES

1. ✅ **100% comentarios resueltos** (CERO pending)
2. ✅ **Soluciones arquitecturales** (no parches temporales)
3. ✅ **Coverage mantiene/sube** (≥90% o threshold especificado)
4. ✅ **0 regresiones** (todos los tests pasando)
5. ✅ **GDD health ≥87** (verificado con `score-gdd-health.js --ci`)
6. ✅ **GDD drift <60** (verificado con `predict-gdd-drift.js --full`)
7. ✅ **CodeRabbit: 0 comentarios** (verificado con `npm run coderabbit:review`)
8. ✅ **Completion validation: exit code 0** (verificado con `npm run validate:completion`)
9. ✅ **Código production-ready** (sin console.logs, TODOs, código muerto)
10. ✅ **Receipts generados** para todos los agentes invocados

### Mentalidad

**Calidad > Velocidad. Producto monetizable, no proyecto de instituto.**

---

## 📚 Referencias

- **Quality Standards:** `docs/QUALITY-STANDARDS.md`
- **CodeRabbit Lessons:** `docs/patterns/coderabbit-lessons.md`
- **GDD Activation Guide:** `docs/GDD-ACTIVATION-GUIDE.md`
- **Agent Manifest:** `agents/manifest.yaml`
- **SUMMARY Template:** `docs/templates/SUMMARY-template.md`
- **Completion Validation:** `docs/policies/completion-validation.md`

---

## 🔄 Actualización de CodeRabbit Lessons

**Si ≥2 comentarios coinciden con patrón conocido:**

1. Identificar patrón en review
2. Añadir sección en `docs/patterns/coderabbit-lessons.md`:
   - ❌ Mistake (ejemplo del review)
   - ✅ Fix (solución aplicada)
   - Rules to apply
   - Occurrences (actualizar estadísticas)
3. Commit: `docs(patterns): Add CodeRabbit lesson - <patrón>`

**Meta:** Reducir tasa de repetición <10% en todos los patrones.

---

**Versión:** 2.0 (Optimizado)
**Última actualización:** 2025-01-XX
**Mantenido por:** Orchestrator Agent


