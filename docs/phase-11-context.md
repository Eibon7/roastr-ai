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
import 'snake-eater-ui/styles'
import { Card, Button, Grid, Heading, Text } from 'snake-eater-ui'

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
  )
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
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetch('/gdd-health.json')
      .then(res => res.json())
      .then(setHealth)
  }, [])

  return health
}
```

**Real-time Updates:**

```jsx
// WebSocket connection to watcher
const useGDDWatcher = () => {
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001/gdd-watch')

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      // Update dashboard state
    }

    return () => ws.close()
  }, [])
}
```

---

## 📝 Notes for Implementation

- **Branch:** Create new branch `feat/gdd-dashboard-phase-11`
- **Commits:** Commit incrementally (setup, components, theme, docs)
- **Testing:** Test each component before moving to next
- **Documentation:** Update docs as you build
- **Screenshots:** Take screenshots before final commit

---

**Ready to Start Phase 11 + 11.5!** 🚀
