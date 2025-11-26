# Resumen: Issues de Migración UI creadas en GitHub

**Fecha:** 2025-11-26
**Total de Issues creadas:** 36 (8 Epics + 28 Issues individuales)

---

## 📊 Issues creadas por Épica

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

---

## 🎯 Issues sin dependencias (pueden iniciarse en paralelo)

- #1033 - Configurar shadcn/ui y ThemeProvider
- #1059 - Implementar capa de cliente API
- #1065 - Endpoint de métricas agregadas (backend)
- #1066 - Endpoint de uso actual (backend)
- #1067 - Utilidades de formateo

---

## 🔗 Issues bloqueantes (muchos dependen de estos)

- #1033 - ThemeProvider (bloquea #1034, #1035, #1058)
- #1034 - Componentes shadcn (bloquea #1035, #1036)
- #1036 - Layouts (bloquea toda implementación de UI)
- #1059 - Capa API (bloquea #1061, #1062, #1063)

---

## 📅 Sugerencia de Orden de Implementación

### Sprint 1: Fundamentos
**Issues:** #1033, #1034, #1035, #1036, #1058, #1059
**Duración:** 2 semanas
**Objetivo:** Base técnica lista (shadcn + layouts + auth)

### Sprint 2: Admin Panel
**Issues:** #1038, #1039, #1040, #1041, #1042
**Duración:** 2-3 semanas
**Objetivo:** Panel de administración completo

### Sprint 3: User App Home + Infra
**Issues:** #1044, #1045, #1046, #1061, #1062, #1063, #1065, #1066, #1067
**Duración:** 2 semanas
**Objetivo:** Home de usuario + feature flags + endpoints backend

### Sprint 4: User App Accounts
**Issues:** #1048, #1049, #1050, #1051
**Duración:** 2 semanas
**Objetivo:** Detalle de cuenta y roasts

### Sprint 5: User App Settings
**Issues:** #1053, #1054, #1055, #1056
**Duración:** 1-2 semanas
**Objetivo:** Configuración de usuario

---

## 🏷️ Labels aplicados

- `tracking` - Para épicas
- `frontend` - Componentes UI
- `backend` - Endpoints API
- `admin-panel` - Panel de administración
- `auth` - Autenticación
- `billing` - Facturación
- `config` - Configuración
- `enhancement` - Nuevas features
- `refactor` - Refactorización
- `tech-debt` - Deuda técnica
- `high-priority` - Alta prioridad
- `architecture` - Cambios de arquitectura
- Y otros específicos por área

---

## ✅ Próximos pasos

1. Revisar cada issue en GitHub y ajustar si es necesario
2. Asignar responsables a cada issue
3. Crear milestones para cada sprint
4. Comenzar con Sprint 1 (fundamentos)
5. Aplicar política GDD para tracking y documentación

---

**Notas:**
- Todas las issues tienen Acceptance Criteria claros
- Todas incluyen checklist técnico detallado
- Dependencies explícitas para planificación
- Issues atomizadas y ejecutables

**Ver issues en GitHub:**
https://github.com/Eibon7/roastr-ai/issues?q=is%3Aissue+is%3Aopen+created%3A2025-11-26

**Documento de referencia:**
`docs/plan/ui-migration-github-issues.md`
