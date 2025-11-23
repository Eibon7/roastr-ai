# GDD 2.0 - Phase 11 Context & Prompt

**Date:** 2025-10-06
**Status:** Ready to start Phase 11 + 11.5

---

## 📊 Project Status

### Completed Phases (1-10)

**GDD 2.0 Status:** ✅ FULLY OPERATIONAL + PREDICTIVE + COHERENT + ENRICHED + SELF-HEALING

- ✅ **Phase 1-5:** Graph Driven Development foundation
- ✅ **Phase 6:** Runtime Validator
- ✅ **Phase 7:** Node Health Scoring System
- ✅ **Phase 7.1:** System Health Recovery
- ✅ **Phase 8:** Predictive Drift Detection
- ✅ **Phase 9:** Coverage & Update Enrichment
- ✅ **Phase 10:** Auto-Repair Assistant

### Current Metrics

- **Health Score:** 95.5/100
- **Drift Risk:** 17/100
- **Total Nodes:** 13 (all healthy)
- **Coverage:** 45-87% across nodes
- **Orphan Nodes:** 0
- **Missing References:** 0
- **Critical Issues:** 0

### Maintenance Loop

```
Detection → Health Scoring → Auto-Repair → Validation → Rollback (if needed)
                                   ↑                          ↓
                                   └──────────────────────────┘
```

---

## 📂 Key Files & Directories

### GDD Scripts (`/scripts/`)

```
scripts/
├── resolve-graph.js           # Dependency resolution
├── validate-gdd-runtime.js    # Runtime validation
├── watch-gdd.js               # File watcher with dashboard
├── score-gdd-health.js        # Health scoring (5 factors)
├── predict-gdd-drift.js       # Drift prediction
├── enrich-gdd-nodes.js        # Auto-enrich metadata
├── compute-gdd-health.js      # CI/CD health validation
├── auto-repair-gdd.js         # Auto-repair engine (650+ lines)
└── rollback-gdd-repair.js     # Rollback system (200+ lines)
```

### GDD Documentation (`/docs/`)

```
docs/
├── GDD-IMPLEMENTATION-SUMMARY.md  # Complete history of Phases 1-10
├── system-map.yaml                # 13 nodes with dependencies
├── system-health.md               # Latest health report
├── drift-report.md                # Drift analysis
├── auto-repair-report.md          # Latest repair results
├── auto-repair-changelog.md       # Historical repairs
└── nodes/                         # 13 node documentation files
    ├── roast.md
    ├── shield.md
    ├── queue-system.md
    ├── multi-tenant.md
    ├── cost-control.md
    ├── billing.md
    ├── plan-features.md
    ├── persona.md
    ├── tone.md
    ├── platform-constraints.md
    ├── social-platforms.md
    ├── analytics.md
    └── trainer.md
```

### GDD Data Files (root)

```
/
├── gdd-health.json    # Health scores per node
├── gdd-status.json    # Validation status
└── gdd-drift.json     # Drift predictions
```

### Frontend Structure (`/roastr-ai-frontend/`)

```
src/
├── components/        # Reusable React components
├── pages/
│   ├── dashboard.jsx
│   └── admin/        # Admin pages (to be refactored)
├── contexts/         # React contexts
├── hooks/            # Custom hooks
└── api/              # API clients
```

---

## 🎯 Phase 11 + 11.5 Objectives

### Phase 11: Interactive GDD Dashboard

Build an **admin panel** that visualizes GDD system state in real-time.

**Components:**

1. **GDD Overview** - Health, drift, sync status, auto-repair status
2. **Node Explorer** - Interactive table with all 13 nodes
3. **Dependency Graph** - Visual graph with D3/ForceGraph
4. **Reports Viewer** - Render validation, drift, coverage reports
5. **Real-time Watcher** - WebSocket/EventSource integration

**Tech Stack:**

- React 18 + TypeScript
- Snake Eater UI (`npm install snake-eater-ui`)
- D3.js or react-force-graph
- Real-time updates via WebSocket/EventSource

**Output:**

- Route: `/admin/gdd-dashboard`
- Components in: `src/admin/gdd-dashboard/`

### Phase 11.5: Snake Eater UI Theme Refactor

Unify entire backoffice under **Snake Eater UI** design system.

**Tasks:**

1. Install Snake Eater UI package
2. Create ThemeProvider with dark-cyber palette
3. Refactor all admin layouts (sidebar, header, modals)
4. Update typography and spacing (8px grid)
5. Create `docs/ui-guidelines.md`
6. Ensure Phase 11 dashboard uses only Snake Eater components

**Design Goals:**

- Dark theme by default
- Sharp corners, minimal cyber aesthetic
- Gray-neon typography
- Consistent spacing and components

---

## 📋 Deliverables

1. **Dashboard App** (`src/admin/gdd-dashboard/`)
   - Overview component
   - Node Explorer table
   - Dependency Graph
   - Reports Viewer
   - Real-time updates

2. **Theme System** (`src/admin/theme/`)
   - ThemeProvider
   - Design tokens
   - Component overrides

3. **UI Guidelines** (`docs/ui-guidelines.md`)
   - Color palette
   - Component usage
   - Accessibility standards

4. **Documentation** (`docs/GDD-IMPLEMENTATION-SUMMARY.md`)
   - Phase 11 + 11.5 sections (~400 lines)

5. **Screenshots** (`docs/previews/`)
   - Dashboard overview
   - Node explorer
   - Dependency graph
   - Reports viewer

---

## ✅ Success Criteria

- 🟢 Dashboard operational and showing real-time data
- 🟢 Snake Eater UI applied to 100% of backoffice
- 🟢 No breaking changes to auth or routing
- 🟢 Health Score ≥ 95 post-refactor
- 🟢 UI documented and standardized
- 🟢 All GDD data sources integrated

---

## 🧪 Testing Commands

```bash
# Start dashboard locally
npm run dev

# Validate GDD coherence after refactor
node scripts/validate-gdd-runtime.js --full
node scripts/predict-gdd-drift.js --full

# Health check
node scripts/compute-gdd-health.js --ci

# Auto-repair if needed
node scripts/auto-repair-gdd.js --dry-run
```

---

## 🎨 Snake Eater UI Reference

**Installation:**

```bash
npm install snake-eater-ui
```

**Usage:**

```jsx
import 'snake-eater-ui/styles';
import { Card, Button, Grid, Heading, Text } from 'snake-eater-ui';

function Dashboard() {
  return (
    <Card variant="dark">
      <Heading level={1}>GDD Dashboard</Heading>
      <Grid cols={3} gap={4}>
        <Card>
          <Text>Health: 95.5/100</Text>
        </Card>
      </Grid>
      <Button variant="primary">Trigger Repair</Button>
    </Card>
  );
}
```

**Theme Variables:**

- Primary: Neon green (#00ff41)
- Background: Dark gray (#0a0e14)
- Surface: Darker gray (#151921)
- Text: Light gray (#c5c8c6)
- Border: Subtle gray (#1f2430)

---

## 📊 GDD Data Sources for Dashboard

### 1. Health Data (`gdd-health.json`)

```json
{
  "average_score": 95.5,
  "overall_status": "HEALTHY",
  "nodes": {
    "roast": {
      "score": 100,
      "status": "healthy",
      "breakdown": {
        "syncAccuracy": 100,
        "updateFreshness": 100,
        "dependencyIntegrity": 100,
        "coverageEvidence": 100,
        "agentRelevance": 100
      }
    }
  }
}
```

### 2. Drift Data (`gdd-drift.json`)

```json
{
  "overall_risk": 17,
  "nodes": {
    "roast": {
      "risk_score": 15,
      "predicted_issues": []
    }
  }
}
```

### 3. System Map (`docs/system-map.yaml`)

```yaml
nodes:
  roast:
    description: Core roast generation
    depends_on: [persona, tone, platform-constraints, shield, cost-control]
    used_by: [analytics, trainer]
    status: production
    priority: critical
```

### 4. Validation Status (`gdd-status.json`)

```json
{
  "status": "HEALTHY",
  "orphans": [],
  "missing_refs": [],
  "cycles": []
}
```

---

## 🚀 Implementation Approach

### Step 1: Setup (Phase 11.5)

1. Install Snake Eater UI
2. Create ThemeProvider in `src/admin/theme/`
3. Wrap App with ThemeProvider
4. Test basic components

### Step 2: Dashboard Structure (Phase 11)

1. Create route `/admin/gdd-dashboard`
2. Create layout with sidebar navigation
3. Setup data fetching hooks
4. Create overview cards

### Step 3: Components (Phase 11)

1. **Overview Component** - Health score cards, drift risk, status badges
2. **Node Explorer** - Table with search, filter, sort
3. **Dependency Graph** - D3/ForceGraph visualization
4. **Reports Viewer** - Tabs for validation, drift, coverage reports

### Step 4: Real-time Updates (Phase 11)

1. Setup WebSocket/EventSource connection to `watch-gdd.js`
2. Subscribe to GDD file changes
3. Update UI with animations

### Step 5: Theme Refactor (Phase 11.5)

1. Refactor existing admin pages to use Snake Eater UI
2. Update all buttons, cards, modals
3. Ensure consistent spacing and typography

### Step 6: Documentation & Testing

1. Create UI guidelines
2. Take screenshots
3. Update GDD-IMPLEMENTATION-SUMMARY.md
4. Test all components
5. Validate health score

---

## 💡 Implementation Tips

**For the New Session:**

1. **Start with theme setup** - Get Snake Eater UI working first
2. **Build incrementally** - One component at a time
3. **Use mock data initially** - Test UI before connecting real data
4. **Test responsiveness** - Dashboard should work on different screen sizes
5. **Accessibility** - Ensure proper ARIA labels and keyboard navigation

**Data Fetching:**

```jsx
// Hook to fetch GDD health data
const useGDDHealth = () => {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch('/gdd-health.json')
      .then((res) => res.json())
      .then(setHealth);
  }, []);

  return health;
};
```

**Real-time Updates:**

```jsx
// WebSocket connection to watcher
const useGDDWatcher = () => {
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001/gdd-watch');

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      // Update dashboard state
    };

    return () => ws.close();
  }, []);
};
```

---

## 📝 Notes for Implementation

- **Branch:** Create new branch `feat/gdd-dashboard-phase-11`
- **Commits:** Commit incrementally (setup, components, theme, docs)
- **Testing:** Test each component before moving to next
- **Documentation:** Update docs as you build
- **Screenshots:** Take screenshots before final commit

---

---

## 🎭 GDD Orchestration Process for Phase 11

**IMPORTANTE:** Phase 11 + 11.5 es un proyecto de frontend completo que **requiere orquestación de agentes** siguiendo el proceso GDD documentado en CLAUDE.md.

### Agentes a Invocar

Según las reglas de orquestación en CLAUDE.md:

1. **Orchestrator (tú)** - Coordinar todo el proceso
2. **UI Designer Agent** - Diseñar componentes y sistema de diseño
3. **UX Researcher Agent** - Validar flujos de usuario y accesibilidad
4. **Frontend Developer Agent** - Implementar componentes React
5. **Test Engineer Agent** - Crear tests + evidencias visuales con Playwright
6. **Documentation Agent** - Mantener docs actualizados

### Flujo de Trabajo GDD

#### 1. Planning Mode (OBLIGATORIO)

**Antes de implementar**, genera un plan completo en modo texto:

```bash
# El Orchestrator debe crear:
docs/plan/phase-11-dashboard.md
```

**Contenido del plan:**

- Diseño de componentes (UI Designer input)
- Arquitectura de componentes (Frontend Dev input)
- Flujos de usuario (UX Researcher input)
- Estrategia de testing (Test Engineer input)
- Criterios de validación

**Solo después del plan validado → implementación**

#### 2. Diseño de UI (UI Designer Agent)

**Responsabilidades:**

- Diseñar sistema de componentes basado en Snake Eater UI
- Crear paleta de colores dark-cyber
- Definir espaciado y tipografía
- Wireframes de dashboard components

**Output esperado:**

```
docs/design/
├── phase-11-ui-design.md
├── color-palette.md
├── component-specs.md
└── wireframes/
    ├── overview.png
    ├── node-explorer.png
    └── dependency-graph.png
```

#### 3. Research UX (UX Researcher Agent)

**Responsabilidades:**

- Validar flujos de navegación
- Definir interacciones (click, hover, tooltips)
- Accessibility requirements (ARIA, keyboard navigation)
- Responsive breakpoints

**Output esperado:**

```
docs/ux/
├── phase-11-user-flows.md
├── interaction-patterns.md
└── accessibility-checklist.md
```

#### 4. Implementación (Frontend Developer Agent)

**Responsabilidades:**

- Setup Snake Eater UI
- Crear ThemeProvider
- Implementar componentes React
- Integrar con fuentes de datos GDD
- Real-time updates con WebSocket

**Output esperado:**

```
src/admin/gdd-dashboard/
├── index.tsx
├── components/
│   ├── Overview.tsx
│   ├── NodeExplorer.tsx
│   ├── DependencyGraph.tsx
│   └── ReportsViewer.tsx
├── hooks/
│   ├── useGDDHealth.ts
│   ├── useGDDWatcher.ts
│   └── useSystemMap.ts
└── theme/
    ├── ThemeProvider.tsx
    └── tokens.ts
```

#### 5. Testing (Test Engineer Agent)

**Responsabilidades:**

- Tests unitarios para hooks
- Tests de integración para componentes
- **Evidencias visuales con Playwright** (OBLIGATORIO según CLAUDE.md)
- Screenshot testing en múltiples viewports

**Output esperado:**

```
tests/
└── admin/
    └── gdd-dashboard/
        ├── Overview.test.tsx
        ├── NodeExplorer.test.tsx
        └── visual/
            ├── dashboard.spec.ts
            └── screenshots/

docs/test-evidence/
└── phase-11/
    ├── SUMMARY.md
    ├── visual-regression/
    └── playwright-report.html
```

#### 6. Documentation (Documentation Agent)

**Responsabilidades:**

- Actualizar GDD-IMPLEMENTATION-SUMMARY.md
- Crear UI guidelines (docs/ui-guidelines.md)
- Documentar APIs de componentes
- Mapa de cobertura de tests

**Output esperado:**

```
docs/
├── GDD-IMPLEMENTATION-SUMMARY.md (actualizado)
├── ui-guidelines.md
└── phase-11/
    ├── component-api.md
    └── integration-guide.md
```

### Reglas de Orquestación (desde CLAUDE.md)

**Del archivo CLAUDE.md:**

```markdown
### Función de Orquestador

- **Actuar como orquestador del resto de subagentes**: Coordinar y supervisar las tareas de todos los agentes especializados del sistema.
- **Mantener un archivo de contexto global spec.md actualizado**: Gestionar un documento central que refleje el estado actual de la especificación del sistema.
- **Invocar siempre al Test Engineer Agent** tras cambios en src/ o en documentos de diseño (ux.md, ui.md, ui-whimsy.md) para generar tests + evidencias visuales con Playwright.

### Reglas de Commits y Tests

- **Commit sin tests no permitido**: Todo código nuevo debe incluir pruebas correspondientes.
- **Si se detecta código nuevo sin tests asociados → coordinar con Test Engineer** para generar los tests antes de cerrar la tarea.
- **Cambios en UI/frontend deben incluir evidencias visuales**: capturas + report.md en docs/test-evidence/ para validar la implementación visual.

### Planning Mode

- **Antes de implementar cualquier feature/tarea, genera siempre un plan en modo texto (planning mode)**.
- **El plan debe describir**: pasos de diseño, subagentes a usar, archivos afectados, criterios de validación.
- **Guarda el plan en `docs/plan/<issue>.md`**.
- **Solo después de que el plan esté guardado y validado, procede a la implementación**.
```

### Configuración MCP Playwright (OBLIGATORIO para UI)

**Para cualquier cambio de frontend**, el orquestador debe:

- Ejecutar Playwright MCP para validación visual automatizada
- Capturar screenshots de las páginas afectadas en múltiples viewports
- Revisar consola del navegador y logs de red para detectar errores
- Guardar un reporte completo en `docs/test-evidence/phase-11/` con evidencias visuales
- Verificar que la implementación coincide con las especificaciones de diseño

**Comandos Playwright:**

```bash
# Verificar MCP disponible
/mcp list

# Ejecutar validación visual
/mcp exec playwright

# Capturas en múltiples viewports
npm run test:visual -- --project=phase-11
```

### Secuencia de Ejecución GDD

```
1. Orchestrator → Planning Mode
   ↓ crea docs/plan/phase-11-dashboard.md

2. Orchestrator invoca UI Designer Agent
   ↓ crea docs/design/phase-11-ui-design.md + wireframes

3. Orchestrator invoca UX Researcher Agent
   ↓ crea docs/ux/phase-11-user-flows.md

4. Orchestrator invoca Frontend Developer Agent
   ↓ implementa src/admin/gdd-dashboard/

5. Orchestrator invoca Test Engineer Agent (OBLIGATORIO)
   ↓ crea tests + evidencias visuales Playwright

6. Orchestrator invoca Documentation Agent
   ↓ actualiza docs/GDD-IMPLEMENTATION-SUMMARY.md

7. Orchestrator valida → Commit final
```

### Uso del Task Tool para Invocar Agentes

**Ejemplo de invocación correcta:**

```javascript
// Invocar UI Designer Agent
await Task({
  subagent_type: 'UI Designer',
  description: 'Design GDD Dashboard UI',
  prompt: `
    Design the complete UI system for GDD Dashboard Phase 11.

    Requirements:
    - Based on Snake Eater UI library
    - Dark-cyber aesthetic
    - Components: Overview, Node Explorer, Dependency Graph, Reports Viewer
    - Real-time status indicators (healthy/warning/critical)

    Output:
    - docs/design/phase-11-ui-design.md
    - Color palette and typography specs
    - Component wireframes

    Use Snake Eater UI as base, extend with custom GDD components.
  `
});

// Invocar Test Engineer Agent
await Task({
  subagent_type: 'Test Engineer',
  description: 'Create visual tests for GDD Dashboard',
  prompt: `
    Create comprehensive tests for GDD Dashboard implementation.

    Requirements:
    - Unit tests for hooks (useGDDHealth, useGDDWatcher)
    - Component tests for all dashboard components
    - Playwright visual regression tests
    - Multiple viewport testing (mobile, tablet, desktop)

    Output:
    - tests/admin/gdd-dashboard/*.test.tsx
    - docs/test-evidence/phase-11/SUMMARY.md
    - Playwright screenshots and report

    Ensure 100% coverage for critical dashboard functionality.
  `
});
```

### Checkpoints de Validación

**Antes de cada fase:**

- [ ] Plan aprobado y guardado en docs/plan/
- [ ] Agentes especializados invocados correctamente
- [ ] Output de cada agente validado

**Después de implementación:**

- [ ] Tests creados y pasando
- [ ] Evidencias visuales generadas (Playwright)
- [ ] Documentación actualizada
- [ ] spec.md refleja cambios (si aplica)
- [ ] Health score ≥ 95 mantenido

### Criterios de Éxito GDD

- ✅ Plan completo en docs/plan/phase-11-dashboard.md
- ✅ Diseño UI documentado por UI Designer Agent
- ✅ Flujos UX validados por UX Researcher Agent
- ✅ Implementación completa por Frontend Dev Agent
- ✅ Tests + evidencias visuales por Test Engineer Agent
- ✅ Documentación completa por Documentation Agent
- ✅ Health Score ≥ 95 post-implementación
- ✅ No breaking changes

---

**Ready to Start Phase 11 + 11.5 with Full GDD Orchestration!** 🚀
