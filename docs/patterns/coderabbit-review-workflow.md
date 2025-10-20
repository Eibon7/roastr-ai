# CodeRabbit Review Workflow - Política de Documentación

**Fecha:** 2025-10-20
**Contexto:** PR #602 generó 4 iteraciones de review por exceso de documentación
**Problema:** Cada plan/SUMMARY añadido genera nuevos comentarios de CodeRabbit

---

## 🚨 Problema Identificado

### Patrón Problemático (EVITAR)

```
Fix real → Crear plan 600 líneas → Crear SUMMARY 200 líneas → Push
  ↓
CodeRabbit revisa TODO (código + 800 líneas docs nuevas)
  ↓
Encuentra 2-6 issues en docs nuevas
  ↓
Fix docs → Crear nuevo plan → Crear nuevo SUMMARY → Push
  ↓
LOOP INFINITO ♾️
```

**Resultado:** PR #602
- Código real cambiado: 14 líneas
- Documentación creada: 2,195 líneas
- **Ratio:** 157:1 (documentación/código)
- Reviews de CodeRabbit: 4 iteraciones y contando

### Root Cause

**CodeRabbit revisa CADA ARCHIVO modificado**, incluyendo:
- Plans de 600 líneas con ejemplos de código
- SUMMARYs de 200 líneas con análisis detallado
- Estos docs contienen:
  - URLs que pueden no estar wrapped
  - Code fences sin especificadores de lenguaje
  - Ejemplos de "errores" que activan linters
  - LanguageTool flags en anti-patterns pedagógicos

**Cada documento añadido = nueva superficie de ataque para linters.**

---

## ✅ Solución: Workflow Minimalista

### Política de Documentación para CodeRabbit Reviews

#### Nivel 1: Issues Simples (≤5 líneas código cambiadas)

**NO CREAR:**
- ❌ `docs/plan/review-{id}.md`
- ❌ `docs/test-evidence/review-{id}/SUMMARY.md`

**SÍ HACER:**
```bash
# Commit message detallado es SUFICIENTE
git commit -m "docs: Fix {issue} - CodeRabbit #{id}

- [Severity] Brief description (file:line)
- Fixed: what changed
- Validated: how verified

Resolves: {issue-url}
"
```

**Ejemplo Real (PR #602 - lo que DEBÍ haber hecho):**
```bash
git commit -m "docs: Fix table inconsistency and capitalization

- Updated metrics table: 7-day → 30-day threshold (gdd-issue-cleanup-implementation.md:194)
- Capitalized Markdown references: 5 instances (review-3351087724.md)

Validated:
- grep '7-day' docs/ → 0 results
- grep 'markdown formatting' docs/plan/ → 0 lowercase

CodeRabbit: #3354698973
"
```

**Beneficio:** 0 nuevos archivos → 0 nueva superficie de linting → 0 nuevos comentarios

---

#### Nivel 2: Issues Moderados (6-50 líneas código)

**CREAR (OPCIONAL):**
- ✅ `docs/plan/review-{id}.md` - **SOLO si arquitectura compleja**
- ❌ `docs/test-evidence/review-{id}/SUMMARY.md` - **NO CREAR**

**Criterio:** ¿El plan ayuda a futuros desarrolladores? Si no, skip.

**Formato del Plan (si se crea):**
- Máximo 150 líneas
- Sin ejemplos de código extensos
- Sin anti-patterns pedagógicos
- URLs siempre wrapped
- Code fences siempre con lenguaje

---

#### Nivel 3: Issues Complejos (>50 líneas código O arquitectura)

**CREAR:**
- ✅ `docs/plan/review-{id}.md` - Plan arquitectural
- ✅ `docs/test-evidence/review-{id}/SUMMARY.md` - Solo si tests complejos

**Checklist PRE-COMMIT del Plan:**
- [ ] Todas las URLs wrapped en markdown links
- [ ] Todos los code fences tienen especificador de lenguaje
- [ ] Anti-patterns wrapeados en code fences (no prose)
- [ ] File paths en inline code (`` `.github/` ``) no en prose
- [ ] Máximo 300 líneas total
- [ ] **Pasar markdownlint ANTES de commit:**
  ```bash
  npx markdownlint-cli2 docs/plan/review-{id}.md
  npx markdownlint-cli2 docs/test-evidence/review-{id}/SUMMARY.md
  ```

---

### Checklist para CADA CodeRabbit Review

```bash
# PASO 1: Leer review
gh pr view {pr} --json reviews

# PASO 2: Clasificar por severidad
# Critical/Major → requiere plan
# Minor/Nitpick → commit message suficiente

# PASO 3: Aplicar fixes
# (código real)

# PASO 4: Decidir documentación
if [ lines_changed -le 5 ]; then
  # NO crear docs, commit message detallado
  doc_strategy="commit-only"
elif [ lines_changed -le 50 ] && [ no_architecture_change ]; then
  # Plan corto (<150 líneas) OPCIONAL
  doc_strategy="optional-plan"
else
  # Plan + SUMMARY, pre-validar markdownlint
  doc_strategy="full-docs"
fi

# PASO 5: Commit
git commit -m "..." # Detallado según estrategia

# PASO 6: Pre-push validation (si docs creadas)
if [ doc_strategy != "commit-only" ]; then
  npx markdownlint-cli2 docs/plan/*.md docs/test-evidence/**/*.md
  # Si errors → FIX ANTES de push
fi

# PASO 7: Push
git push origin {branch}

# PASO 8: STOP - No más iteraciones de docs
# Si CodeRabbit comenta en docs → evaluar si realmente importa
```

---

## 🎓 Lecciones Aprendidas

### Lección 1: Documentación Genera Deuda de Linting

**Problema:** Cada doc añadida debe pasar CodeRabbit/markdownlint/LanguageTool.

**Solución:** Minimizar docs en PRs de fixes. Guardar docs extensas para:
- Cambios arquitecturales mayores
- Nuevas features (no fixes)
- RFCs y design docs (repos separados si es posible)

---

### Lección 2: Commit Messages > Docs para Fixes

**Problema:** Docs de 600 líneas para fix de 2 líneas es overkill.

**Solución:** Commit messages detallados son suficientes:
```
docs: Fix {issue}

Problem: {what was wrong}
Root Cause: {why it happened}
Fix: {what changed}
Validated: {how verified}
Pattern: {to avoid in future}

CodeRabbit: #{id}
```

Git log preserva todo este contexto sin crear archivos reviewables.

---

### Lección 3: Pre-validate Docs ANTES de Commit

**Problema:** Commit docs con linting errors → CodeRabbit los detecta → nueva iteración.

**Solución:**
```bash
# Añadir a pre-commit hook o hacer manualmente
npx markdownlint-cli2 --fix docs/**/*.md
git add docs/
git commit
```

---

### Lección 4: Evaluar "Importancia Real" de Comentarios en Docs

**Problema:** CodeRabbit comenta "`.github` → GitHub" en documentación técnica.

**Solución:** Preguntarse:
1. ¿Es código de producción? → Fix siempre
2. ¿Es documentación? → ¿Afecta comprensión? Si no, skip
3. ¿Es falso positivo contextual? → Document y skip

**No perseguir 0 comentarios a costa de ciclos infinitos.**

---

## 📋 Template: Commit Message para Fixes Simples

```bash
git commit -m "$(cat <<'EOF'
{type}: {Short description} - CodeRabbit #{review-id}

### Issues Addressed
- [{Severity}] {Issue description} ({file}:{line})
- [{Severity}] {Issue description} ({file}:{line})

### Changes
- {Module/File}: {what changed and why}

### Root Cause
{Why the issue existed - 1-2 sentences}

### Validation
- {Command run}: {expected result} ✅
- {Command run}: {expected result} ✅

### Pattern to Avoid
{Brief note on how to prevent this in future}

CodeRabbit: {review-url}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Tamaño:** ~20 líneas de commit message
**vs**
**Documentación:** 0 archivos nuevos
**Resultado:** 0 nueva superficie de linting

---

## 🚀 Implementación Inmediata

### Para PR #602 (Review #3355293738)

**Acción:**
1. Aplicar los 6 fixes de forma minimalista
2. **NO crear** `docs/plan/review-3355293738.md`
3. **NO crear** `docs/test-evidence/review-3355293738/SUMMARY.md`
4. Commit message detallado (template arriba)
5. Pre-validate con markdownlint si tocamos docs existentes
6. Push
7. **STOP** - No más iteraciones

---

### Para Futuros Desarrollos

**Actualizar `.github/PULL_REQUEST_TEMPLATE.md`:**
```markdown
## Documentation Strategy (for CodeRabbit review fixes)

- [ ] **Lines changed ≤5:** Commit message only (no docs)
- [ ] **Lines changed 6-50:** Optional plan (<150 lines)
- [ ] **Lines changed >50 OR architecture:** Full docs (pre-validate markdownlint)

**Pre-push checklist (if docs created):**
- [ ] All URLs wrapped in markdown links
- [ ] All code fences have language specifiers
- [ ] Anti-patterns wrapped in code fences
- [ ] Ran `npx markdownlint-cli2 --fix docs/**/*.md`
- [ ] No linting errors remain
```

---

## 📊 Métricas de Éxito

### Antes (PR #602 - current state)
- Código real: 14 líneas
- Docs creadas: 2,195 líneas
- Ratio: 157:1
- Iteraciones CodeRabbit: 4+

### Después (target para futuros PRs)
- Código real: X líneas
- Docs creadas: Max 0.5X líneas (ratio ≤1:2)
- Iteraciones CodeRabbit: 1-2 max

---

## 🔗 Referencias

- **Problema Original:** PR #602 - 4 iteraciones de review
- **Root Cause:** Exceso de documentación genera nueva superficie de linting
- **Solución:** Minimizar docs, maximizar commit messages, pre-validate
- **Template:** Ver sección "Template: Commit Message para Fixes Simples"

---

**Principio Fundamental:**

> **Documentación es código reviewable.**
> Cada línea añadida debe justificar el costo de mantenerla y revisarla.
> Para fixes simples: commit message detallado > documentación extensa.

---

**Status:** ✅ ACTIVE - Aplicar a partir de ahora
**Próxima Revisión:** Después de 5 PRs con nueva política
**Owner:** Lead Orchestrator (Claude Code)
