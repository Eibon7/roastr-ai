# Worktree Workflow para Cursor

**Sistema de trabajo con worktrees para desarrollo paralelo de issues**

---

## 🎯 Concepto

Cada issue se trabaja en un **worktree separado** (directorio filesystem independiente) para permitir:

- ✅ Trabajo paralelo en múltiples issues sin cambiar de rama
- ✅ Múltiples agentes trabajando sin conflictos
- ✅ Aislamiento total entre issues
- ✅ `.issue_lock` local sin colisiones

---

## 📁 Estructura

```
/Users/emiliopostigo/roastr-ai/              # Repo principal
/Users/emiliopostigo/roastr-ai-worktrees/    # Worktrees
  ├── issue-1033/                            # Issue #1033
  │   ├── .git → ../../roastr-ai/.git       # Link al repo
  │   ├── .issue_lock                        # Local: "feature/issue-1033-main"
  │   └── src/                               # Working directory
  ├── issue-1044/                            # Issue #1044
  │   ├── .git → ../../roastr-ai/.git
  │   ├── .issue_lock                        # Local: "feature/issue-1044-main"
  │   └── src/
  └── issue-914/                             # Issue #914
      ├── .git → ../../roastr-ai/.git
      ├── .issue_lock                        # Local: "feature/issue-914-main"
      └── src/
```

---

## 🚀 Workflow Manual

### 1. Crear worktree para nueva issue

```bash
# Desde repo principal
cd /Users/emiliopostigo/roastr-ai

# Crear worktree con nueva rama
git worktree add ../roastr-ai-worktrees/issue-1033 -b feature/issue-1033-main

# Ir al worktree
cd ../roastr-ai-worktrees/issue-1033

# Crear .issue_lock
echo "feature/issue-1033-main" > .issue_lock

# Auto-activar GDD (si aplica)
node scripts/cursor-agents/auto-gdd-activation.js 1033
```

### 2. Trabajar en el worktree

```bash
# Abrir en Cursor
cursor .

# Trabajar normalmente
# Los hooks validarán .issue_lock automáticamente

# Commits
git add .
git commit -m "feat: implement..."  # Hook verifica .issue_lock

# Push
git push origin feature/issue-1033-main
```

### 3. Al terminar

```bash
# Volver al repo principal
cd /Users/emiliopostigo/roastr-ai

# Eliminar worktree (después de merge)
git worktree remove ../roastr-ai-worktrees/issue-1033

# .issue_lock se elimina automáticamente
```

---

## 🤖 Workflow Automatizado (Recomendado)

### Usar script helper

```bash
# Desde repo principal
./scripts/create-worktree-for-issue.sh 1033 main

# Output:
# ✅ Worktree created: ../roastr-ai-worktrees/issue-1033
# ✅ Branch: feature/issue-1033-main
# ✅ Lock: .issue_lock created
# ✅ GDD auto-activated

# Ir directamente al worktree
cd ../roastr-ai-worktrees/issue-1033

# Abrir en Cursor
cursor .
```

### Ejemplos con scopes

```bash
# Setup de issue
./scripts/create-worktree-for-issue.sh 1033 setup
# → feature/issue-1033-setup

# Tests de issue
./scripts/create-worktree-for-issue.sh 1033 tests
# → feature/issue-1033-tests

# Docs de issue
./scripts/create-worktree-for-issue.sh 1044 docs
# → feature/issue-1044-docs
```

---

## 🔒 Sistema de Branch Guard

### ¿Qué es `.issue_lock`?

Archivo local (por worktree) que contiene el nombre de la rama autorizada:

```bash
# En worktree issue-1033
cat .issue_lock
# Output: feature/issue-1033-main
```

### ¿Cómo funciona?

Los git hooks validan que estás en la rama correcta:

```bash
# Pre-commit hook
LOCKED_BRANCH=$(cat .issue_lock)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$CURRENT_BRANCH" != "$LOCKED_BRANCH" ]; then
  echo "❌ ERROR: Branch mismatch"
  exit 1
fi
```

### ¿Por qué no hay conflictos entre worktrees?

Cada worktree es un **directorio separado** en el filesystem:

```
/Users/emiliopostigo/roastr-ai-worktrees/issue-1033/.issue_lock
/Users/emiliopostigo/roastr-ai-worktrees/issue-1044/.issue_lock
# ↑ Archivos diferentes en disco, NO HAY COLISIÓN
```

---

## 🎭 Múltiples Agentes / Desarrolladores

### Escenario: 2 agentes en misma issue

```bash
# Agent A (Orchestrator)
./scripts/create-worktree-for-issue.sh 1033 main
cd ../roastr-ai-worktrees/issue-1033
# .issue_lock: "feature/issue-1033-main"

# Agent B (TestEngineer) - en paralelo
./scripts/create-worktree-for-issue.sh 1033 tests
cd ../roastr-ai-worktrees/issue-1033-tests  # ← Diferente directorio
# .issue_lock: "feature/issue-1033-tests"

# NO HAY CONFLICTO - son directorios separados
```

---

## 📋 Comandos Útiles

### Listar worktrees activos

```bash
git worktree list

# Output:
# /Users/emiliopostigo/roastr-ai            abc123 [main]
# /Users/.../roastr-ai-worktrees/issue-1033 def456 [feature/issue-1033-main]
# /Users/.../roastr-ai-worktrees/issue-1044 ghi789 [feature/issue-1044-main]
```

### Eliminar worktree

```bash
# Desde repo principal
git worktree remove ../roastr-ai-worktrees/issue-1033

# O forzar si hay cambios sin commitear
git worktree remove ../roastr-ai-worktrees/issue-1033 --force
```

### Limpiar worktrees huérfanos

```bash
# Si eliminaste el directorio manualmente
git worktree prune
```

### Mover worktree

```bash
# 1. Eliminar worktree (sin borrar archivos)
git worktree remove ../roastr-ai-worktrees/issue-1033

# 2. Mover directorio
mv ../roastr-ai-worktrees/issue-1033 /nueva/ubicacion/

# 3. Re-añadir en nueva ubicación
git worktree add /nueva/ubicacion/issue-1033 feature/issue-1033-main
```

---

## ⚠️ Troubleshooting

### Error: "Branch already exists"

```bash
# Si la rama ya existe
git worktree add ../roastr-ai-worktrees/issue-1033 feature/issue-1033-main
# ❌ fatal: 'feature/issue-1033-main' already exists

# Solución: usar rama existente (sin -b)
git worktree add ../roastr-ai-worktrees/issue-1033 feature/issue-1033-main
```

### Error: "Worktree already exists"

```bash
# Si el directorio ya existe
# Eliminar primero
rm -rf ../roastr-ai-worktrees/issue-1033
# O usar git worktree remove
git worktree remove ../roastr-ai-worktrees/issue-1033
```

### Error: ".issue_lock mismatch"

```bash
# Si cambiaste de rama manualmente
git checkout otra-rama
git commit  # ❌ ERROR: .issue_lock = "feature/issue-1033-main"

# Solución: volver a rama correcta
git checkout feature/issue-1033-main

# O actualizar .issue_lock
echo "$(git rev-parse --abbrev-ref HEAD)" > .issue_lock
```

---

## 🎯 Best Practices

### DO ✅

- Crear un worktree por issue
- Usar script helper para automatizar
- Dejar `.issue_lock` intacto (auto-gestionado)
- Eliminar worktrees después de merge
- Usar scopes descriptivos (setup, tests, docs)

### DON'T ❌

- NO commitear `.issue_lock` (ya está en .gitignore)
- NO compartir worktrees entre issues
- NO cambiar de rama dentro de un worktree manualmente
- NO editar `.issue_lock` a mano (salvo troubleshooting)
- NO dejar worktrees huérfanos sin limpiar

---

## 🔗 Referencias

- **Git Worktrees Docs:** https://git-scm.com/docs/git-worktree
- **Script helper:** `scripts/create-worktree-for-issue.sh`
- **Git hooks:** `.git/hooks/pre-commit`, `.git/hooks/commit-msg`
- **Branch Guard:** Sistema de protección con `.issue_lock`

---

## 📊 Ventajas vs. Desventajas

### Ventajas ✅

- Trabajo paralelo real (sin cambiar de rama)
- Aislamiento total entre issues
- Múltiples agentes sin conflictos
- Context switching más rápido (Cursor)
- Cada issue tiene su entorno

### Desventajas ❌

- Más uso de disco (1 working directory por worktree)
- Requiere comandos adicionales (setup/cleanup)
- Curva de aprendizaje inicial
- Dependencias node_modules duplicadas (opcional: usar pnpm)

---

**Última actualización:** 2025-11-26  
**Maintainer:** DevOps / Orchestrator  
**Status:** ✅ Active

