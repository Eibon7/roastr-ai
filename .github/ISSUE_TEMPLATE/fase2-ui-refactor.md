---
name: 'Fase 2: Migración UI - Dashboard + Compose + Integrations + Connect'
about: Migrar 4 pantallas principales a shadcn/ui (parte del Epic #846)
title: 'feat(ui): Fase 2 - Migrar Dashboard, Compose, Integrations, Connect a shadcn/ui'
labels: ui, frontend, refactor, enhancement, area:ui
assignees: ''
---

## 🎯 Contexto

**Epic padre:** #846 (UI Refactor completo)  
**Dependencia:** PR #845 (Fase 1) debe estar mergeada  
**Objetivo:** Migrar 4 pantallas clave a shadcn/ui sin romper lógica de negocio

## 📋 Pantallas a migrar

1. **Dashboard** (`src/pages/Dashboard.jsx`)
   - Métricas principales (roasts, shield, cost)
   - Gráficos de actividad
   - Estado de workers

2. **Compose** (`src/pages/Compose.jsx`)
   - Editor de roasts
   - Preview en tiempo real
   - Selector de tono/intensidad

3. **Integrations** (`src/pages/Integrations.jsx`)
   - Lista de plataformas conectadas
   - Estado de conexión
   - Acciones de conectar/desconectar

4. **Connect** (`src/pages/Connect.jsx`)
   - Flujo de OAuth por plataforma
   - Configuración de tokens
   - Validación de credenciales

## 🛠️ Tareas técnicas

- [ ] Migrar Dashboard a `<PageLayout>` + componentes Roastr
- [ ] Migrar Compose a shadcn/ui (Form, Textarea, Select)
- [ ] Migrar Integrations a shadcn/ui (Card, Badge, Button)
- [ ] Migrar Connect a shadcn/ui (Form, Input, Alert)
- [ ] Reemplazar CSS custom por Tailwind
- [ ] Verificar lógica de hooks/composables intacta
- [ ] Tests unitarios para nuevos componentes (si aplica)
- [ ] Tests E2E visuales con Playwright
- [ ] Documentar en `/docs/ui-components.md`

## ✅ Acceptance Criteria

1. ✅ 4 pantallas migradas sin romper funcionalidad
2. ✅ Build exitoso (`npm run build:ci`)
3. ✅ Tests pasando (`npm test`)
4. ✅ Screenshots en `docs/test-evidence/issue-847/`
5. ✅ Sin console.logs ni TODOs
6. ✅ CodeRabbit review = 0 comentarios
7. ✅ CI/CD passing (all checks green)

## 🎨 Validación visual

Antes de merge, verificar:

- [ ] Dashboard muestra métricas correctamente
- [ ] Compose permite crear roasts sin errores
- [ ] Integrations lista plataformas conectadas
- [ ] Connect permite OAuth sin romper flujo
- [ ] Responsive en 3 viewports (desktop, tablet, mobile)
- [ ] Estados loading/error/empty funcionan

## 📸 Evidencias requeridas

```bash
# Screenshots en docs/test-evidence/issue-847/
- dashboard-desktop.png
- dashboard-tablet.png
- dashboard-mobile.png
- compose-desktop.png
- compose-preview.png
- integrations-list.png
- connect-oauth-flow.png
```

## 🔗 Referencias

- Epic: #846
- Fase anterior: #845 (PR mergeada)
- Componentes base: `frontend/src/components/roastr/`
- Docs UI: `docs/ui-components.md`
- Rules: `docs/ai-ui-rules.md`

## 🚀 Definition of Done

- [ ] Código pusheado en rama `refactor/ui-fase2-dashboard-compose`
- [ ] PR creada referenciando esta issue
- [ ] CI/CD passing
- [ ] CodeRabbit review aprobado
- [ ] Screenshots documentados
- [ ] PR mergeada a `main`
