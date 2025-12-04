# Linear Integration Guide - Roastr.AI

**Estado:** ✅ Integrado  
**Fecha:** 2025-12-03  
**SDK:** `@linear/sdk`

---

## 🎯 Overview

Roastr.AI está integrado con Linear para gestión de issues y planning, manteniendo GitHub para code review y PRs.

**Workflow Híbrido:**
```
Linear (Issues & Planning) ←→ GitHub (PRs & Code Review)
         ROA-123                      #1094
```

---

## 🔧 Configuración

### 1. Obtener Personal API Key

1. Ve a: https://linear.app/settings/api
2. En la sección **"Personal API keys"**
3. Click "**Create key**"
4. Nombre: `Roastr.AI Cursor Integration`
5. Permisos: Por defecto tiene acceso completo (read/write)
6. Copia el token: `lin_api_...`

⚠️ **Importante:** Usa una **Personal API key**, NO una Application key. Las Personal keys tienen acceso completo a tu workspace.

### 2. Configurar Environment

Añade a tu `.env`:

```bash
# Linear Integration
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LINEAR_TEAM_ID=TEAM_ID_OPCIONAL  # Si tienes múltiples equipos
```

### 3. Verificar Instalación

```bash
# Ver teams disponibles
npm run linear:teams

# Expected output:
# 📊 Linear Teams:
# 1. Roastr.AI
#    Key: ROA
#    ID: xxxx-xxxx-xxxx
```

---

## 📝 Comandos Disponibles

### Crear Issue

```bash
npm run linear:create -- --title "Security: Enable RLS" --description "Fix RLS policies" --priority 1

# Prioridades:
# 0 = None
# 1 = Urgent (🔴)
# 2 = High (🟠) [default]
# 3 = Medium (🟡)
# 4 = Low (🟢)
```

**Output:**
```
✅ Issue created in Linear:
   ID: ROA-124
   Title: Security: Enable RLS
   URL: https://linear.app/roastr-ai/issue/ROA-124
```

### Actualizar Issue

```bash
# Cambiar estado
npm run linear:update -- --id ROA-123 --status "In Progress"

# Cambiar título
npm run linear:update -- --id ROA-123 --title "New title"

# Estados disponibles:
# - Todo
# - In Progress
# - Done
# - Canceled
```

### Listar Issues

```bash
# Todas las issues
npm run linear:list

# Filtrar por estado
npm run linear:list -- --state "Todo"
npm run linear:list -- --state "In Progress"
```

### Sincronizar con GitHub

```bash
# Vincular issue de Linear con issue de GitHub
npm run linear:sync -- --linear ROA-123 --github 1093

# Esto añade referencia cruzada en la descripción de Linear
```

---

## 🔄 Workflow Completo

### Caso 1: Issue en Linear → PR en GitHub

```bash
# 1. Crear issue en Linear (manual o via npm)
# Linear asigna ID: ROA-125

# 2. Crear rama local
git checkout -b issue-roa-125-feature-name

# 3. Implementar feature
# ... código ...

# 4. Commit con referencia
git commit -m "feat: Implement feature - ROA-125"

# 5. Crear PR en GitHub
gh pr create --title "feat: Implement feature" --body "Fixes ROA-125"

# 6. Linear detecta automáticamente la referencia y vincula
# (si tienes GitHub sync configurado en Linear)
```

### Caso 2: Usar ambas nomenclaturas

Puedes referenciar tanto Linear como GitHub en commits:

```bash
git commit -m "fix(security): Enable RLS

Fixes ROA-123
Fixes #1093

Migration 057 applied with 12 RLS policies."
```

Linear y GitHub reconocerán sus respectivas referencias.

---

## 🤖 Integración con Cursor/Claude

### Cuando trabajas conmigo:

**Puedes decirme:**
- ✅ "Trabaja en ROA-123" (uso Linear API para obtener detalles)
- ✅ "Trabaja en #1093" (uso GitHub CLI)
- ✅ "Crea issue en Linear para este fix"
- ✅ "Actualiza ROA-123 a In Progress"
- ✅ "Crea PR para ROA-123"

**Yo puedo:**
- ✅ Crear issues en Linear programáticamente
- ✅ Actualizar estados automáticamente
- ✅ Listar y filtrar issues
- ✅ Sincronizar referencias cruzadas
- ✅ Crear PRs en GitHub referenciando Linear

---

## 📊 Ventajas del Setup Híbrido

| Aspecto | Linear | GitHub |
|---------|--------|--------|
| **Planning** | ✅ Issues, Roadmap, Cycles | ❌ Limitado |
| **Code Review** | ❌ No soportado | ✅ Excelente |
| **CI/CD** | ❌ No soportado | ✅ GitHub Actions |
| **Velocidad UI** | ⚡⚡⚡ Ultra-rápido | 🐌 Más lento |
| **Keyboard shortcuts** | ✅ Excelentes | ⚠️ Básicos |
| **Búsqueda** | ✅ Instant search | ⚠️ Más lenta |
| **Workflow states** | ✅ Customizable | 🔧 Manual |

**Lo mejor de ambos mundos:** Planning rápido en Linear + Code review sólido en GitHub.

---

## 🎯 Best Practices

### 1. Nomenclatura Consistente

**En commits:**
```bash
# Formato recomendado
git commit -m "type(scope): Description - ROA-123

Detailed explanation...

Fixes ROA-123
Fixes #1093"
```

**En PR descriptions:**
```markdown
## Summary
Implements feature X from Linear issue ROA-123

Fixes ROA-123
Fixes #1093
```

### 2. Sincronización Automática

Si configuras **Linear GitHub integration** en Linear Dashboard:
- ✅ PRs en GitHub aparecen automáticamente en Linear
- ✅ Merge de PR actualiza estado en Linear a "Done"
- ✅ Commits con "ROA-123" se vinculan automáticamente
- ✅ Branch names con "roa-123" se detectan

### 3. Estados Recomendados

| Linear State | Cuándo Usar |
|--------------|-------------|
| **Todo** | Issue creada, sin empezar |
| **In Progress** | Desarrollo activo |
| **In Review** | PR abierta, pendiente code review |
| **Done** | PR merged, issue cerrada |
| **Canceled** | Issue no se implementará |

### 4. Labels en Linear

Crear labels que reflejen las de GitHub:
- `security`, `priority:P0`, `area:frontend`, etc.
- Facilita filtrado y búsqueda
- Mantiene consistencia entre plataformas

---

## 🔍 Troubleshooting

### Error: "LINEAR_API_KEY not found"

**Solución:**
```bash
# Verifica que .env tiene la key
grep LINEAR_API_KEY .env

# Si no existe, añádela
echo "LINEAR_API_KEY=lin_api_..." >> .env

# Reload dotenv
source .env
```

### Error: "No teams found"

**Causa:** API key inválida o permisos insuficientes  
**Solución:**
1. Regenera API key en Linear Dashboard
2. Verifica permisos `read` y `write`
3. Actualiza `.env` con nueva key

### Issue no se sincroniza con GitHub

**Verifica:**
1. GitHub integration habilitada en Linear: Settings → Integrations → GitHub
2. Repo correcto conectado: `Eibon7/roastr-ai`
3. Referencias correctas en commits: `ROA-123` (mayúsculas)

---

## 📚 Recursos

### Linear
- **Dashboard:** https://linear.app
- **API Docs:** https://developers.linear.app/docs/graphql/working-with-the-graphql-api
- **SDK Docs:** https://github.com/linear/linear-node-sdk

### Roastr.AI
- **Helper Script:** `scripts/linear-helper.js`
- **System Config:** `docs/SYSTEM-CONFIGURATION-REFERENCE.md`

---

## 🚀 Quick Start

```bash
# 1. Ver teams
npm run linear:teams

# 2. Crear issue
npm run linear:create -- --title "Test Linear" --description "Testing integration"

# 3. Listar issues
npm run linear:list

# 4. Actualizar estado
npm run linear:update -- --id ROA-XXX --status "In Progress"

# 5. Crear branch y PR
git checkout -b issue-roa-xxx-feature
# ... implementar ...
gh pr create --title "feat: Feature" --body "Fixes ROA-XXX"
```

---

**¿Listo para usar Linear?** Run `npm run linear:teams` to verify! 🎯

