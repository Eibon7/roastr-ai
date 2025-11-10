# Comparación: Prompt Original vs Optimizado

## 📊 Resumen Ejecutivo

El prompt original es **funcional pero incompleto** según las reglas del proyecto. La versión optimizada integra:

- ✅ FASE 0 completa (GDD + Agents + Lessons)
- ✅ Detección automática de agentes
- ✅ Receipts obligatorios
- ✅ Verification-before-completion-skill
- ✅ Completion validation antes de merge
- ✅ Workflow completo de GDD health score

---

## 🔍 Diferencias Clave

### 1. FASE 0 - Assessment Obligatorio

#### ❌ Prompt Original
- Menciona GDD pero no workflow completo
- No menciona `resolve-graph.js`
- No menciona leer nodos resueltos (solo "skill: gdd")
- No menciona `coderabbit-lessons.md` en FASE 0

#### ✅ Prompt Optimizado
- **Workflow completo:**
  1. Leer `coderabbit-lessons.md` PRIMERO
  2. Detectar nodos con `auto-gdd-activation.js`
  3. Resolver con `resolve-graph.js`
  4. Leer SOLO nodos resueltos (NO spec.md completo)
  5. Detectar agentes con `detect-triggers.js`

**Impacto:** Evita cargar spec.md completo y asegura contexto correcto antes de implementar.

---

### 2. Detección de Agentes

#### ❌ Prompt Original
- Menciona "Security Audit Agent" y "Test Engineer Agent" genéricamente
- No menciona detección automática
- No menciona manifest.yaml

#### ✅ Prompt Optimizado
- **Detección automática:**
  ```bash
  node scripts/cursor-agents/detect-triggers.js
  ```
- Mapeo automático: Security → Guardian, Tests → TestEngineer, etc.
- Referencia a `agents/manifest.yaml`

**Impacto:** Usa el sistema de agentes del proyecto en lugar de nombres genéricos.

---

### 3. Receipts Obligatorios

#### ❌ Prompt Original
- No menciona receipts
- No menciona SKIPPED receipts con justificación

#### ✅ Prompt Optimizado
- **Generación obligatoria:**
  - `docs/agents/receipts/cursor-{agent}-{timestamp}.md`
  - O SKIPPED con justificación
- Mencionado en checklist de entregables

**Impacto:** Cumple con política de CI que bloquea merge sin receipts.

---

### 4. Verification Before Completion

#### ❌ Prompt Original
- Menciona "skill: validate" pero no workflow específico
- No menciona ejecutar comandos REALES

#### ✅ Prompt Optimizado
- **Workflow completo con comandos REALES:**
  1. `npm test` (verificar exit code = 0)
  2. `npm run test:coverage` (verificar threshold)
  3. `node scripts/validate-gdd-runtime.js --full`
  4. `node scripts/score-gdd-health.js --ci` (≥87)
  5. `node scripts/predict-gdd-drift.js --full` (<60)
  6. `npm run coderabbit:review` (0 comentarios)
  7. `npm run validate:completion -- --pr={id}` (exit code 0)

**Impacto:** Evita claims sin evidencia. Solo marca "complete" después de verificación real.

---

### 5. Completion Validation

#### ❌ Prompt Original
- No menciona completion validation antes de merge
- No menciona exit codes

#### ✅ Prompt Optimizado
- **Comando obligatorio:**
  ```bash
  npm run validate:completion -- --pr={id}
  ```
- Exit codes documentados:
  - `0` = 100% completo, ready to merge
  - `1` = Incompleto, continuar
  - `2` = Critical blockers, NO mergear

**Impacto:** Previene merge de PRs incompletas (política obligatoria del proyecto).

---

### 6. GDD Health Score Workflow

#### ❌ Prompt Original
- Menciona "GDD health ≥87" pero no workflow completo
- No menciona drift prediction

#### ✅ Prompt Optimizado
- **Workflow completo:**
  1. `validate-gdd-runtime.js --full` (debe HEALTHY)
  2. `score-gdd-health.js --ci` (debe ≥87)
  3. `predict-gdd-drift.js --full` (debe <60 risk)
- Mencionado en validación y entregables

**Impacto:** Asegura GDD saludable antes de merge (requisito del proyecto).

---

### 7. CodeRabbit Lessons

#### ❌ Prompt Original
- Menciona leer lessons pero no en FASE 0
- No menciona actualizar lessons si ≥2 patrones

#### ✅ Prompt Optimizado
- **Leer en FASE 0** (antes de cualquier acción)
- **Actualizar si ≥2 comentarios coinciden** con patrón conocido
- Workflow de actualización documentado

**Impacto:** Previene repetición de patrones conocidos.

---

### 8. Estructura del Plan

#### ❌ Prompt Original
- Estructura básica pero falta:
  - Receipts a generar
  - Completion validation
  - GDD drift prediction

#### ✅ Prompt Optimizado
- **Estructura completa:**
  1. Análisis por severidad
  2. GDD nodes afectados (con workflow)
  3. Agentes asignados (con receipts)
  4. Archivos afectados
  5. Estrategia de implementación
  6. Criterios de éxito (incluye completion validation)

**Impacto:** Plan más completo y alineado con políticas del proyecto.

---

### 9. Reglas NO NEGOCIABLES

#### ❌ Prompt Original
- Lista básica pero falta:
  - Cargar spec.md completo (prohibido)
  - Saltar FASE 0 (prohibido)
  - Completion validation (obligatorio)

#### ✅ Prompt Optimizado
- **Lista completa:**
  - ❌ Cargar spec.md completo
  - ❌ Saltar FASE 0 assessment
  - ❌ Commit sin tests si código nuevo
  - ❌ Merge sin completion validation
  - ✅ Ejecutar comandos REALES (no asumir)
  - ✅ Generar receipts para agentes
  - ✅ Actualizar "Agentes Relevantes" en nodos

**Impacto:** Reglas claras y alineadas con políticas del proyecto.

---

### 10. Entregables Finales

#### ❌ Prompt Original
- Checklist básico pero falta:
  - Receipts generados
  - Completion validation exit code
  - GDD drift <60

#### ✅ Prompt Optimizado
- **Checklist completo:**
  - Receipts generados
  - Completion validation: exit code 0
  - GDD drift <60
  - CodeRabbit: 0 comentarios (verificado)
  - Tests: 0 failures (verificado)

**Impacto:** Checklist completo que asegura calidad antes de merge.

---

## 📈 Mejoras Cuantitativas

| Aspecto | Original | Optimizado | Mejora |
|---------|----------|------------|--------|
| Fases definidas | 3 | 4 | +33% |
| Comandos específicos | 2 | 8 | +300% |
| Validaciones | 3 | 7 | +133% |
| Referencias a políticas | 2 | 6 | +200% |
| Workflow GDD | Parcial | Completo | +100% |

---

## ✅ Conclusión

**El prompt optimizado es necesario porque:**

1. ✅ Integra todas las políticas del proyecto (GDD, Agents, Skills, Completion Validation)
2. ✅ Sigue workflow completo de FASE 0 → FASE 4
3. ✅ Incluye comandos específicos y verificables
4. ✅ Previene errores comunes (cargar spec.md completo, saltar FASE 0)
5. ✅ Asegura calidad antes de merge (completion validation, receipts)

**Recomendación:** Usar prompt optimizado para todas las reviews de CodeRabbit.

---

**Última actualización:** 2025-01-XX
**Mantenido por:** Orchestrator Agent


