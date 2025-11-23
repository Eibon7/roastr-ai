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

- Formato de rama: `(feature|fix|chore|docs|test|refactor|perf|ci|build|style)/issue-<id>` o `feat/epic-<id>-week-<N>`
- Referencia obligatoria a Issue en título o descripción
- **Excepción:** Ramas de Dependabot (`dependabot/*`) se omiten automáticamente (no tienen issues asociadas)

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

- **Rama:** `<prefijo>/issue-<id>` donde `<prefijo>` puede ser:
  - `feature` - Nueva funcionalidad
  - `fix` - Corrección de errores
  - `chore` - Tareas de mantenimiento
  - `docs` - Cambios en documentación
  - `test` - Añadir o modificar tests
  - `refactor` - Refactorización de código
  - `perf` - Mejoras de rendimiento
  - `ci` - Cambios en CI/CD
  - `build` - Cambios en sistema de build
  - `style` - Cambios de formato (sin afectar funcionalidad)
  - `feat/epic-<id>-week-<N>` - Trabajo de épicas por semana
- **Título/Descripción:** Debe incluir `Issue #<id>`

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
Branch incorrecta: myfeature/issue-362
Formatos válidos:
  - (feature|fix|chore|docs|test|refactor|perf|ci|build|style)/issue-<id>
  - feat/epic-<id>-week-<N>
```

**Solución:** Renombrar rama con uno de los prefijos válidos.

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
