---
name: "Fase 4: Migración UI - PlanPicker + Pricing + StyleProfile + Accounts + Shop + CheckoutSuccess"
about: Migrar 6 pantallas de e-commerce y onboarding a shadcn/ui (cierra Epic #846)
title: "feat(ui): Fase 4 - Migrar PlanPicker, Pricing, StyleProfile, Accounts, Shop, CheckoutSuccess a shadcn/ui"
labels: ui, frontend, refactor, enhancement, area:ui, area:billing
assignees: ''
---

## 🎯 Contexto

**Epic padre:** #846 (UI Refactor completo)  
**Dependencia:** Fase 3 debe estar mergeada  
**Objetivo:** Completar migración UI con pantallas de e-commerce y onboarding

## 📋 Pantallas a migrar

1. **PlanPicker** (`src/pages/PlanPicker.jsx`)
   - Selector de planes (Free, Starter, Pro, Plus)
   - Comparativa de features
   - Call to action de upgrade

2. **Pricing** (`src/pages/Pricing.jsx`)
   - Tabla de precios pública
   - Toggle mensual/anual
   - Features por plan

3. **StyleProfile** (`src/pages/StyleProfile.jsx`)
   - Onboarding de personalidad
   - Selector de tono
   - Preview de roasts de ejemplo

4. **AccountsPage** (`src/pages/AccountsPage.js`)
   - Gestión de cuentas multi-tenant
   - Switch entre organizaciones
   - Permisos y roles

5. **Shop** (`src/pages/Shop.jsx`)
   - Marketplace de add-ons (futuro)
   - Compra de créditos extra
   - Checkout flow

6. **CheckoutSuccess** (`src/pages/CheckoutSuccess.jsx`)
   - Confirmación de pago
   - Resumen de plan adquirido
   - Next steps

## 🛠️ Tareas técnicas

- [ ] Migrar PlanPicker a shadcn/ui (Card, Badge, Button)
- [ ] Migrar Pricing a shadcn/ui (Table, Switch, Badge)
- [ ] Migrar StyleProfile a shadcn/ui (Form, Radio, Textarea)
- [ ] Migrar AccountsPage a shadcn/ui (Select, Card, Alert)
- [ ] Migrar Shop a shadcn/ui (Card, Button, Dialog)
- [ ] Migrar CheckoutSuccess a shadcn/ui (Alert, Card, Button)
- [ ] Reemplazar CSS custom por Tailwind
- [ ] Verificar flujo de checkout intacto
- [ ] Tests unitarios para componentes críticos
- [ ] Tests E2E visuales con Playwright
- [ ] Documentar en `/docs/ui-components.md`

## ✅ Acceptance Criteria

1. ✅ 6 pantallas migradas sin romper funcionalidad
2. ✅ Build exitoso (`npm run build:ci`)
3. ✅ Tests pasando (`npm test`)
4. ✅ Screenshots en `docs/test-evidence/issue-849/`
5. ✅ Sin console.logs ni TODOs
6. ✅ CodeRabbit review = 0 comentarios
7. ✅ CI/CD passing (all checks green)
8. ⚠️ **CRÍTICO:** Checkout flow debe funcionar 100%
9. ✅ Epic #846 cerrado automáticamente

## 🎨 Validación visual

Antes de merge, verificar:

- [ ] PlanPicker muestra planes correctamente
- [ ] Pricing permite toggle mensual/anual
- [ ] StyleProfile guarda preferencias de tono
- [ ] AccountsPage permite switch de org
- [ ] Shop permite comprar créditos (mock)
- [ ] CheckoutSuccess muestra confirmación
- [ ] Responsive en 3 viewports

## 📸 Evidencias requeridas

```bash
# Screenshots en docs/test-evidence/issue-849/
- planpicker-comparison.png
- pricing-table.png
- styleprofile-onboarding.png
- accounts-multi-tenant.png
- shop-credits.png
- checkout-success.png
```

## 🔗 Referencias

- Epic: #846 (SE CIERRA CON ESTA ISSUE)
- Fase anterior: Issue #848 (mergeada)
- Componentes Roastr: Todos (`PageLayout`, `RoastrComment`, etc.)
- Docs UI: `docs/ui-components.md`
- Rules: `docs/ai-ui-rules.md`

## 🚀 Definition of Done

- [ ] Código pusheado en rama `refactor/ui-fase4-ecommerce-onboarding`
- [ ] PR creada referenciando esta issue
- [ ] CI/CD passing
- [ ] CodeRabbit review aprobado
- [ ] Screenshots documentados
- [ ] PR mergeada a `main`
- [ ] **Epic #846 cerrado con mensaje de cierre**

## 🎉 Post-merge

Al cerrar esta issue, el Epic #846 se completa:

```markdown
✅ Fase 1: Fundación técnica (PR #845)
✅ Fase 2: Dashboard + Compose + Integrations + Connect (Issue #847)
✅ Fase 3: Configuration + Approval + Billing + Settings + Logs (Issue #848)
✅ Fase 4: PlanPicker + Pricing + StyleProfile + Accounts + Shop + CheckoutSuccess (Issue #849)

🎯 RESULTADO: 100% de la interfaz de Roastr migrada a shadcn/ui
```

