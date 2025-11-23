# Plan de Implementación: Issue #862 - Fase 4 UI Migration

**Issue:** #862  
**Título:** Fase 4 - Migrar PlanPicker, Pricing, StyleProfile, Accounts, Shop, CheckoutSuccess a shadcn/ui  
**Epic Padre:** #846  
**Prioridad:** High  
**Labels:** `area:ui`, `area:billing`, `frontend`, `refactor`  
**Fecha:** 2025-11-18

---

## 📊 Estado Actual

### Contexto

- **Epic #846:** Migración completa UI a shadcn/ui
- **Fase 3 completada:** Dashboard, Compose, Integrations, Connect, Configuration, Approval, Billing, Settings, Logs
- **Fase 4 (esta issue):** Última fase - E-commerce y Onboarding (6 pantallas)

### Pantallas Afectadas

1. **PlanPicker** - Selector de planes con comparativa de features
2. **Pricing** - Tabla pública de precios con toggle mensual/anual
3. **StyleProfile** - Onboarding de personalidad y tono
4. **AccountsPage** - Gestión multi-tenant de organizaciones
5. **Shop** - Marketplace de add-ons y créditos extra
6. **CheckoutSuccess** - Confirmación post-pago

### Archivos Existentes

```
frontend/src/pages/
├── PlanPicker.jsx      (196 líneas)
├── Pricing.jsx         (245 líneas)
├── StyleProfile.jsx    (318 líneas)
├── AccountsPage.js     (287 líneas - .js, convertir a .jsx)
├── Shop.jsx            (164 líneas)
└── CheckoutSuccess.jsx (142 líneas)
```

### Dependencias Técnicas

- **shadcn/ui:** Ya instalado y configurado (Fase 1)
- **Componentes disponibles:** Card, Button, Badge, Table, Switch, Form, Radio, Textarea, Select, Alert, Dialog
- **Componentes Roastr:** PageLayout, RoastrComment (ya migrados)
- **Plan Features:** Integración con `plan-features` node (tiers, limits, feature gates)
- **Persona System:** Integración con `persona` node (identity, boundaries, tolerance)

---

## 🎯 Objetivos de la Issue

### Acceptance Criteria (9 total)

1. ✅ 6 pantallas migradas sin romper funcionalidad
2. ✅ Build exitoso (`npm run build:ci`)
3. ✅ Tests pasando (`npm test`)
4. ✅ Screenshots en `docs/test-evidence/issue-862/`
5. ✅ Sin console.logs ni TODOs
6. ✅ CodeRabbit review = 0 comentarios
7. ✅ CI/CD passing (all checks green)
8. ⚠️ **CRÍTICO:** Checkout flow debe funcionar 100%
9. ✅ Epic #846 cerrado automáticamente

### Criterios de Éxito

- Funcionalidad 100% preservada
- UI consistente con shadcn/ui design system
- Responsive en 3 viewports (desktop, tablet, mobile)
- Tests unitarios + E2E con Playwright
- Coverage >= 90% en archivos modificados

---

## 📋 Plan de Implementación

### Fase 1: Preparación y Análisis (15 min)

**Tarea 1.1: Analizar componentes existentes**

```bash
# Leer archivos actuales para entender estructura
@frontend/src/pages/PlanPicker.jsx
@frontend/src/pages/Pricing.jsx
@frontend/src/pages/StyleProfile.jsx
@frontend/src/pages/AccountsPage.js
@frontend/src/pages/Shop.jsx
@frontend/src/pages/CheckoutSuccess.jsx
```

**Tarea 1.2: Identificar dependencias shadcn/ui**

- PlanPicker → Card, Badge, Button
- Pricing → Table, Switch, Badge, Button
- StyleProfile → Form, Radio, Textarea, Button, Card
- AccountsPage → Select, Card, Alert, Button
- Shop → Card, Button, Dialog, Badge
- CheckoutSuccess → Alert, Card, Button

**Tarea 1.3: Validar componentes instalados**

```bash
# Verificar que todos los componentes shadcn/ui necesarios existen
ls frontend/src/components/ui/
```

---

### Fase 2: Migración de Componentes (3-4 horas)

**Orden de implementación:** De menos a más complejo

#### 2.1 CheckoutSuccess (30 min) - SIMPLE

- **Complejidad:** Baja (solo display, sin lógica compleja)
- **Componentes:** Alert, Card, Button
- **Pasos:**
  1. Reemplazar layout custom por shadcn Alert + Card
  2. Migrar botones a shadcn Button
  3. Mantener lógica de confirmación intacta
  4. Añadir tests unitarios

#### 2.2 Shop (45 min) - SIMPLE

- **Complejidad:** Media-Baja (marketplace futuro, ahora solo mock)
- **Componentes:** Card, Button, Dialog, Badge
- **Pasos:**
  1. Migrar cards de productos a shadcn Card
  2. Modal de checkout con shadcn Dialog
  3. Badges para pricing
  4. Mantener estructura de datos de productos

#### 2.3 PlanPicker (1 hora) - MEDIO

- **Complejidad:** Media (comparativa de planes)
- **Componentes:** Card, Badge, Button
- **Dependencias:** `plan-features` node
- **Pasos:**
  1. Cargar límites desde nodos GDD (plan-features)
  2. Migrar cards de planes a shadcn Card
  3. Feature list con Badges
  4. CTA buttons con shadcn Button
  5. Verificar integración con billing

#### 2.4 Pricing (1 hora) - MEDIO

- **Complejidad:** Media (tabla de features + toggle)
- **Componentes:** Table, Switch, Badge, Button
- **Dependencias:** `plan-features` node
- **Pasos:**
  1. Tabla de precios con shadcn Table
  2. Toggle mensual/anual con shadcn Switch
  3. Features por plan con Badges
  4. Sincronizar con PlanPicker

#### 2.5 AccountsPage (1 hora) - COMPLEJO

- **Complejidad:** Alta (multi-tenant, permisos, RLS)
- **Componentes:** Select, Card, Alert, Button
- **Dependencias:** `multi-tenant` (RLS, org isolation)
- **Pasos:**
  1. **CONVERTIR:** Renombrar `.js` a `.jsx`
  2. Selector de organización con shadcn Select
  3. Cards por cuenta con shadcn Card
  4. Alertas de permisos con shadcn Alert
  5. Validar RLS en switches de org

#### 2.6 StyleProfile (1.5 horas) - COMPLEJO

- **Complejidad:** Alta (onboarding, embeddings, encryption)
- **Componentes:** Form, Radio, Textarea, Button, Card
- **Dependencias:** `persona` node (lo_que_me_define, lo_que_no_tolero, lo_que_me_da_igual)
- **Pasos:**
  1. Form completo con shadcn Form + react-hook-form
  2. Radio groups para tono con shadcn Radio
  3. Textareas para persona fields con shadcn Textarea
  4. Preview de roasts de ejemplo
  5. **CRÍTICO:** Mantener encryption at rest
  6. **CRÍTICO:** Validar plan gating (Starter+ vs Pro+)
  7. Tests de integración con persona API

---

### Fase 3: Testing (1.5 horas)

**Tarea 3.1: Tests Unitarios**

```bash
# Generar tests para cada componente
tests/unit/pages/
├── PlanPicker.test.jsx
├── Pricing.test.jsx
├── StyleProfile.test.jsx
├── AccountsPage.test.jsx
├── Shop.test.jsx
└── CheckoutSuccess.test.jsx
```

**Coverage mínimo:** 90% en archivos modificados

**Test cases por componente:**

- PlanPicker: Render de planes, click en CTA, feature comparison
- Pricing: Toggle mensual/anual, tabla responsive
- StyleProfile: Submit de form, validación, preview de roasts
- AccountsPage: Switch de org, validación RLS, permisos
- Shop: Modal de checkout, productos mock
- CheckoutSuccess: Confirmación, next steps

**Tarea 3.2: Tests E2E con Playwright**

```bash
# Crear test E2E de flujo completo
tests/e2e/ui-migration-fase4.spec.js
```

**Flujo crítico:** Pricing → PlanPicker → Checkout → CheckoutSuccess

**Tarea 3.3: Validación Visual**

```bash
# Ejecutar Playwright MCP para screenshots
# Viewports: desktop (1920x1080), tablet (768x1024), mobile (375x667)
```

---

### Fase 4: Validación y Evidencias (1 hora)

**Tarea 4.1: Build y Tests**

```bash
cd frontend
npm run build:ci  # Debe exitoso
npm test          # 0 fallos
npm run test:coverage  # >= 90%
```

**Tarea 4.2: Screenshots y Documentación**

```bash
# Crear directorio de evidencias
mkdir -p docs/test-evidence/issue-862/screenshots/

# Screenshots requeridos:
- planpicker-comparison.png
- pricing-table.png
- styleprofile-onboarding.png
- accounts-multi-tenant.png
- shop-credits.png
- checkout-success.png

# Generar reporte
docs/test-evidence/issue-862/summary.md
```

**Tarea 4.3: Validación Checkout Flow**
⚠️ **CRÍTICO:** Este es el AC #8 - blocking

**Checklist manual:**

- [ ] PlanPicker permite seleccionar plan
- [ ] Click en upgrade redirige a checkout
- [ ] Checkout procesa pago (mock en dev)
- [ ] CheckoutSuccess muestra confirmación correcta
- [ ] Billing page refleja nuevo plan
- [ ] Settings muestra features desbloqueadas

**Tarea 4.4: GDD Updates**

```bash
# Actualizar nodos afectados
@docs/nodes/plan-features.md   # Añadir referencias a nuevos componentes
@docs/nodes/persona.md          # Documentar StyleProfile integration
@docs/nodes/multi-tenant.md    # Documentar AccountsPage RLS validation

# Añadir agentes a "Agentes Relevantes"
# - FrontendDev
# - TestEngineer
# - UIDesigner (si se invoca)
# - WhimsyInjector (si se añade branding)
```

---

### Fase 5: PR y Cierre (30 min)

**Tarea 5.1: Pre-Flight Validation**

```bash
# GDD Health
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci  # >= 87

# CodeRabbit
npm run coderabbit:review  # 0 comentarios

# CI/CD
# Esperar a que todos los checks pasen
```

**Tarea 5.2: Crear PR**

```bash
gh pr create \
  --title "feat(ui): Fase 4 - Migrate E-commerce & Onboarding to shadcn/ui (closes #846)" \
  --body "$(cat docs/pr-body-issue-862.md)" \
  --label "area:ui,area:billing,frontend,refactor,enhancement"
```

**Tarea 5.3: PR Body**

```markdown
# Fase 4: E-commerce & Onboarding Migration

Closes #862  
Closes #846 (Epic completo)

## 🎯 Resumen

Migración final de 6 pantallas a shadcn/ui, completando el Epic #846.

## ✅ Pantallas Migradas

- [x] PlanPicker (comparativa de planes)
- [x] Pricing (tabla pública)
- [x] StyleProfile (onboarding persona)
- [x] AccountsPage (multi-tenant)
- [x] Shop (marketplace)
- [x] CheckoutSuccess (confirmación)

## 📸 Evidencias

- Screenshots en docs/test-evidence/issue-862/
- Tests E2E pasando 100%
- Checkout flow validado manualmente

## 🧪 Testing

- Tests unitarios: 90%+ coverage
- E2E: Flujo completo Pricing → Checkout → Success
- Visual: 3 viewports (desktop, tablet, mobile)

## 🚀 Epic #846 Status

✅ Fase 1: Fundación técnica  
✅ Fase 2: Dashboard + Core  
✅ Fase 3: Configuration + Admin  
✅ Fase 4: E-commerce + Onboarding (ESTA PR)

**Resultado:** 100% UI migrada a shadcn/ui
```

---

## 🚧 Riesgos y Mitigaciones

### Riesgo 1: Checkout Flow Roto

**Probabilidad:** Media  
**Impacto:** Crítico (AC #8 blocking)  
**Mitigación:**

- Validación manual exhaustiva antes de merge
- Tests E2E específicos para flujo completo
- Rollback plan: mantener versión anterior si falla

### Riesgo 2: RLS en AccountsPage

**Probabilidad:** Baja  
**Impacto:** Alto (seguridad multi-tenant)  
**Mitigación:**

- Tests de integración con múltiples orgs
- Validar queries con RLS activo
- Revisar con Guardian agent

### Riesgo 3: Persona Encryption

**Probabilidad:** Baja  
**Impacto:** Crítico (GDPR, security)  
**Mitigación:**

- No tocar lógica de encryption
- Solo migrar UI, mantener backend intacto
- Tests de integración con API /api/persona

---

## 📦 Archivos Afectados

### Modificados

```
frontend/src/pages/
├── PlanPicker.jsx
├── Pricing.jsx
├── StyleProfile.jsx
├── AccountsPage.js → AccountsPage.jsx (renamed)
├── Shop.jsx
└── CheckoutSuccess.jsx
```

### Creados

```
tests/unit/pages/
├── PlanPicker.test.jsx
├── Pricing.test.jsx
├── StyleProfile.test.jsx
├── AccountsPage.test.jsx
├── Shop.test.jsx
└── CheckoutSuccess.test.jsx

tests/e2e/
└── ui-migration-fase4.spec.js

docs/test-evidence/issue-862/
├── summary.md
└── screenshots/
    ├── planpicker-comparison.png
    ├── pricing-table.png
    ├── styleprofile-onboarding.png
    ├── accounts-multi-tenant.png
    ├── shop-credits.png
    └── checkout-success.png
```

### Actualizados (GDD)

```
docs/nodes/
├── plan-features.md  (añadir "Agentes Relevantes: FrontendDev, TestEngineer")
├── persona.md        (añadir referencias a StyleProfile)
└── multi-tenant.md   (documentar AccountsPage RLS validation)
```

---

## 🎓 Agentes Relevantes

**Agentes a invocar durante implementación:**

1. **FrontendDev** (OBLIGATORIO)
   - Trigger: Cambios en `frontend/src/pages/*.jsx`
   - Workflow: `Cmd+I → @frontend/src/pages/ @frontend/src/components/ui/`
   - Receipt: `docs/agents/receipts/cursor-frontend-862.md`

2. **TestEngineer** (OBLIGATORIO)
   - Trigger: Nuevos componentes sin tests
   - Workflow: Generar tests según test-generation-skill
   - Receipt: `docs/agents/receipts/cursor-test-engineer-862.md`

3. **UIDesigner** (OPCIONAL)
   - Trigger: Si se necesita guidance en design system
   - Workflow: Consulta sobre patrones shadcn/ui
   - Receipt: `docs/agents/receipts/cursor-ui-designer-862.md` o SKIPPED

4. **Guardian** (CONDICIONAL)
   - Trigger: Si se tocan rutas de API o encryption
   - Workflow: `node scripts/guardian-gdd.js --full`
   - Receipt: `docs/agents/receipts/cursor-guardian-862.md` o SKIPPED

---

## 📚 Referencias

### Documentación Técnica

- Epic #846: UI Refactor completo
- Issue #847: Fase 2 (Dashboard + Core)
- Issue #848: Fase 3 (Configuration + Admin)
- `docs/ui-components.md`: Inventario de componentes shadcn/ui
- `docs/ai-ui-rules.md`: Reglas de diseño

### Nodos GDD

- `@docs/nodes/plan-features.md`: Tiers, limits, feature gates
- `@docs/nodes/persona.md`: Identity, boundaries, tolerance
- `@docs/nodes/multi-tenant.md`: RLS, org isolation
- `@docs/nodes/roast.md`: Roast generation flow

### CodeRabbit Lessons

- `@docs/patterns/coderabbit-lessons.md`: Patrones a evitar

---

## ✅ Definition of Done Checklist

- [ ] 6 pantallas migradas sin romper funcionalidad
- [ ] Build exitoso (`npm run build:ci`)
- [ ] Tests pasando 100% (`npm test`)
- [ ] Coverage >= 90% en archivos modificados
- [ ] Screenshots en `docs/test-evidence/issue-862/`
- [ ] Sin console.logs ni TODOs en código
- [ ] CodeRabbit review = 0 comentarios
- [ ] CI/CD passing (all checks green)
- [ ] **CRÍTICO:** Checkout flow validado manualmente
- [ ] GDD health >= 87
- [ ] Receipts de agentes generados
- [ ] PR creada y mergeada
- [ ] Epic #846 cerrado con mensaje de cierre

---

**Estimación Total:** 6-8 horas  
**Complejidad:** Alta (CRÍTICO: checkout flow + encryption + RLS)  
**Prioridad:** High (cierra Epic completo)  
**Status:** 🟢 READY TO START
