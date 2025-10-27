# 🔐 Branch Guard - Sistema de Protección por Rama

## Resumen

Sistema de protección que impide trabajar en ramas incorrectas mediante candado local (`.issue_lock`) y validación automática en cada commit/push.

## Componentes

### 1. Candado Local (`.issue_lock`)

**Ubicación:** `<repo-root>/.issue_lock`

**Contenido:** Nombre de la rama esperada (ej: `feature/issue-362`)

**Estado:** Excluido del repositorio (`.git/info/exclude`)

### 2. Hooks Git

#### `.git/hooks/pre-commit`
- Verifica existencia de `.issue_lock`
- Compara rama actual vs rama esperada
- Bloquea si no coincide

#### `.git/hooks/commit-msg`
- Exige formato: `Issue #<id>` en mensaje de commit
- Ejemplo válido: `feat(settings): sliders shield — Issue #362`

#### `.git/hooks/pre-push`
- Valida candado antes de push
- Bloquea push directo a `main`/`master`

### 3. Acción GitHub (`.github/workflows/pr-branch-guard.yml`)

**Trigger:** Pull Request (abrir/actualizar)

**Validaciones:**
- Formato de rama: `feature/issue-<id>` | `fix/issue-<id>` | `chore/issue-<id>`
- Referencia obligatoria a Issue en título o descripción

### 4. Script de Ayuda (`scripts/use-issue.sh`)

Automatiza creación de rama + candado.

## Flujo de Uso (5 Pasos)

### Paso 1: Iniciar trabajo en issue

```bash
# Opción A: Script automático (recomendado)
scripts/use-issue.sh 362

# Opción B: Manual
git checkout -b feature/issue-362
echo "feature/issue-362" > .issue_lock
```

### Paso 2: Trabajar normalmente

Realiza cambios en el código. El hook `pre-commit` asegura que estás en la rama correcta.

### Paso 3: Commit con referencia a Issue

```bash
# ✅ Válido
git commit -m "feat(settings): add sliders — Issue #362"
git commit -m "fix(billing): correct calculation Issue #363"

# ❌ Rechazado (falta Issue #)
git commit -m "feat(settings): add sliders"
```

### Paso 4: Push (validado automáticamente)

```bash
git push
```

El hook `pre-push` verifica:
- Existencia de `.issue_lock`
- Rama actual coincide con candado
- No es push directo a main/master

### Paso 5: Crear Pull Request

Formato requerido:
- **Rama:** `feature/issue-362` (o `fix/issue-362`, `chore/issue-362`)
- **Título/Descripción:** Debe incluir `Issue #362`

El workflow `.github/workflows/pr-branch-guard.yml` valida ambos requisitos.

## Ejemplos de Error

### Error: Rama incorrecta en commit
```
❌ Rama incorrecta: estás en 'feature/issue-363' pero .issue_lock exige 'feature/issue-362'.
   Cambia con: git checkout feature/issue-362
```
**Solución:** Cambiar a la rama correcta o actualizar `.issue_lock`.

### Error: Falta referencia a Issue
```
❌ El commit debe incluir 'Issue #<id>' en el mensaje.
   Ejemplo: feat(settings): sliders shield — Issue #362
```
**Solución:** Incluir `Issue #<id>` en el mensaje de commit.

### Error: Branch incorrecta en PR
```
Branch incorrecta: feat/issue-362 (usa feature|fix|chore/issue-<id>)
```
**Solución:** Renombrar rama con prefijo correcto (`feature`, `fix`, o `chore`).

## Liberar Candado

Al terminar el issue:

```bash
# Opción A: Borrar candado (trabajo completado)
rm .issue_lock

# Opción B: Actualizar candado (trabajar en nueva issue)
echo "feature/issue-365" > .issue_lock
```

## Verificación de Estado

```bash
# Ver candado actual
cat .issue_lock

# Ver rama actual
git rev-parse --abbrev-ref HEAD

# Verificar permisos de hooks
ls -l .git/hooks/pre-commit .git/hooks/commit-msg .git/hooks/pre-push
```

## Troubleshooting

### Los hooks no se ejecutan
```bash
# Reestablecer permisos
chmod +x .git/hooks/pre-commit .git/hooks/commit-msg .git/hooks/pre-push
```

### Ignorar hooks temporalmente (⚠️ no recomendado)
```bash
git commit --no-verify
git push --no-verify
```

## Protecciones Activas

✅ Bloqueo de rama incorrecta en commits  
✅ Exigencia de formato `Issue #<id>` en commits  
✅ Bloqueo de push directo a main/master  
✅ Validación de formato de rama en PR  
✅ Exigencia de referencia a Issue en PR


