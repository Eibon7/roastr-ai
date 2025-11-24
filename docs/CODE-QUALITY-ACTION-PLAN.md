# Code Quality Action Plan

**Última actualización:** 2025-11-23  
**Issue:** #971 - Fix low-hanging fruit: dependencias duplicadas e inconsistencias

---

## 📊 Fuente de Verdad: Coverage Script

**Script:** `scripts/get-coverage.js` (Issue #971)

Este script es la **FUENTE DE VERDAD** para todas las métricas de cobertura del proyecto.

### Uso

```bash
node scripts/get-coverage.js
```

### Output

El script proporciona cobertura actualizada por categoría:

- **roast** - Roast generation & master prompt
- **shield** - Shield moderation system
- **workers** - Queue workers (FetchComments, AnalyzeToxicity, GenerateReply, ShieldAction)
- **integrations** - Platform integrations (Twitter, YouTube, Instagram, etc.)
- **multi-tenant** - Multi-tenant isolation & RLS
- **cost-control** - Usage tracking & billing

### Por Qué Este Script

**Problema anterior:**

- Cobertura reportada inconsistentemente entre fuentes
- Valores manuales en nodos GDD desactualizados
- Métricas de `npm test --coverage` no categorizadas

**Solución:**

- Script centralizado que lee `coverage/coverage-summary.json`
- Agrupa archivos por área funcional
- Proporciona métricas consistentes y verificables
- Se integra con `auto-repair-gdd.js --auto` para actualización automática

### Integración con GDD

El script se utiliza como parte del workflow GDD:

```bash
# 1. Ejecutar tests con cobertura
npm test --coverage

# 2. Obtener cobertura por área
node scripts/get-coverage.js

# 3. Actualizar nodos GDD automáticamente
node scripts/auto-repair-gdd.js --auto
```

**Resultado:** Los nodos GDD (`docs/nodes/*.md`) se actualizan automáticamente con valores de cobertura correctos, marcados como `Coverage Source: auto`.

---

## 🎯 Mejoras Implementadas (Issue #971)

### 1. Dependencias Unificadas

**Problema:** Tanto `bcrypt` como `bcryptjs` instalados  
**Solución:** Unificado a `bcrypt` (nativo, más rápido)  
**Estado:** ✅ Completado

**Archivos modificados:**

- `src/services/passwordValidationService.js` - Import cambiado a `bcrypt`
- `package.json` - `bcryptjs` eliminado

### 2. Logging Consistente

**Problema:** 852 `console.log` en 47 archivos  
**Solución:** Script automático `scripts/replace-console-logs.js`  
**Estado:** ✅ Completado

**Script ejecutado:**

```bash
node scripts/replace-console-logs.js
```

**Resultados:**

- **Files scanned:** 223
- **Files modified:** 36
- **Imports added:** 28
- **Replacements:** 399 total
  - `console.log` → `logger.info`: 223
  - `console.warn` → `logger.warn`: 16
  - `console.error` → `logger.error`: 160

**Excepciones (CLI tools - legítimo uso de console.log):**

- `src/cli.js` - 2 console.log para user output
- `src/cli/` - Herramientas CLI
- `src/workers/cli/` - Worker CLI tools
- `src/integrations/cli/` - Integration CLI tools

**Estado actual:** <50 console.log en código (solo CLI tools)

### 3. Script de Cobertura Documentado

**Estado:** ✅ Completado (este documento)

---

## 📈 Métricas de Calidad Actuales

**Cobertura general:** ~39% (2025-11-23)

**Por área:**

- roast: ~45%
- shield: ~50%
- workers: ~35%
- integrations: ~20%
- multi-tenant: ~94%
- cost-control: ~40%

**Objetivo a corto plazo:** ≥50% en todas las áreas  
**Objetivo a largo plazo:** ≥85% global

**Referencia:** Ver nodos GDD en `docs/nodes/*.md` para cobertura detallada por área.

---

## 🔄 Workflow de Calidad (Continuous)

### Pre-Commit

```bash
# 1. Ejecutar tests
npm test

# 2. Verificar linting
npm run lint

# 3. Verificar GDD health
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci  # Debe ≥87
```

### Pre-PR

```bash
# 1. Tests + Coverage
npm test --coverage

# 2. Actualizar nodos GDD
node scripts/auto-repair-gdd.js --auto

# 3. CodeRabbit review
npm run coderabbit:review

# 4. Verificar calidad
# - 0 comentarios CodeRabbit
# - Tests pasando 100%
# - Coverage ≥90% en archivos modificados
# - GDD health ≥87
```

---

## 🚀 Próximos Pasos (Future Work)

### High Priority

- [ ] Aumentar cobertura de integrations (20% → 50%)
- [ ] Aumentar cobertura de workers (35% → 60%)
- [ ] Eliminar warnings de dependencias deprecadas
- [ ] Upgrade ESLint 3.x → 8.x

### Medium Priority

- [ ] Configurar Prettier para formatting consistente
- [ ] Añadir pre-commit hooks con Husky
- [ ] CI/CD quality gates (coverage, linting)
- [ ] Documentar estándares de código en `docs/CONTRIBUTING.md`

### Low Priority

- [ ] Upgrade core-js 2.x → 3.x
- [ ] Migrar de request → fetch/axios
- [ ] Upgrade webpack plugins deprecados
- [ ] Resolver vulnerabilities de npm audit

---

## 📚 Referencias

- **Testing Guide:** `docs/TESTING-GUIDE.md`
- **Quality Standards:** `docs/QUALITY-STANDARDS.md`
- **GDD Guide:** `docs/GDD-ACTIVATION-GUIDE.md`
- **CodeRabbit Lessons:** `docs/patterns/coderabbit-lessons.md`

---

**Mantenido por:** Orchestrator  
**Última revisión:** 2025-11-23  
**Versión:** 1.0.0
