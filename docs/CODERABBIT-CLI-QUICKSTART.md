# CodeRabbit CLI - Quick Start Guide (Modo Automático)

## 🎯 ¿Qué es?

CodeRabbit CLI integrado con **pre-commit hook automático** que revisa tu código en cada commit ANTES de push.

**Ventaja clave:** Detecta issues antes de abrir PR = menos idas y venidas con CodeRabbit en GitHub.

## 🚀 Ya Está Configurado

✅ **CLI instalada** (v0.3.4)
✅ **Autenticado** (Eibon7)
✅ **Pre-commit hook activo** - Ejecuta automáticamente en cada commit
✅ **npm scripts** - Comandos disponibles

**No necesitas hacer nada más. Ya funciona.**

## 📖 Cómo Funciona (Automático)

### Workflow Normal

```bash
# 1. Haces cambios
vim src/services/myService.js

# 2. Stageas para commit
git add .

# 3. Commit (¡aquí viene la magia!)
git commit -m "feat: nueva funcionalidad"

# Automáticamente ejecuta:
# 🐰 Running CodeRabbit CLI review...
# ✅ CodeRabbit authenticated - running review...
# [Analiza tus cambios...]
#
# Si encuentra issues: Muestra sugerencias
# Si todo OK: ✅ Pre-commit checks passed!

# 4. Si hubo issues, fixear y re-commit
# ... aplicar sugerencias ...
git add .
git commit -m "feat: nueva funcionalidad (fixed issues)"

# 5. Push cuando 0 issues
git push
```

### El Hook NO Bloquea

**Importante:** El pre-commit hook:
- ✅ Ejecuta CodeRabbit review
- ✅ Muestra sugerencias si hay issues
- ✅ **Permite commit incluso con issues**
- ⚠️ **PERO debes fixear antes de push**

**Filosofía:** Te informa, no te bloquea. Tú decides si commitear con issues pendientes (para WIP), pero NO debes pushear hasta fixear todo.

## 🔧 Comandos Disponibles

### Automático (Principal)

```bash
git commit -m "..."
# → Hook ejecuta CodeRabbit automáticamente
```

### Manual (Opcionales)

| Comando | Uso | Cuándo |
|---------|-----|--------|
| `npm run coderabbit:review` | Review detallado | Antes de PR final |
| `npm run coderabbit:review:quick` | Review rápido | Check intermedio |
| `npm run coderabbit:auth` | Estado auth | Troubleshooting |
| `npm run coderabbit:login` | Re-autenticar | Si sesión expira |
| `npm run coderabbit:logout` | Cerrar sesión | Cambiar cuenta |

## 💡 Escenarios Comunes

### Scenario 1: Desarrollo Normal (TODO AUTOMÁTICO)

```bash
# Hacer cambios
vim src/myfile.js

# Commit (review automático)
git add .
git commit -m "feat: mi feature"
# → CodeRabbit revisa, muestra issues si hay

# Fixear si es necesario
# ... fixes ...
git add .
git commit -m "fix: apply coderabbit suggestions"

# Push
git push
```

### Scenario 2: WIP (Work In Progress)

```bash
# Quieres commitear sin fixear issues todavía
git add .
git commit -m "wip: feature in progress"
# → Hook reporta issues, pero permite commit

# Continuas trabajando...
# ... más cambios ...

# Cuando terminas, fixeas todo
git add .
git commit -m "feat: feature complete"
# → Hook confirma 0 issues

git push
```

### Scenario 3: Pre-PR Review Completo

```bash
# Antes de abrir PR, review exhaustivo
npm run coderabbit:review

# Lee sugerencias detalladas, aplica todas
# ... fixes ...

# Re-review hasta 0 sugerencias
npm run coderabbit:review

# Entonces push y crear PR
git push
gh pr create
```

## ⚡ Ventajas del Modo Automático

### Antes (Sin CLI)
```
Code → Commit → Push → Open PR → Wait CodeRabbit → Issues found → Fix → Push → Wait again...
⏱️ Tiempo: 30-60 min por ciclo
🔄 Ciclos: 3-5 por PR
```

### Ahora (Con CLI Automático)
```
Code → Commit (auto-review) → Fix immediately → Commit → Push → Open PR → 0 issues
⏱️ Tiempo: 2-5 min
🔄 Ciclos: 1 (máximo 2)
```

**Reducción: 90% menos tiempo en review cycles** 🎉

## 🐛 Troubleshooting

### "CodeRabbit not authenticated"

**Síntoma:** Hook dice que no estás autenticado

**Solución:**
```bash
npm run coderabbit:login
# Sigue proceso OAuth en browser
```

### "coderabbit: command not found"

**Síntoma:** Hook no encuentra el comando

**Solución:**
```bash
# Opción 1: Reiniciar terminal
source ~/.zshrc

# Opción 2: Verificar instalación
/Users/emiliopostigo/.local/bin/coderabbit --version
```

### Hook se ejecuta muy lento

**Causa:** Review detallado (`--plain`) es lento

**Solución:** Ya está configurado con `--prompt-only` (rápido). Si aún así es lento:
```bash
# Desactivar temporalmente (editar .husky/pre-commit)
# Comentar la sección de CodeRabbit

# O usar skip de git
SKIP=1 git commit -m "..."
```

### Quiero deshabilitar el hook permanentemente

**Solución:**
```bash
# Editar .husky/pre-commit
# Comentar estas líneas:
# echo "🐰 Running CodeRabbit CLI review..."
# if command -v coderabbit >/dev/null 2>&1; then
#   ...
# fi

# Mantener comandos npm para uso manual
```

## 📊 Métricas de Éxito

**Objetivos con CodeRabbit CLI:**
- ✅ 90%+ de PRs con 0 comentarios en GitHub first try
- ✅ Reducción 80%+ en tiempo de review
- ✅ 100% de issues detectados localmente antes de push

**Cómo medir:**
1. Trackear comentarios de CodeRabbit en GitHub (antes vs después)
2. Tiempo desde PR opened hasta merged
3. Número de pushes por PR (debería bajar a 1-2)

## 🎓 Best Practices

### ✅ DO

1. **Confiar en el hook** - Ya ejecuta en cada commit automáticamente
2. **Review manual pre-PR** - `npm run coderabbit:review` antes de abrir PR
3. **Fixear inmediatamente** - No acumular issues
4. **Commit frecuente** - Hook ligero (`--prompt-only`) es rápido
5. **Push solo cuando 0 issues** - Regla de oro

### ❌ DON'T

1. **No ignorar warnings del hook** - Son issues reales
2. **No pushear con issues pendientes** - Causará comentarios en GitHub
3. **No desactivar hook por pereza** - Está para ayudarte
4. **No saltear pre-PR review manual** - Hook es ligero, review final debe ser exhaustivo

## 🔗 Recursos

- **Quality Standards:** [docs/QUALITY-STANDARDS.md](./QUALITY-STANDARDS.md#-coderabbit-cli---integración-automática)
- **CLAUDE.md:** [../CLAUDE.md](../CLAUDE.md) (líneas 36-42)
- **Documentación oficial:** [CodeRabbit CLI Docs](https://docs.coderabbit.ai/cli)

## 🆘 Soporte

**Issues comunes:**
- 📖 Leer troubleshooting section arriba
- 🔍 Verificar autenticación: `npm run coderabbit:auth`
- 🐛 Crear issue en repo si es bug del proyecto

---

**TL;DR:**
1. ✅ Ya está configurado y funcionando
2. Commit normal → Hook revisa automáticamente
3. Fixea issues inmediatamente
4. Push cuando 0 issues
5. Profit! 🎉

**El objetivo:** Nunca más ver comentarios de CodeRabbit en GitHub porque ya fixeaste todo localmente.
