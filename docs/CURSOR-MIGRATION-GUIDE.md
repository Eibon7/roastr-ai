# Guía de Migración: Claude Code → Cursor

**Fecha:** 2025-01-XX  
**Estado:** ✅ Plan completo, scripts listos

---

## 🎯 Resumen Ejecutivo

Esta guía documenta la migración del framework GDD, agents y skills de Claude Code a Cursor. **El objetivo es mantener 100% de compatibilidad funcional** mientras aprovechamos las ventajas de Cursor (contexto selectivo, Composer, IDE integrado).

---

## ✅ Lo que funciona IGUAL (sin cambios)

### 1. GDD Scripts
Todos los scripts Node.js funcionan exactamente igual:

```bash
# Validación
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci
node scripts/predict-gdd-drift.js --full

# Resolución de dependencias
node scripts/resolve-graph.js roast shield queue

# Auto-repair
node scripts/auto-repair-gdd.js --auto-fix
```

**Ventaja de Cursor:** Ejecutar desde terminal integrado (`⌃` + backtick) sin cambiar de aplicación.

### 2. Estructura de Documentación
- `docs/nodes/*.md` - Nodos GDD (sin cambios)
- `docs/plan/*.md` - Planes de features (sin cambios)
- `docs/agents/receipts/` - Receipts (formato adaptado)
- `agents/manifest.yaml` - Manifest de agents (sin cambios)

### 3. CI/CD y Validaciones
Todos los workflows de CI/CD funcionan igual. Los scripts de validación son los mismos.

---

## 🔄 Lo que CAMBIA (adaptación necesaria)

### 1. Skills → `.cursorrules`

**Antes (Claude Code):**
```
.claude/skills/test-generation-skill.md
.claude/skills/gdd-sync-skill.md
```

**Ahora (Cursor):**
```
.cursorrules  # Consolidado, se carga automáticamente
```

**Migración:**
```bash
# 1. Crear .cursorrules desde CLAUDE.md
cp CLAUDE.md .cursorrules

# 2. Añadir skills
cat >> .cursorrules << 'EOF'

## Skills (from .claude/skills/)

### Test Generation Skill
[contenido de test-generation-skill.md]

### GDD Sync Skill
[contenido de gdd-sync-skill.md]

[... resto de skills]
EOF
```

**Ventaja:** `.cursorrules` se carga automáticamente en cada conversación. No necesitas invocar skills explícitamente.

### 2. Agents → Composer Workflows

**Antes (Claude Code):**
```
Task tool → Invoke TestEngineer → Auto-execute
```

**Ahora (Cursor):**
```
1. Detectar triggers: node scripts/cursor-agents/detect-triggers.js
2. Abrir Composer: Cmd+I
3. Seleccionar archivos: @tests/ @src/roastService.js
4. Prompt: "Generate tests following test-generation-skill"
5. Crear receipt manual
```

**Script Helper:**
```bash
# Detectar qué agent usar
node scripts/cursor-agents/detect-triggers.js

# Output:
# 🎯 Agents sugeridos:
# 1. TestEngineer (score: 15)
#    ✓ Archivo modificado: src/roastService.js
#    ✓ Label: test:unit
#
# 💡 Sugerencia de Composer:
#    Composer: Cmd+I → @tests/ @src/roastService.js
#    Prompt: "Generate comprehensive tests..."
```

### 3. Receipts (formato adaptado)

**Antes (Claude Code):**
```
docs/agents/receipts/pr-734-TestEngineer.md
```

**Ahora (Cursor):**
```
docs/agents/receipts/cursor-test-engineer-1735123456.md
```

El script `detect-triggers.js` crea receipts automáticamente con el formato correcto.

---

## 🚀 Workflow Diario en Cursor

### Ejemplo: Nueva Feature (Issue #800)

```bash
# 1. FASE 0 - Assessment
gh issue view 800 --json body,labels

# 2. GDD Resolution (igual que antes)
node scripts/resolve-graph.js roast shield queue

# 3. En Cursor Chat:
# @docs/nodes/roast.md @docs/nodes/shield.md
# "Implementar feature X según nodos GDD"

# 4. Durante implementación - Detectar triggers:
node scripts/cursor-agents/detect-triggers.js

# 5. Abrir Composer con sugerencia:
# Cmd+I → @tests/ @src/roastService.js
# Prompt: "Generate tests siguiendo test-generation-skill"

# 6. Validación (igual que antes)
npm test
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci

# 7. Receipt ya está creado por detect-triggers.js
# Solo verificar que está completo
```

---

## 📋 Checklist de Migración

### Fase 1: Setup Inicial

- [ ] Crear `.cursorrules` desde `CLAUDE.md`
- [ ] Consolidar skills en `.cursorrules`
- [ ] Verificar que Cursor carga `.cursorrules` correctamente

### Fase 2: Scripts Helper

- [ ] Crear `scripts/cursor-agents/detect-triggers.js`
- [ ] Probar detección de triggers
- [ ] Verificar creación de receipts

### Fase 3: Documentación

- [ ] Crear esta guía (`docs/CURSOR-MIGRATION-GUIDE.md`)
- [ ] Actualizar `CLAUDE.md` con nota de migración
- [ ] Documentar workflows específicos de Cursor

### Fase 4: Validación

- [ ] Probar workflow completo con issue real
- [ ] Verificar que GDD scripts funcionan igual
- [ ] Confirmar que receipts se crean correctamente
- [ ] Validar que CI/CD sigue funcionando

---

## 🎁 Ventajas de Cursor

### 1. Contexto Selectivo con @-mentions

**Antes:**
```javascript
// Cargar spec.md completo (5000+ líneas)
```

**Ahora:**
```javascript
// Solo cargar nodos relevantes
@docs/nodes/roast.md @docs/nodes/shield.md
```

**Ahorro:** 70-93% menos contexto según GDD metrics.

### 2. Composer Multi-file Editing

**Antes:**
```
Task tool → Agent ejecuta → Resultado
```

**Ahora:**
```
Composer → Seleccionar múltiples archivos → Editar en paralelo
```

**Ventaja:** Control total sobre qué se edita y cómo.

### 3. IDE Integrado

- Terminal integrado (`⌃` + backtick)
- Diff view nativo (Cmd+Shift+G)
- Git integration completa
- No context switching

### 4. Receipts Automáticos

El script `detect-triggers.js` crea receipts automáticamente con:
- Agent detectado
- Archivos modificados
- Sugerencia de Composer
- Guardrails relevantes

---

## 🔧 Troubleshooting

### Problema: Cursor no carga `.cursorrules`

**Solución:**
1. Verificar que el archivo existe en root del proyecto
2. Reiniciar Cursor
3. Verificar que no hay errores de sintaxis en `.cursorrules`

### Problema: `detect-triggers.js` no detecta cambios

**Solución:**
```bash
# Verificar que hay cambios
git status

# Forzar detección de staged files
node scripts/cursor-agents/detect-triggers.js --staged

# Verificar que estamos en rama correcta
git rev-parse --abbrev-ref HEAD
```

### Problema: Receipts no se crean

**Solución:**
```bash
# Verificar que el directorio existe
mkdir -p docs/agents/receipts

# Verificar permisos
ls -la docs/agents/receipts
```

---

## 📚 Referencias

- **GDD Framework:** `docs/GDD-ACTIVATION-GUIDE.md`
- **Agent Manifest:** `agents/manifest.yaml`
- **Skills:** `.claude/skills/`
- **Scripts GDD:** `scripts/*gdd*.js`

---

## 💡 Recomendaciones

1. **Migración gradual:** Empezar con un issue pequeño para probar el workflow
2. **Mantener ambos sistemas:** Durante transición, mantener receipts en ambos formatos
3. **Documentar problemas:** Añadir a esta guía cualquier issue encontrado
4. **Automatizar más:** Considerar crear más scripts helper según necesidades

---

**Última actualización:** 2025-01-XX  
**Mantenido por:** Orchestrator / Cursor Team

