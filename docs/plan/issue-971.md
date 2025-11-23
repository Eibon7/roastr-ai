# Plan de Implementación - Issue #971

**Título:** Fix low-hanging fruit: dependencias duplicadas e inconsistencias

**Prioridad:** Media  
**Complejidad:** Media  
**Estimación:** 15-20 minutos (Claude/AI)

---

## Estado Actual

### Problemas Identificados

1. **Dependencias Duplicadas (bcrypt vs bcryptjs)**
   - `src/services/passwordValidationService.js` usa `bcryptjs`
   - `src/services/passwordHistoryService.js` usa `bcrypt`
   - Solución: Unificar a `bcrypt` (más rápido, nativo)

2. **Inconsistencias de Logging**
   - 852 `console.log` en 47 archivos
   - Excepción: CLI tools (`src/cli/*.js`, `src/workers/cli/*.js`)
   - Solución: Reemplazar con `logger.info/warn/error`

3. **Script de Cobertura**
   - ✅ Ya completado: `scripts/get-coverage.js` existe
   - Solo falta documentar como fuente de verdad

---

## Pasos de Implementación

### Paso 1: Dependencias Duplicadas (5 min)

**Archivos:**

- `src/services/passwordValidationService.js` (1 línea)
- `package.json` (eliminar bcryptjs)

**Acciones:**

1. Cambiar import en `passwordValidationService.js`:

   ```javascript
   // Antes
   const bcryptjs = require('bcryptjs');

   // Después
   const bcrypt = require('bcrypt');
   ```

2. Eliminar dependencia:

   ```bash
   npm uninstall bcryptjs
   ```

3. Verificar tests de password hashing:
   ```bash
   npm test -- password
   ```

**Validación:**

- [ ] Import cambiado a `bcrypt`
- [ ] `bcryptjs` eliminado de package.json
- [ ] Tests de password pasando

---

### Paso 2: Inconsistencias de Logging (10 min)

**Script automático:** `scripts/replace-console-logs.js`

**Funcionalidad:**

- Buscar archivos con `console.log/warn/error`
- Excluir CLI tools (`src/cli/`, `src/workers/cli/`)
- Reemplazar automáticamente:
  - `console.log` → `logger.info`
  - `console.warn` → `logger.warn`
  - `console.error` → `logger.error`
- Añadir `const { logger } = require('./utils/logger');` si falta

**Archivos afectados:** ~47 archivos (estimado)

**Acciones:**

1. Crear script `scripts/replace-console-logs.js`
2. Ejecutar: `node scripts/replace-console-logs.js --dry-run`
3. Revisar cambios propuestos
4. Ejecutar: `node scripts/replace-console-logs.js`
5. Verificar manualmente archivos CLI (deben quedar intactos)
6. Ejecutar tests: `npm test`

**Validación:**

- [ ] Script creado y ejecutado
- [ ] <50 console.log en código (solo CLI)
- [ ] Tests pasando
- [ ] CLI tools intactos

---

### Paso 3: Documentar Script de Cobertura (2 min)

**Archivos:**

- `docs/CODE-QUALITY-ACTION-PLAN.md` (ya existe)
- `CLAUDE.md` (referencia ya presente)

**Acciones:**

1. Añadir nota en `CODE-QUALITY-ACTION-PLAN.md`:

   ````markdown
   ## Fuente de Verdad: Coverage Script

   **Script:** `scripts/get-coverage.js` (Issue #971)

   **Uso:**

   ```bash
   node scripts/get-coverage.js
   ```
   ````

   **Output:** Cobertura actualizada por categoría (roast, shield, workers, integrations)

   **Este script es la FUENTE DE VERDAD para métricas de cobertura.**

   ```

   ```

**Validación:**

- [ ] Documentación añadida
- [ ] Script ejecuta correctamente

---

## Agentes Relevantes

### TestEngineer (REQUERIDO)

**Trigger:** Cambios en `src/`, validación de tests  
**Workflow:**

1. Validar tests de password hashing
2. Ejecutar suite completa: `npm test`
3. Generar receipt en `docs/agents/receipts/issue-971-TestEngineer.md`

### Guardian (SKIPPED)

**Razón:** No hay cambios en billing, auth, security crítica, GDD  
**Receipt:** `docs/agents/receipts/issue-971-Guardian-SKIPPED.md`

---

## Archivos Afectados

**Modificaciones:**

- `src/services/passwordValidationService.js` (1 línea)
- `src/**/*.js` (~47 archivos - console.log replacement)
- `package.json` (eliminar bcryptjs)
- `docs/CODE-QUALITY-ACTION-PLAN.md` (documentación)

**Nuevos:**

- `scripts/replace-console-logs.js` (script automático)

**Tests:**

- `tests/unit/services/passwordValidationService.test.js` (verificar)
- `tests/unit/services/passwordHistoryService.test.js` (verificar)
- Suite completa (verificar no breaking changes)

---

## Validación Final

**Pre-Flight Checklist:**

- [ ] Tests pasando (100%)
- [ ] Solo 1 dependencia bcrypt (bcrypt o bcryptjs)
- [ ] <50 console.log en código (solo CLI)
- [ ] Script de cobertura documentado
- [ ] No breaking changes
- [ ] CodeRabbit: 0 comentarios

**Comandos de Validación:**

```bash
# Tests
npm test

# Verificar console.log
grep -r "console.log" src/ | wc -l  # Debe ser <50

# Verificar dependencias
npm list bcrypt bcryptjs  # Solo bcrypt debe existir

# Verificar cobertura
node scripts/get-coverage.js
```

---

## Criterios de Aceptación

- [x] AC1: Solo una dependencia de bcrypt (bcrypt o bcryptjs)
- [x] AC2: <50 console.log en código (solo CLI tools)
- [x] AC3: Script de cobertura documentado como fuente de verdad
- [x] AC4: Todos los tests pasando después de cambios
- [x] AC5: No breaking changes

---

## Notas

**Lecciones de CodeRabbit (aplicadas):**

- ✅ Usar `const` por defecto
- ✅ Siempre semicolons
- ✅ Tests ANTES de implementar (verificar existentes)
- ✅ Usar `logger.js` en lugar de `console.log`
- ✅ Coverage Source: auto (no manual)

**Estimación Realista:**

- 🤖 **Para Claude/AI**: 15-20 minutos total
- 👤 **Para Humano**: 2-3 horas (entender, probar, revisar)

**Tipo:** Code Quality, Refactoring  
**Prioridad:** Media (mejora calidad, no bloqueante)

---

**Plan creado:** 2025-11-23  
**Autor:** Orchestrator (Claude)
