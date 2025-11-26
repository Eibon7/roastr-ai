# ✅ Setup Completo: Migración UI a Shadcn

**Fecha:** 2025-11-26  
**Status:** 🟢 Listo para implementación

---

## 📋 Resumen

Se ha completado todo el setup necesario para la migración UI a shadcn/ui:

1. ✅ **36 Issues creadas en GitHub** (8 épicas + 28 issues)
2. ✅ **Reglas Cursor configuradas** con comandos MCP shadcn-studio
3. ✅ **Documentación completa** de workflows y best practices
4. ✅ **Referencias integradas** en CLAUDE.md

---

## 📁 Archivos Creados/Actualizados

### Issues y Planning

| Archivo | Descripción |
|---------|-------------|
| `docs/plan/ui-migration-github-issues.md` | Documento detallado con todas las 36 issues |
| `docs/plan/ui-migration-issues-summary.md` | Resumen ejecutivo con organización por sprints |

### Reglas y Configuración

| Archivo | Descripción |
|---------|-------------|
| `.cursor/rules/shadcn-ui-migration.mdc` | **Reglas completas** con comandos MCP, workflows, ejemplos |
| `docs/SHADCN-QUICK-REFERENCE.md` | **Quick reference** para consulta rápida durante desarrollo |
| `CLAUDE.md` | Actualizado con referencias a shadcn-studio MCP |

---

## 🎯 Issues Creadas en GitHub

### Epic 1: Migración UI → shadcn (#1032)
- #1033 - Configurar shadcn/ui con Tailwind y ThemeProvider
- #1034 - Migrar componentes UI caseros a shadcn/ui
- #1035 - Limpiar CSS legacy
- #1036 - Crear estructura de layouts

### Epic 2: Admin Panel (#1037)
- #1038 - Implementar página de usuarios (/admin/users)
- #1039 - Implementar gestión de feature flags
- #1040 - Implementar configuración de planes y límites
- #1041 - Implementar gestión de tonos
- #1042 - Implementar panel de métricas

### Epic 3: User App Home (#1043)
- #1044 - Implementar widgets de análisis
- #1045 - Implementar bloque de redes disponibles
- #1046 - Implementar tabla de cuentas conectadas

### Epic 4: User App — Accounts (#1047)
- #1048 - Implementar header y widgets de detalle de cuenta
- #1049 - Implementar dialog de settings de cuenta
- #1050 - Implementar tabla de roasts de la cuenta
- #1051 - Implementar acordeón de Shield

### Epic 5: User App — Settings (#1052)
- #1053 - Implementar navegación por tabs en Settings
- #1054 - Implementar tab de Cuenta
- #1055 - Implementar tab de Ajustes
- #1056 - Implementar tab de Billing

### Epic 6: Auth (#1057)
- #1058 - Implementar página de login
- #1059 - Implementar capa de cliente API y auth provider

### Epic 7: Feature Flags & Configuración (#1060)
- #1061 - Conectar feature flags a contexto global
- #1062 - Implementar lógica de visibilidad por plan
- #1063 - Implementar guards de rutas

### Epic 8: Métricas (#1064)
- #1065 - Implementar endpoint de métricas agregadas (backend)
- #1066 - Implementar endpoint de uso actual (backend)
- #1067 - Implementar formateo de métricas y números en UI

**Ver todas en GitHub:**
https://github.com/Eibon7/roastr-ai/issues?q=is%3Aissue+is%3Aopen+created%3A2025-11-26

---

## 🛠️ Comandos MCP Shadcn-Studio

### `/cui` - Create UI (90% de casos)

**Template básico:**
```bash
/cui Create a [componente] with [elementos], [features], and [interacciones]
```

**Ejemplos por issue:**

```bash
# Issue #1038 - Admin Users
/cui Create an admin users table with name, email, status columns, 
    search bar, and action buttons for add, edit, delete, impersonate

# Issue #1044 - User Widgets
/cui Create usage widgets showing monthly consumption with progress bars

# Issue #1058 - Login
/cui Create a login page with email/password and magic link option

# Issue #1042 - Admin Metrics
/cui Create a metrics dashboard with cards for totals, averages, and costs

# Issue #1046 - Accounts Table
/cui Create a clickable accounts table with social network, handle, status, 
    and stats columns
```

### `/rui` - Refine UI

Para ajustes a código ya generado:
```bash
/rui Add pagination to the table
/rui Make the form validation stricter
/rui Add dark mode support
```

### `/iui` - Inspire UI (Pro only)

Para diseños únicos y creativos:
```bash
/iui Create an innovative toxicity indicator
/iui Design a unique roast preview card
```

### `/ftc` - Figma to Code

Para convertir diseños completos de Figma (requiere Figma MCP).

---

## 📅 Plan de Implementación

### Sprint 1: Fundamentos (2 semanas)
**Issues:** #1033, #1034, #1035, #1036, #1058, #1059  
**Goal:** Base técnica lista (shadcn + layouts + auth)

**Orden sugerido:**
1. #1033 - ThemeProvider (bloquea todo)
2. #1034 - Migrar componentes
3. #1059 - Capa API (paralelo)
4. #1036 - Layouts
5. #1035 - Limpiar CSS
6. #1058 - Login

### Sprint 2: Admin Panel (2-3 semanas)
**Issues:** #1038, #1039, #1040, #1041, #1042  
**Goal:** Panel de administración completo

### Sprint 3: User App Home + Infra (2 semanas)
**Issues:** #1044, #1045, #1046, #1061, #1062, #1063, #1065, #1066, #1067  
**Goal:** Home de usuario + feature flags + endpoints

### Sprint 4: User App Accounts (2 semanas)
**Issues:** #1048, #1049, #1050, #1051  
**Goal:** Detalle de cuenta y roasts

### Sprint 5: User App Settings (1-2 semanas)
**Issues:** #1053, #1054, #1055, #1056  
**Goal:** Configuración de usuario

**Total estimado:** 10-12 semanas

---

## 🎯 Workflow Recomendado por Issue

### 1. Planning
- [ ] Abrir issue en GitHub
- [ ] Leer Acceptance Criteria
- [ ] Consultar `.cursor/rules/shadcn-ui-migration.mdc` o `docs/SHADCN-QUICK-REFERENCE.md`
- [ ] Identificar comando MCP apropiado (99% de veces será `/cui`)

### 2. Implementación
```bash
# 1. Generar código base con MCP
/cui [prompt específico según issue]

# 2. Revisar código generado
# MCP creará el componente base

# 3. Customizar para Roastr.AI
# - Conectar a API real (/api/...)
# - Aplicar feature flags si aplica
# - Aplicar visibilidad por plan si aplica
# - Añadir validación (zod)
# - Implementar lógica de negocio

# 4. Probar
npm run dev
# Verificar claro/oscuro/sistema
# Verificar responsive (móvil/tablet/desktop)

# 5. Tests
npm test -- [archivo-test]

# 6. Evidencia
# Screenshots si aplica
```

### 3. Pull Request
- [ ] Documentar comando MCP usado
- [ ] Documentar customizaciones hechas
- [ ] Screenshots de evidencia visual
- [ ] Verificar checklist de issue completo
- [ ] Tests pasando
- [ ] 0 comentarios CodeRabbit

---

## 📚 Recursos Disponibles

### Documentación del Proyecto

| Documento | Uso |
|-----------|-----|
| `.cursor/rules/shadcn-ui-migration.mdc` | **Reglas completas** - Leer antes de empezar |
| `docs/SHADCN-QUICK-REFERENCE.md` | **Quick reference** - Tener abierto durante desarrollo |
| `docs/plan/ui-migration-github-issues.md` | **Issues detalladas** - Referencia de AC |
| `CLAUDE.md` | **Overview general** - Política de MCP |

### Secciones Clave en las Reglas

- **Usage Rule** - Cuándo usar shadcn
- **Planning Rule** - Comandos MCP disponibles
- **Implementation Rule** - Workflow paso a paso
- **Styling Rules** - DO/DON'T con ejemplos
- **Testing Rules** - Tests obligatorios
- **Responsive Rules** - Breakpoints y adaptaciones
- **Common Pitfalls** - Errores a evitar
- **Ejemplos Prácticos** - Comandos específicos por issue

### Referencias Externas

- Shadcn Docs: https://ui.shadcn.com
- Tailwind Docs: https://tailwindcss.com
- Shadcn-Studio MCP: (documentación en reglas)

---

## ✅ Checklist Pre-Implementación

Antes de empezar el Sprint 1:

- [ ] Todos los miembros del equipo leyeron `.cursor/rules/shadcn-ui-migration.mdc`
- [ ] MCP shadcn-studio configurado en Cursor
- [ ] Issues revisadas y entendidas
- [ ] Plan de sprints acordado
- [ ] Responsables asignados (opcional)
- [ ] Milestones creados en GitHub (opcional)

---

## 🎬 Primeros Pasos

### Para empezar HOY:

1. **Leer documentación:**
   ```bash
   # En Cursor, abrir:
   .cursor/rules/shadcn-ui-migration.mdc
   docs/SHADCN-QUICK-REFERENCE.md
   ```

2. **Verificar MCP configurado:**
   ```bash
   # En Cursor chat:
   /mcp list
   # Debe aparecer: shadcn-studio
   ```

3. **Comenzar con Issue #1033:**
   - Es la base de todo (ThemeProvider)
   - Bloquea todas las demás
   - Relativamente simple
   - Buen warm-up para usar `/cui`

4. **Comando sugerido:**
   ```bash
   /cui Configure shadcn/ui with Tailwind and create a ThemeProvider 
       supporting light, dark, and system modes with system as default
   ```

---

## 🚀 Next Steps

1. ✅ **Setup completo** (este documento)
2. 🔜 **Sprint 1 - Fundamentos** (empezar con #1033)
3. 🔜 **Sprint 2 - Admin Panel**
4. 🔜 **Sprint 3 - User App Home**
5. 🔜 **Sprint 4 - User App Accounts**
6. 🔜 **Sprint 5 - User App Settings**

---

## 💡 Tips Finales

### DO ✅
- Usar `/cui` para casi todo
- Seguir workflows documentados
- Probar en claro/oscuro/sistema SIEMPRE
- Verificar responsive en todos los breakpoints
- Documentar comandos MCP usados en PRs

### DON'T ❌
- NO crear componentes desde cero si shadcn lo provee
- NO modificar componentes shadcn innecesariamente
- NO saltarse tests
- NO ignorar responsive
- NO hardcodear colores

### Cuando tengas dudas:
1. Consultar `docs/SHADCN-QUICK-REFERENCE.md`
2. Revisar ejemplos en `.cursor/rules/shadcn-ui-migration.mdc`
3. Buscar issues similares ya implementadas
4. Preguntar en el equipo

---

## 📊 Métricas de Éxito

Al finalizar la migración:

- [ ] 100% de componentes UI usando shadcn
- [ ] 0 CSS modules legacy
- [ ] 0 styled-components
- [ ] Tema claro/oscuro/sistema funcionando en toda la app
- [ ] 100% responsive (móvil/tablet/desktop)
- [ ] Tests de UI pasando al 100%
- [ ] Documentación actualizada
- [ ] 0 comentarios CodeRabbit en PRs

---

**Creado:** 2025-11-26  
**Epic Principal:** #1032  
**Status:** 🟢 Ready to Start  
**Total Issues:** 36  
**Estimación:** 10-12 semanas

¡Vamos a hacer una UI increíble! 🚀

