# 🚀 Quick Start: GDD + Agents + Skills en Cursor

**Para empezar a usar el sistema AHORA mismo.**

---

## ⚡ Setup Rápido (2 minutos)

```bash
# 1. Verificar que todo está configurado
node scripts/cursor-agents/setup-migration.js --check

# 2. Si todo está ✅, ya puedes empezar
# Si hay elementos faltantes, ejecutar:
node scripts/cursor-agents/setup-migration.js
```

---

## 📋 Para Cada Nueva Tarea

### Paso 1: Copiar Prompt

Abrir `docs/PROMPT-INICIAL-TAREA.md` y copiar el prompt completo.

### Paso 2: Reemplazar Issue Number

```
Trabaja en la issue #XXX
```

Reemplazar `#XXX` con el número real de issue.

### Paso 3: Pegar en Cursor Chat

El sistema ejecutará automáticamente:
- ✅ FASE 0: Auto-activación GDD
- ✅ FASE 1: Planning (si AC ≥3)
- ✅ FASE 2: Detección de agents
- ✅ FASE 3: Implementation
- ✅ FASE 4: Validation
- ✅ FASE 5: PR + Receipts

---

## 🎯 Comandos Esenciales

### GDD

```bash
# Auto-activar GDD para issue
node scripts/cursor-agents/auto-gdd-activation.js [issue-number]

# Resolver dependencias
node scripts/resolve-graph.js <nodos>

# Validar
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci
```

### Agents

```bash
# Detectar qué agent usar
node scripts/cursor-agents/detect-triggers.js
```

### Tests

```bash
npm test
npm run test:coverage
```

---

## 📚 Documentación

- **Prompt inicial:** `docs/PROMPT-INICIAL-TAREA.md`
- **Guía migración:** `docs/CURSOR-MIGRATION-GUIDE.md`
- **GDD guide:** `docs/GDD-ACTIVATION-GUIDE.md`
- **Beneficios:** `docs/GDD-BENEFITS-ANALYSIS.md`
- **Adopción completa:** `docs/ADOPTION-COMPLETE.md`

---

## ✅ Checklist Pre-PR

Antes de crear PR, verificar:

- [ ] Tests pasando: `npm test`
- [ ] Coverage >=90%: `npm run test:coverage`
- [ ] GDD validado: `node scripts/validate-gdd-runtime.js --full`
- [ ] Health >=87: `node scripts/score-gdd-health.js --ci`
- [ ] Receipts presentes: `ls docs/agents/receipts/cursor-*`
- [ ] CodeRabbit = 0: `npm run coderabbit:review`

---

## 🎉 ¡Listo!

El sistema está **100% operativo**. Solo copia el prompt y empieza a trabajar.

**Calidad > Velocidad. Producto monetizable.**

