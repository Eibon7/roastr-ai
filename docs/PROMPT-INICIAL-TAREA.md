# Prompt Inicial para Tareas - Cursor Optimizado

**Versión:** 2.0 (Cursor + GDD + Auto-activación)  
**Última actualización:** 2025-01-XX

---

## Prompt para Copiar

```
Trabaja en la issue #XXX

## FASE 0: Auto-Activación GDD (OBLIGATORIA)

**Ejecutar automáticamente:**
```bash
node scripts/cursor-agents/auto-gdd-activation.js XXX
```

**Output incluye:**
- Nodos GDD detectados desde labels/keywords/archivos
- Comando de resolución: `node scripts/resolve-graph.js <nodos>`
- @-mentions para Cursor: `@docs/nodes/roast.md @docs/nodes/shield.md`

**Acciones:**
1. ✅ Ejecutar resolución de dependencias
2. ✅ Leer SOLO nodos resueltos (NUNCA spec.md completo)
3. ✅ Leer `@docs/patterns/coderabbit-lessons.md`
4. ✅ Assessment automático (inline si AC ≤2, TaskAssessor si AC ≥3)

**Reglas:**
- ❌ NUNCA cargar spec.md completo (excepto test:e2e o area:observability)
- ✅ Usar @-mentions para contexto selectivo
- ✅ Seguir instrucciones de `.gdd-activation-instructions.json`

## FASE 1: Planning

**Si AC ≥3 o P0/P1:**
- Crear `docs/plan/issue-{id}.md`
- Incluir: Estado Actual, Pasos, Agentes, Archivos, Validación
- **Continuar automáticamente** (NO esperar confirmación)

**Si AC ≤2:**
- Planning inline, continuar directamente

## FASE 2: Detección de Agents

**Antes de implementar:**
```bash
node scripts/cursor-agents/detect-triggers.js
```

**Output sugiere:**
- Agent a usar (TestEngineer, FrontendDev, Guardian, etc.)
- Composer workflow: `Cmd+I → @archivos`
- Prompt sugerido
- Receipt creado automáticamente

**Workflow por Agent:**

**TestEngineer:**
- Triggers: Cambios en `src/`, `tests/`
- Composer: `Cmd+I → @tests/ @src/[archivo]`
- Prompt: "Generate comprehensive tests following test-generation-skill"
- Verificar: `npm test`

**FrontendDev:**
- Triggers: Cambios en `*.jsx`, `*.tsx`, `*.css`
- Composer: `Cmd+I → @src/components/ @public/`
- Validación visual: Playwright MCP si UI changes
- Receipt: `docs/agents/receipts/cursor-frontend-[timestamp].md`

**Guardian:**
- Triggers: `costControl.js`, `schema.sql`, `docs/nodes/`, billing, security
- Ejecutar: `node scripts/guardian-gdd.js --full`
- Audit manual + GDD validation
- Receipt con findings

## FASE 3: Implementación

**Quality Standards:**
- ✅ 0 comentarios CodeRabbit pendientes
- ✅ Tests 100% passing (STOP si ANY fail)
- ✅ Coverage: Source auto (NUNCA manual)
- ✅ GDD: Actualizar nodos afectados + "Agentes Relevantes"
- ✅ UI: Evidencias con Playwright MCP si cambios visuales
- ✅ Security: NO exponer keys/credentials

**Durante implementación:**
- Leer nodos GDD relevantes (NO spec.md)
- Actualizar nodos cuando código cambia
- Añadir agents a "Agentes Relevantes" si se invocan
- Ejecutar validación antes de commits: `node scripts/validate-gdd-runtime.js --full`

## FASE 4: Validation + Evidence

**Test Suite Completo:**
```bash
npm test  # STOP si ANY fail
npm run test:coverage  # Verificar ≥90%
```

**GDD Validations:**
```bash
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci  # Debe >=87
node scripts/predict-gdd-drift.js --full  # Debe <60 risk
```

**Generar Evidencias:**
- `docs/test-evidence/issue-{id}/summary.md`
- Screenshots si UI changes (`docs/test-evidence/issue-{id}/screenshots/`)
- SUMMARY.md con patterns identificados

**Skills Auto-Activadas:**
- `gdd-sync-skill`: Actualizar nodos + validar
- `test-generation-skill`: Generar tests faltantes
- `visual-validation-skill`: Screenshots si UI
- `security-audit-skill`: Si cambios sensibles

## FASE 5: PR + Receipts

**Pre-Flight:**
```bash
# 1. Tests pasando
npm test

# 2. GDD validado
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci

# 3. Receipts presentes
ls docs/agents/receipts/cursor-*-[timestamp].md

# 4. Coverage >=90%
npm run test:coverage

# 5. CodeRabbit = 0 comentarios
npm run coderabbit:review
```

**Crear PR:**
```bash
git push origin {branch}
/new-pr
```

**Receipts:**
- Auto-generados por `detect-triggers.js`
- Verificar completitud en `docs/agents/receipts/`
- Formato: `cursor-{agent}-{timestamp}.md`

**Validar CI:**
- Todos los checks pasando
- GDD health >=87
- Coverage >=90%
- 0 CodeRabbit comments

## Blockers para Merge

❌ Tests failing  
❌ Coverage bajó  
❌ GDD health < 87 (temporal hasta 2025-10-31)  
❌ CI/CD failing  
❌ Comentarios CodeRabbit pendientes  
❌ Receipts faltantes  
❌ Nodos GDD no actualizados  

**Calidad > Velocidad. Producto monetizable.**

---

## Referencias Rápidas

**Scripts:**
- `node scripts/cursor-agents/auto-gdd-activation.js [issue]` - Auto-activar GDD
- `node scripts/cursor-agents/detect-triggers.js` - Detectar agents
- `node scripts/resolve-graph.js <nodos>` - Resolver dependencias
- `node scripts/validate-gdd-runtime.js --full` - Validar GDD
- `node scripts/score-gdd-health.js --ci` - Health score

**Docs:**
- `.cursorrules` - Reglas siempre activas
- `docs/GDD-ACTIVATION-GUIDE.md` - Guía completa GDD
- `docs/patterns/coderabbit-lessons.md` - Lecciones CodeRabbit
- `agents/manifest.yaml` - Manifest de agents

**Workflow:**
- FASE 0: GDD + Assessment
- FASE 1: Planning (si AC ≥3)
- FASE 2: Agents detection
- FASE 3: Implementation
- FASE 4: Validation + Evidence
- FASE 5: PR + Receipts
```

---

## Cambios vs Versión Anterior

### Añadido:
1. ✅ **FASE 0 explícita** con auto-activación GDD
2. ✅ **Scripts específicos** (`auto-gdd-activation.js`, `detect-triggers.js`)
3. ✅ **@-mentions para Cursor** en lugar de cargar spec.md
4. ✅ **Referencias a `.cursorrules`** (siempre activo)
5. ✅ **Workflow por Agent** con Composer específico
6. ✅ **Validaciones GDD** explícitas (health, drift)
7. ✅ **Receipts automáticos** mencionados

### Mejorado:
1. ✅ **Orden más claro** (FASE 0 primero, siempre)
2. ✅ **Comandos específicos** en lugar de descripciones vagas
3. ✅ **Blockers más completos** (incluye receipts y GDD)

### Mantenido:
1. ✅ **Calidad > Velocidad** (principio core)
2. ✅ **Workflow general** (misma estructura)
3. ✅ **Blockers** (mismos criterios + nuevos)

---

## Uso

1. Copiar el prompt completo
2. Reemplazar `#XXX` con número de issue real
3. Pegar en Cursor Chat
4. El sistema ejecutará automáticamente FASE 0

**Nota:** Los scripts se ejecutan automáticamente, pero puedes ejecutarlos manualmente si prefieres ver el output antes.


