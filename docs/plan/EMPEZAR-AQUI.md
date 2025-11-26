# 🚀 EMPEZAR AQUÍ - Migración UI a Shadcn

**Para desarrolladores que van a trabajar en las issues de UI**

---

## ⚡ Quick Start (5 minutos)

### 1️⃣ Lee estos 2 documentos:

📖 **Quick Reference** (5 min)
```
docs/SHADCN-QUICK-REFERENCE.md
```

📖 **Reglas Completas** (15 min cuando tengas tiempo)
```
.cursor/rules/shadcn-ui-migration.mdc
```

### 2️⃣ Verifica que MCP está configurado:

```bash
# En Cursor chat, ejecutar:
/mcp list

# Debe aparecer: shadcn-studio ✅
```

### 3️⃣ Abre tu issue en GitHub:

```
https://github.com/Eibon7/roastr-ai/issues
```

---

## 🎯 Workflow Ultra-Resumido

```bash
# 1. Leer issue y AC
# 2. Generar código con MCP
/cui [describe lo que necesitas]

# 3. Customizar código
# - Conectar a API
# - Añadir lógica

# 4. Probar
npm run dev
# Verificar: claro/oscuro/sistema + responsive

# 5. Tests
npm test

# 6. PR
# Documentar comando MCP usado
```

---

## 📝 Comando `/cui` (el más usado)

**Template:**
```bash
/cui Create a [componente] with [elementos], [features], and [acciones]
```

**Ejemplos reales:**

```bash
# Admin users table
/cui Create an admin users table with name, email, status, 
    search bar, and edit/delete/impersonate actions

# User widgets
/cui Create usage widgets with progress bars for monthly consumption

# Login page
/cui Create a login page with email/password and magic link option
```

---

## 📋 Checklist por Issue

- [ ] Leer AC de la issue
- [ ] Generar con `/cui`
- [ ] Customizar (API + lógica)
- [ ] Probar claro/oscuro/sistema
- [ ] Probar responsive
- [ ] Tests pasando
- [ ] Documentar en PR

---

## 🆘 Ayuda Rápida

| Necesito... | Ver... |
|-------------|--------|
| Comandos MCP | `docs/SHADCN-QUICK-REFERENCE.md` |
| Ejemplos por issue | `.cursor/rules/shadcn-ui-migration.mdc` (sección final) |
| Estructura de carpetas | `docs/SHADCN-QUICK-REFERENCE.md` |
| Endpoints API | `docs/SHADCN-QUICK-REFERENCE.md` |
| Todas las issues | `docs/plan/ui-migration-github-issues.md` |

---

## ✅ DO

```tsx
// Usar shadcn
import { Button } from "@/components/ui/button"

// Variables de tema
<div className="bg-primary">

// API centralizada
import { api } from "@/lib/api"
```

## ❌ DON'T

```tsx
// NO crear custom si existe en shadcn
const MyButton = styled.button`...` // ❌

// NO hardcodear colores
<div className="bg-blue-500"> // ❌

// NO fetch directo
fetch('/api/users') // ❌
```

---

## 🎬 Primer Issue Recomendado

**Issue #1033** - Configurar shadcn/ui y ThemeProvider

**Por qué empezar aquí:**
- Es la base de todo
- Bloquea las demás
- Relativamente simple
- Buen warm-up

**Comando sugerido:**
```bash
/cui Configure shadcn/ui with Tailwind and create a ThemeProvider 
    supporting light, dark, and system modes with system as default
```

---

## 📚 Documentos del Proyecto

| Documento | Descripción |
|-----------|-------------|
| `EMPEZAR-AQUI.md` | 👈 Este documento |
| `SHADCN-QUICK-REFERENCE.md` | Referencia rápida durante desarrollo |
| `.cursor/rules/shadcn-ui-migration.mdc` | Reglas completas con ejemplos |
| `ui-migration-github-issues.md` | Todas las 36 issues detalladas |
| `ui-migration-setup-complete.md` | Setup completo y plan de sprints |

---

## 🚀 ¡Listo!

Ya estás preparado para empezar. Recuerda:

1. **Usa `/cui` para casi todo** (90% de casos)
2. **Prueba en claro/oscuro/sistema** SIEMPRE
3. **Verifica responsive** en móvil/tablet/desktop
4. **Documenta** el comando MCP usado en la PR

**¿Dudas?** Consulta `docs/SHADCN-QUICK-REFERENCE.md`

---

**Última actualización:** 2025-11-26  
**Epic Principal:** #1032  
**Total Issues:** 36
