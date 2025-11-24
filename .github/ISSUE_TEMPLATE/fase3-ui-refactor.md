---
name: 'Fase 3: Migración UI - Configuration + Approval + Billing + Settings + Logs'
about: Migrar 5 pantallas de administración a shadcn/ui (parte del Epic #846)
title: 'feat(ui): Fase 3 - Migrar Configuration, Approval, Billing, Settings, Logs a shadcn/ui'
labels: ui, frontend, refactor, enhancement, area:ui, area:billing
assignees: ''
---

## 🎯 Contexto

**Epic padre:** #846 (UI Refactor completo)  
**Dependencia:** Fase 2 debe estar mergeada  
**Objetivo:** Migrar pantallas de administración y configuración a shadcn/ui

## 📋 Pantallas a migrar

1. **Configuration** (`src/pages/Configuration.jsx`)
   - Configuración general del sistema
   - Variables de entorno visibles
   - Toggles de features

2. **Approval** (`src/pages/Approval.jsx`)
   - Moderación de roasts pendientes
   - Aprobar/rechazar con Shield
   - Historial de decisiones

3. **Billing** (`src/pages/Billing.jsx`)
   - Resumen de uso y costos
   - Planes y límites
   - Historial de facturas

4. **Settings** (`src/pages/Settings.jsx`)
   - Preferencias de usuario
   - Configuración de notificaciones
   - Tono y personalidad

5. **Logs** (`src/pages/Logs.jsx`)
   - Logs de sistema en tiempo real
   - Filtros por nivel/worker
   - Paginación y búsqueda

## 🛠️ Tareas técnicas

- [ ] Migrar Configuration a shadcn/ui (Switch, Select, Form)
- [ ] Migrar Approval a `<RoastrComment>` + `<ShieldStatus>`
- [ ] Migrar Billing a `<UsageMeter>` + `<Card>`
- [ ] Migrar Settings a `<SettingsSection>` + Form
- [ ] Migrar Logs a shadcn/ui (Table, Badge, Input)
- [ ] Reemplazar CSS custom por Tailwind
- [ ] Verificar lógica de cost control intacta
- [ ] Tests unitarios para componentes críticos
- [ ] Tests E2E visuales con Playwright
- [ ] Documentar en `/docs/ui-components.md`

## ✅ Acceptance Criteria

1. ✅ 5 pantallas migradas sin romper funcionalidad
2. ✅ Build exitoso (`npm run build:ci`)
3. ✅ Tests pasando (`npm test`)
4. ✅ Screenshots en `docs/test-evidence/issue-848/`
5. ✅ Sin console.logs ni TODOs
6. ✅ CodeRabbit review = 0 comentarios
7. ✅ CI/CD passing (all checks green)
8. ⚠️ **CRÍTICO:** Cost control y billing deben funcionar 100%

## 🎨 Validación visual

Antes de merge, verificar:

- [ ] Configuration guarda cambios correctamente
- [ ] Approval permite moderar roasts
- [ ] Billing muestra costos y límites
- [ ] Settings actualiza preferencias
- [ ] Logs muestra logs en tiempo real
- [ ] Responsive en 3 viewports

## 📸 Evidencias requeridas

```bash
# Screenshots en docs/test-evidence/issue-848/
- configuration-toggles.png
- approval-moderation.png
- billing-usage-meters.png
- billing-plan-limits.png
- settings-preferences.png
- logs-realtime.png
```

## 🔗 Referencias

- Epic: #846
- Fase anterior: Issue #847 (mergeada)
- Componentes Roastr: `UsageMeter`, `ShieldStatus`, `SettingsSection`
- Docs UI: `docs/ui-components.md`
- Rules: `docs/ai-ui-rules.md`

## 🚀 Definition of Done

- [ ] Código pusheado en rama `refactor/ui-fase3-admin-settings`
- [ ] PR creada referenciando esta issue
- [ ] CI/CD passing
- [ ] CodeRabbit review aprobado
- [ ] Screenshots documentados
- [ ] PR mergeada a `main`
