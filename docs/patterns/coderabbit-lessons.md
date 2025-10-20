# CodeRabbit Lessons Learned

**Purpose:** Document recurring patterns from CodeRabbit reviews to prevent repetition and improve code quality.

**Last Updated:** 2025-10-16

**Usage:** Read this file BEFORE implementing any feature (FASE 0 or FASE 2 of task workflow).

---

## 🚨 Errores Recurrentes

### 1. ESLint & Code Style

**Pattern:** Missing semicolons, inconsistent const/let usage, console.logs in production

**❌ Mistake:**
```javascript
let count = 0  // Missing semicolon
console.log('Debug:', data) // console.log in production
```

**✅ Fix:**
```javascript
const count = 0; // Prefer const, always semicolon
logger.debug('Debug:', data); // Use logger utility
```

**Rules to apply:**
- Always use semicolons (ESLint: `semi: ["error", "always"]`)
- Prefer `const` over `let` (ESLint: `prefer-const: "error"`)
- Use `utils/logger.js` instead of `console.log`
- Remove unused imports (ESLint: `no-unused-vars: "error"`)

---

### 2. Testing Patterns

**Pattern:** Implementing code without tests, tests only cover happy path, mock assertions missing

**❌ Mistake:**
```javascript
// Implement feature first
function processPayment(amount) {
  // implementation
}

// Write tests later (or never)
```

**✅ Fix:**
```javascript
// TDD: Write test FIRST
describe('processPayment', () => {
  it('should process valid payment', async () => {
    const result = await processPayment(100);
    expect(result.status).toBe('success');
  });

  it('should reject negative amounts', async () => {
    await expect(processPayment(-10)).rejects.toThrow('Invalid amount');
  });

  it('should handle API timeout', async () => {
    mockAPI.timeout();
    await expect(processPayment(100)).rejects.toThrow('Timeout');
  });
});

// Then implement
function processPayment(amount) {
  if (amount <= 0) throw new Error('Invalid amount');
  // implementation
}
```

**Rules to apply:**
- Write tests BEFORE implementation (TDD)
- Cover happy path + error cases + edge cases
- Verify mock calls: `expect(mock).toHaveBeenCalledWith(...)`
- Minimum 3 test cases: success, error, edge case

---

### 3. TypeScript / JSDoc

**Pattern:** Missing type definitions, implicit `any`, functions without @param/@returns

**❌ Mistake:**
```javascript
function calculateDiscount(price, percent) {
  return price * (percent / 100);
}
```

**✅ Fix:**
```javascript
/**
 * Calculate discount amount for a given price and percentage
 * @param {number} price - Original price
 * @param {number} percent - Discount percentage (0-100)
 * @returns {number} Discount amount
 */
function calculateDiscount(price, percent) {
  return price * (percent / 100);
}
```

**Rules to apply:**
- Add JSDoc to all exported functions
- Include `@param` for each parameter with type
- Include `@returns` with return type
- Avoid `any` type, define specific types

---

### 4. GDD Documentation

**Pattern:** Forgetting to update coverage, missing "Agentes Relevantes", manual coverage modification

**❌ Mistake:**
```markdown
**Coverage:** 75%  <!-- Manually entered -->
**Coverage Source:** manual

## Agentes Relevantes
- Backend Developer  <!-- Forgot to add Front-end Dev -->
```

**✅ Fix:**
```markdown
**Coverage:** 75%  <!-- Auto-generated from coverage-summary.json -->
**Coverage Source:** auto

## Agentes Relevantes
- Backend Developer
- Front-end Dev  <!-- Added after invoking agent -->
- Test Engineer  <!-- Added after invoking agent -->
```

**Rules to apply:**
- NEVER modify `**Coverage:**` manually
- Always use `**Coverage Source:** auto`
- Update "Agentes Relevantes" when invoking agent
- Run `node scripts/validate-gdd-runtime.js --full` before commit

---

### 5. Error Handling

**Pattern:** Generic error messages, no retry logic, missing error codes

**❌ Mistake:**
```javascript
try {
  const result = await apiCall();
} catch (error) {
  throw new Error('Failed'); // Generic message
}
```

**✅ Fix:**
```javascript
const MAX_RETRIES = 3;

async function apiCallWithRetry(attempt = 1) {
  try {
    return await apiCall();
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      throw new Error(`API_TIMEOUT: Failed after ${MAX_RETRIES} attempts`);
    }

    logger.warn(`Retry ${attempt}/${MAX_RETRIES}`, { error: error.message });
    await delay(500 * attempt); // Exponential backoff
    return apiCallWithRetry(attempt + 1);
  }
}
```

**Rules to apply:**
- Use specific error codes (e.g., `E_TIMEOUT`, `E_VALIDATION`)
- Implement retry logic for transient errors
- Log errors with context (attempt number, user ID, etc.)
- Provide actionable error messages for users

---

### 6. Security

**Pattern:** Hardcoded credentials, env vars in docs, sensitive data in logs

**❌ Mistake:**
```javascript
const API_KEY = 'sk-abc123...'; // Hardcoded
logger.info('User data:', { email, password }); // Sensitive data logged
```

**✅ Fix:**
```javascript
const API_KEY = process.env.OPENAI_API_KEY; // From env
if (!API_KEY) throw new Error('OPENAI_API_KEY not configured');

logger.info('User data:', { email, passwordHash }); // Hash only
```

**Rules to apply:**
- NO hardcoded credentials in code
- NO env var examples in public docs (use "🔐 Requires environment variables")
- NO sensitive data (passwords, tokens) in logs
- Validate env vars at startup

---

### 7. PR Merge Policy

**Pattern:** Claude merges PRs without user approval, bypassing final review opportunity

**❌ Mistake:**
```bash
# After resolving conflicts and CI passing
gh pr merge 581 --squash --delete-branch  # ❌ NEVER DO THIS
```

**✅ Fix:**
```bash
# After resolving conflicts and CI passing
echo "✅ PR #581 ready to merge:"
echo "- All CI checks passed"
echo "- Conflicts resolved"
echo "- CodeRabbit: awaiting review"
echo ""
echo "⏸️  Waiting for your approval to merge."
# STOP HERE - User decides when to merge
```

**Why this matters:**
- **CodeRabbit needs time to review** after final changes
- **User is the project owner** - only they decide when to merge
- **Final review opportunity** - user may spot issues Claude missed
- **This is a monetizable product** - quality requires human oversight
- **Unauthorized merges break trust** - Claude is an assistant, not the decision maker

**Rules to apply:**
- NEVER run `gh pr merge` command
- NEVER click merge buttons
- NEVER assume CI passing = ready to merge
- ALWAYS report: "PR is ready, awaiting your approval"
- ALWAYS wait for explicit "merge this" instruction
- IF accidentally merged: revert immediately, apologize, recreate PR

**Exception:** NONE - this rule has zero exceptions

**Lesson learned:** 2025-10-15 (Issue: PR #581 merged without approval, had to revert)

---

### 8. Cherry-Pick Intermediate State Reviews

**Pattern:** CodeRabbit generates reviews on temporary intermediate commit states during multi-step git operations (cherry-picks, rebases, merges) before completion.

**❌ Mistake:**
```bash
# During cherry-pick with conflicts
git cherry-pick abc123
# Conflicts occur, file has markers:
# <<<<<<< HEAD
# Status: Complete
# =======
# Status: Pending
# >>>>>>> abc123

git add .
git commit  # Commit with conflict markers temporarily

# CodeRabbit review generated NOW (intermediate state)

git add resolved-file
git cherry-pick --continue  # Complete resolution

# Review arrives LATER flagging conflicts that no longer exist
```

**✅ Fix:**
```bash
# Verify current state BEFORE applying fixes
grep -rn "<<<<<<< HEAD\|=======\|>>>>>>>" <files-mentioned-in-review>

# If no markers found:
# 1. Document as PRE-RESOLVED in docs/plan/review-{id}.md
# 2. Create verification evidence showing clean state
# 3. Reference the resolving commit in documentation
# 4. Add pattern to coderabbit-lessons.md

# Prevention: Add pre-push hook
cat > .git/hooks/pre-push <<'EOF'
#!/bin/bash
if git grep -q "<<<<<<< HEAD\|=======\|>>>>>>>"; then
  echo "❌ Merge conflict markers detected"
  git grep -n "<<<<<<< HEAD\|=======\|>>>>>>>"
  exit 1
fi
EOF
chmod +x .git/hooks/pre-push
```

**Rules to apply:**
- Always verify current file state before assuming issues exist
- Complete cherry-pick/rebase operations promptly to avoid intermediate states
- Run `git grep "<<<<<<< HEAD"` before pushing to catch stray markers
- Document pre-resolved issues properly (create plan + evidence + reference resolving commit)
- Consider squashing cherry-picked commits to avoid conflict artifacts
- Add pre-push hook to detect conflict markers automatically

**Why this happens:**
- Cherry-picks/rebases can take multiple steps to complete
- CodeRabbit review queue may process intermediate commits before resolution
- Temporary conflict markers trigger reviews even if resolved moments later
- Review arrives after conflicts already cleaned up

**Response Protocol:**
1. Verify current state first (don't assume issues exist)
2. If pre-resolved, document why and when resolution occurred
3. Create evidence showing verification of clean state
4. Reference the resolving commit in documentation
5. No code changes needed if already resolved

**Lesson learned:** 2025-10-16 (Review #3345472977 flagged conflicts already resolved in commit 77aa466f)

---

## 📊 Estadísticas

| Patrón | Ocurrencias | Tasa Reducción | Última Ocurrencia |
|--------|-------------|----------------|-------------------|
| Missing semicolons | 12 | -60% | 2025-10-10 |
| const vs let | 8 | -75% | 2025-10-09 |
| Missing tests | 5 | -40% | 2025-10-12 |
| Console.log usage | 15 | -80% | 2025-10-08 |
| Coverage manual | 4 | -100% | 2025-10-07 |
| Generic errors | 6 | -50% | 2025-10-11 |
| Unauthorized merge | 1 | N/A | 2025-10-15 |
| Cherry-pick reviews | 1 | N/A | 2025-10-16 |

**Objetivo:** Reducir tasa de repetición <10% en todos los patrones

---

## 🎯 Checklist Pre-Implementación

Antes de escribir código, verificar:

- [ ] Leí `docs/patterns/coderabbit-lessons.md` (este archivo)
- [ ] Tengo tests escritos ANTES de implementar (TDD)
- [ ] Usaré `const` por defecto, `let` solo si mutable
- [ ] Usaré `logger.js` en lugar de `console.log`
- [ ] Añadiré JSDoc a funciones exportadas
- [ ] NO hardcodearé credenciales
- [ ] Implementaré retry logic para llamadas API
- [ ] Actualizaré GDD nodes si toco arquitectura
- [ ] Añadiré agentes a "Agentes Relevantes" si los invoco

---

## 🔄 Proceso de Actualización

**Cuándo actualizar este archivo:**
- Después de recibir review de CodeRabbit con ≥3 comentarios
- Si detectas patrón nuevo que se repite ≥2 veces
- Cuando implementes fix para error recurrente

**Cómo actualizar:**
1. Identificar patrón en review de CodeRabbit
2. Añadir sección con ❌ Mistake / ✅ Fix
3. Actualizar estadísticas (ocurrencias, última fecha)
4. Commit con mensaje: `docs(patterns): Add CodeRabbit lesson - <patrón>`

**Responsable:** Orchestrator Agent

---

## 📚 Related Documentation

- [Quality Standards](../QUALITY-STANDARDS.md) - Non-negotiable requirements for merge
- [Testing Guide](../TESTING-GUIDE.md) - Complete testing workflow
- [Integration Workflow](../../CLAUDE.md#integration-workflow--error-prevention) - Platform integration checklist
- [GDD Activation Guide](../GDD-ACTIVATION-GUIDE.md) - GDD validation and health scoring

---

**Maintained by:** Orchestrator
**Review Frequency:** Weekly or after significant reviews
**Last Reviewed:** 2025-10-16
**Version:** 1.2.0
