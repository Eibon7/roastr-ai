# CodeRabbit Review - Prompt Final (CONCISO + AUTÓNOMO)

**Versión:** 2.1 (Balanceado: conciso pero completo para autonomía)
**Tokens estimados:** ~800 (vs ~2000 versión completa, vs ~400 versión muy concisa)

---

## 🎯 FASE 0 - Assessment (OBLIGATORIO - NO SALTAR)

**Ejecutar en orden, verificar cada paso:**

1. **Leer lessons:** `@docs/patterns/coderabbit-lessons.md`
   - Si ≥2 comentarios = patrón conocido → marcar para actualizar después

2. **Detectar nodos GDD:**
   ```bash
   node scripts/cursor-agents/auto-gdd-activation.js --from-review {id}
   # O manual: node scripts/resolve-graph.js shield multi-tenant
   ```

3. **Leer SOLO nodos resueltos:** `@docs/nodes/{nodo}.md`
   - ❌ NUNCA cargar spec.md completo
   - ✅ Solo nodos mencionados en output de resolve-graph

4. **Detectar agentes:** `node scripts/cursor-agents/detect-triggers.js`
   - Security → Guardian
   - Tests → TestEngineer  
   - Frontend → FrontendDev
   - Architecture (AC≥3) → TaskAssessor

**Decision point:** Si detect-triggers no encuentra agentes pero review tiene security/tests → invocar manualmente.

---

## 📋 FASE 1 - Planning (`docs/plan/review-{id}.md`)

**Estructura mínima (copiar y completar):**

```markdown
# CodeRabbit Review #{id} - Plan

## Análisis
- Critical: [count] - [tipo: security/arch/bug]
- Major: [count] - [tipo]
- Minor: [count] - [tipo]

Por issue: archivo:línea | tipo | impacto | root cause

## GDD
- Nodos: [lista]
- Actualizar: [sección] + "Agentes Relevantes" si aplica

## Agentes
- Invocar: [lista]
- Receipts: docs/agents/receipts/cursor-{agent}-{timestamp}.md
- SKIP: [agente] - razón

## Archivos
- Mencionados: [lista]
- Dependientes: [buscar con grep/codebase_search]
- Tests: [unit/integration/E2E]

## Estrategia
- Orden: Critical → Major → Minor
- Commits: [agrupación]
- Tests: [qué ejecutar]

## Éxito
- [ ] 100% resuelto (0 pending)
- [ ] Tests: 0 failures
- [ ] Coverage: ≥90%
- [ ] GDD health ≥87
- [ ] CodeRabbit: 0 comentarios
```

**⚠️ NO PROCEDER sin plan guardado.**

---

## 🔧 FASE 2 - Aplicación

### Decision Tree por Severidad

**Security (Critical/Major):**
```
1. Invocar Guardian: node scripts/guardian-gdd.js --full
2. Buscar patrón en TODA codebase (no solo archivo mencionado)
   Ejemplo: grep -rn "API_KEY.*=" src/ | grep -v "process.env"
3. Tests de explotación si aplica
4. Receipt: docs/agents/receipts/cursor-guardian-{timestamp}.md
```

**Architecture (Major):**
```
1. Refactorizar (NO parches temporales)
2. Actualizar GDD:
   - Sección relevante
   - "Agentes Relevantes" si se invocó agente
   - Validar: node scripts/validate-gdd-runtime.js --full
3. Tests integración
4. spec.md SOLO si cambia contrato público (API/interfaces)
```

**Performance:**
```
1. Medir ANTES (benchmark/métricas)
2. Aplicar fix
3. Medir DESPUÉS
4. Documentar números concretos
```

**Code Quality:**
```
1. Aplicar sugerencia CodeRabbit
2. Buscar patrón en TODA codebase:
   Ejemplo: grep -rn "let " src/ | grep -v "node_modules"
3. Aplicar consistency en TODOS los lugares
4. Verificar: codebase_search o grep
```

**Test Coverage:**
```
1. Invocar TestEngineer (si no detectado)
2. Tests: happy + error + edge cases
3. Evidencias visuales si UI afectada
4. Receipt: docs/agents/receipts/cursor-test-engineer-{timestamp}.md
```

### Reglas NO NEGOCIABLES

**❌ Prohibido:**
- Quick fixes arquitecturales
- Cargar spec.md completo
- Saltar FASE 0
- Merge sin completion validation
- Asumir resultados (siempre ejecutar comandos)

**✅ Obligatorio:**
- Refactor si arch señalada
- Buscar patrón completo (no solo donde CodeRabbit marcó)
- Actualizar GDD + "Agentes Relevantes"
- Receipts para agentes invocados
- Comandos REALES de verificación

---

## ✅ FASE 3 - Validación (EJECUTAR COMANDOS REALES)

**Workflow completo (copiar y ejecutar):**

```bash
# 1. Tests
npm test
# Verificar: exit code debe ser 0
# Si falla → arreglar ANTES de continuar

# 2. Coverage
npm run test:coverage
# Verificar: ≥90% o threshold especificado
# Actualizar nodos GDD: Coverage Source: auto

# 3. GDD Runtime
node scripts/validate-gdd-runtime.js --full
# Debe mostrar: 🟢 HEALTHY

# 4. GDD Health
node scripts/score-gdd-health.js --ci
# Debe: ≥87, exit 0

# 5. GDD Drift
node scripts/predict-gdd-drift.js --full
# Debe: <60 risk, 🟢 LOW RISK

# 6. CodeRabbit
npm run coderabbit:review
# Debe: 0 comentarios pendientes
# Si hay → aplicar fixes → re-commit → re-verificar

# 7. Completion Validation (CRÍTICO antes de merge)
npm run validate:completion -- --pr={id}
# Exit codes:
# 0 = 100% completo, ready to merge
# 1 = Incompleto, continuar
# 2 = Critical blockers, NO mergear
```

**Evidencias:**
```bash
mkdir -p docs/test-evidence/review-{id}
# Generar SUMMARY.md con patterns (NO cronología)
# Template: docs/templates/SUMMARY-template.md
```

**Decision point:** Si cualquier comando falla → NO continuar. Arreglar primero.

---

## 📝 FASE 4 - Commit & Push

**Template de commit (copiar y adaptar):**

```bash
git commit -m "fix: Apply CodeRabbit Review #{id} - <título>

### Issues Addressed
- [Severity] Brief (file:line)
- [Severity] Brief (file:line)

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
- Receipts: docs/agents/receipts/cursor-*-{timestamp}.md"
```

**Push:**
```bash
git push origin <branch>
```

**⚠️ NO mergear PR. Solo push. Usuario decide cuándo mergear.**

---

## 📊 Checklist Final (VERIFICAR ANTES DE COMPLETAR)

- [ ] Review #{id}: X Critical, Y Major, Z Minor resueltos (100%)
- [ ] N archivos modificados, M tests añadidos, Coverage: A%→B%
- [ ] GDD: Nodos actualizados, Health ≥87, Drift <60 (verificado)
- [ ] spec.md: [sección o N/A] (solo si cambio contrato público)
- [ ] Evidencias: `docs/test-evidence/review-{id}/SUMMARY.md`
- [ ] Receipts: `docs/agents/receipts/cursor-*-{timestamp}.md`
- [ ] CodeRabbit: 0 comentarios (verificado con `npm run coderabbit:review`)
- [ ] Tests: 0 failures (verificado con `npm test`)
- [ ] Completion validation: exit 0 (verificado con `npm run validate:completion`)
- [ ] Push confirmado: origin/{branch} (commit: {hash})

**Decision point:** Si falta cualquier item → NO marcar completo. Completar primero.

---

## 🔄 Actualizar CodeRabbit Lessons

**Si ≥2 comentarios = patrón conocido:**

1. Identificar patrón en review
2. Añadir en `docs/patterns/coderabbit-lessons.md`:
   - ❌ Mistake (ejemplo del review)
   - ✅ Fix (solución aplicada)
   - Rules to apply
   - Occurrences (actualizar estadísticas)
3. Commit: `docs(patterns): Add CodeRabbit lesson - <patrón>`

**Meta:** Reducir repetición <10% en todos los patrones.

---

## 📚 Referencias Rápidas

- Quality: `docs/QUALITY-STANDARDS.md`
- Lessons: `docs/patterns/coderabbit-lessons.md`
- GDD: `docs/GDD-ACTIVATION-GUIDE.md`
- Agents: `agents/manifest.yaml`
- Template: `docs/templates/SUMMARY-template.md`

---

## 🎯 Criterios de Calidad (NO NEGOCIABLES)

1. ✅ 100% comentarios resueltos (0 pending)
2. ✅ Soluciones arquitecturales (no parches)
3. ✅ Coverage ≥90% (mantiene/sube)
4. ✅ 0 regresiones (tests pasando)
5. ✅ GDD health ≥87 (verificado)
6. ✅ GDD drift <60 (verificado)
7. ✅ CodeRabbit: 0 comentarios (verificado)
8. ✅ Completion validation: exit 0 (verificado)
9. ✅ Código production-ready (sin console.logs, TODOs)
10. ✅ Receipts generados

**Mentalidad:** Calidad > Velocidad. Producto monetizable.

---

**Versión:** 2.1 (Balanceado)
**Tokens:** ~800
**Última actualización:** 2025-01-XX


