# GDD 2.0 - Phase 11: Command Center UI (Snake Eater Aesthetic)

**Date**: October 6, 2025
**Priority**: P0 (High emotional investment from user)
**Complexity**: High (Complete UI redesign with real-time data integration)

---

## 🎯 Objective

Transform the GDD Admin Dashboard into a **cyberpunk-inspired Command Center** for real-time GDD system monitoring and visualization, following the Snake Eater UI aesthetic from the reference images.

### Key Requirements

1. **Dark cyberpunk control-room aesthetic** matching reference images
2. **No emojis** - professional, data-driven interface
3. **Sharp corners, thin borders, neon accents** (#50fa7b primary accent)
4. **Real-time data synchronization** from GDD system artifacts
5. **Interactive graph visualization** with node details drawer
6. **Reports viewer** with Markdown rendering
7. **Left sidebar navigation** with persistent status indicators

---

## 📋 Current State Assessment

### Existing Dashboard Components

**File**: `src/pages/GDDDashboard/index.tsx`

- ✅ Basic layout with 4 components
- ✅ Snake Eater theme integration
- ✅ Overview, NodeExplorer, DependencyGraph, ReportsViewer

**Strengths**:

- Components are functional and data-driven
- Theme system already in place
- DependencyGraph recently redesigned with workflow-style layout

**Gaps**:

- ❌ No left sidebar navigation
- ❌ No system status cards in header
- ❌ No interactive node details drawer
- ❌ Missing corner separators and cyberpunk UI elements
- ❌ No real-time data refresh mechanism

---

## 🎨 Visual Design Specification

### Reference Image Analysis

**Grupo.png** shows:

- Left sidebar with "Agent Activity" stats (Total: 72, Success: 45, Failed: 27)
- Risk indicators (HIGH RISK: 30, MEDIUM RISK: 34, LOW RISK: 08)
- List of agents with IDs and codenames
- Monospaced typography (JetBrains Mono)
- Sharp corner separators on panels
- Dark background (#0b0b0d) with card panels (#1f1d20)

**Grupo 2.png** shows:

- Same left sidebar structure
- Main area with operation details table
- Color-coded status indicators (yellow warning headers, green action buttons)
- Right sidebar with "Operations List" showing mission codes
- Consistent corner separator treatment

### Color Palette (Snake Eater UI)

```css
--color-bg-base: #0b0b0d; /* Main background */
--color-bg-card: #1f1d20; /* Panel/card background */
--color-text-primary: #bdbdbd; /* Primary text */
--color-text-secondary: #8a8a8a; /* Secondary text */
--color-success: #50fa7b; /* Neon green accent */
--color-warning: #f1fa8c; /* Yellow warning */
--color-danger: #ff5555; /* Red critical */
```

### Typography

```css
font-family: 'JetBrains Mono', monospace;
font-weight:
  400 (regular),
  600 (semibold);
text-transform: uppercase (for labels);
letter-spacing: 0.05em;
```

### Component Patterns

**Corner Separators**:

```css
position: relative;
&::before,
&::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  border: 1px solid var(--color-success);
}
&::before {
  top: 0;
  left: 0;
  border-right: none;
  border-bottom: none;
}
&::after {
  top: 0;
  right: 0;
  border-left: none;
  border-bottom: none;
}
```

**Status Cards**:

```typescript
interface StatusCard {
  label: string; // e.g. "HEALTH SCORE"
  value: number; // e.g. 95.5
  max?: number; // e.g. 100
  status: 'healthy' | 'warning' | 'critical';
  color: string; // Dynamic based on status
}
```

---

## 🧩 Component Architecture

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ TOP BAR (System Status Cards + Last Updated)               │
├─────────────┬───────────────────────────────────────────────┤
│ LEFT PANEL  │ MAIN CONTENT AREA                             │
│             │                                                │
│ - Status    │ [Graph View / Reports Viewer]                 │
│ - Nav Menu  │                                                │
│             │                                                │
│             ├───────────────────────────────────────────────┤
│             │ RIGHT DRAWER (Node Details - conditional)    │
└─────────────┴───────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. **CommandCenterLayout.tsx** (New)

- Main layout wrapper
- Grid: `grid-template-columns: 280px 1fr`
- Manages drawer state (open/closed)
- Provides context for active view

#### 2. **SystemStatusBar.tsx** (New)

- Top bar with 4 status cards:
  - Health Score (from `gdd-health.json`)
  - Drift Risk (from `gdd-drift.json`)
  - Total Nodes (from `system-map.yaml`)
  - Coverage (average from `gdd-health.json`)
- Last Updated timestamp
- Refresh button (re-fetches all data sources)

#### 3. **LeftSidebar.tsx** (New)

- **System Status Section** (top):
  - Compact stat blocks (Total Nodes, Health, Drift, Coverage)
  - Color-coded indicators
- **Navigation Menu**:
  - Feature Flags (link to `/admin/feature-flags`)
  - User Search (link to `/admin/users`)
  - Health Panel (switches main view to Health Panel)
  - Release Panel (A/B Tests) - disabled/placeholder
- Active section highlighting
- Corner separators on each section

#### 4. **HealthPanel.tsx** (Enhanced)

Replaces or enhances existing Overview component

- System metrics cards (same as top bar, but larger)
- Recent Activity Log:
  - Parse `docs/system-validation.md` for recent entries
  - Display last 10 validation events
  - Format: timestamp + event description
- Color-coded status indicators

#### 5. **GraphView.tsx** (Enhanced)

Enhance existing DependencyGraph component

- **Hierarchical layout** (already implemented in DependencyGraph)
- **Node interactions**:
  - Hover: Tooltip with metadata
  - Click: Opens NodeDetailsDrawer + highlights paths
- **Controls**:
  - Auto-fit button (centers graph)
  - View mode toggle (if multiple layouts)
- **Data source**: `gdd-graph.json` (already working)

#### 6. **NodeDetailsDrawer.tsx** (New)

- Slides in from right when node clicked
- Width: 400px
- Sections:
  - **Node Metadata**: Name, file path, status, health score, coverage
  - **Dependencies**: Clickable chips for `depends_on` / `used_by`
  - **Recent Activity**: Extract from drift/health reports
  - **Agent Assignments**: List from node metadata
  - **Actions**: "Open in Repo" button (GitHub link)
- Close button (X) at top-right
- Smooth slide animation (framer-motion)

#### 7. **ReportsViewer.tsx** (Enhanced)

Already exists, needs styling updates

- **Dropdown selector** (styled with Snake Eater aesthetic):
  - System Validation Report (`docs/system-validation.md`)
  - Drift Report (`docs/drift-report.md`)
  - Health Summary (`docs/system-health.md`)
  - Implementation Summary (`docs/GDD-IMPLEMENTATION-SUMMARY.md`)
- **Download button** (green neon accent)
- **Markdown rendering** with syntax highlighting
- **Auto-refresh** when files change (polling or file watcher)

---

## 📊 Data Integration

### Data Sources

| Source                      | Format   | Update Frequency  | Consumer Components                             |
| --------------------------- | -------- | ----------------- | ----------------------------------------------- |
| `gdd-health.json`           | JSON     | On validation     | SystemStatusBar, HealthPanel, NodeDetailsDrawer |
| `gdd-status.json`           | JSON     | On validation     | HealthPanel, GraphView                          |
| `gdd-drift.json`            | JSON     | On drift analysis | SystemStatusBar, NodeDetailsDrawer              |
| `system-map.yaml`           | YAML     | On node changes   | GraphView, SystemStatusBar                      |
| `docs/system-validation.md` | Markdown | On validation     | ReportsViewer, HealthPanel (activity log)       |
| `docs/drift-report.md`      | Markdown | On drift analysis | ReportsViewer                                   |
| `docs/system-health.md`     | Markdown | On health scoring | ReportsViewer                                   |

### Data Fetching Strategy

**Initial Load**:

```typescript
useEffect(() => {
  async function fetchAllData() {
    const [health, status, drift, graph] = await Promise.all([
      fetch('/gdd-health.json').then((r) => r.json()),
      fetch('/gdd-status.json').then((r) => r.json()),
      fetch('/gdd-drift.json').then((r) => r.json()),
      fetch('/gdd-graph.json').then((r) => r.json())
    ]);

    setData({ health, status, drift, graph });
  }

  fetchAllData();
}, []);
```

**Auto-Refresh** (polling every 30 seconds):

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    fetchAllData();
  }, 30000);

  return () => clearInterval(interval);
}, []);
```

**Manual Refresh** (button in SystemStatusBar):

```typescript
const handleRefresh = async () => {
  setRefreshing(true);
  await fetchAllData();
  setRefreshing(false);
};
```

---

## 🎬 Animation & Interactions

### Framer Motion Animations

**Drawer Slide-In**:

```typescript
<motion.div
  initial={{ x: '100%' }}
  animate={{ x: 0 }}
  exit={{ x: '100%' }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
  {/* Drawer content */}
</motion.div>
```

**Status Card Fade-In**:

```typescript
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, delay: index * 0.1 }}
>
  {/* Card content */}
</motion.div>
```

**Graph Node Highlight**:

```typescript
// On click
d3.select(node).transition().duration(300).attr('stroke', '#50fa7b').attr('stroke-width', 3);

// Connected paths
svg
  .selectAll('path')
  .filter((d) => d.source === nodeId || d.target === nodeId)
  .transition()
  .duration(300)
  .attr('stroke', '#50fa7b')
  .attr('stroke-width', 3);
```

### Interaction States

**Hover**:

- Subtle brightness increase
- Neon glow on borders
- Cursor: pointer

**Active/Selected**:

- Full neon green border
- Background slightly lighter
- Persist until deselected

**Disabled**:

- Opacity: 0.5
- Cursor: not-allowed
- No hover effects

---

## 📁 File Structure

```
admin-dashboard/
├── src/
│   ├── pages/
│   │   └── GDDDashboard/
│   │       ├── index.tsx                 # Main entry (updated)
│   │       ├── CommandCenterLayout.tsx   # NEW
│   │       ├── SystemStatusBar.tsx       # NEW
│   │       ├── LeftSidebar.tsx           # NEW
│   │       ├── HealthPanel.tsx           # NEW (replaces Overview)
│   │       ├── GraphView.tsx             # NEW (wraps DependencyGraph)
│   │       ├── NodeDetailsDrawer.tsx     # NEW
│   │       └── ReportsViewer.tsx         # ENHANCED (existing)
│   ├── components/
│   │   └── dashboard/
│   │       ├── DependencyGraph.tsx       # KEEP (recently redesigned)
│   │       ├── StatusCard.tsx            # NEW
│   │       ├── CornerSeparator.tsx       # NEW
│   │       ├── ActivityLogItem.tsx       # NEW
│   │       └── NodeChip.tsx              # NEW
│   ├── hooks/
│   │   ├── useGDDData.ts                 # NEW (data fetching)
│   │   ├── useNodeDetails.ts             # NEW (node metadata)
│   │   └── useReports.ts                 # NEW (report loading)
│   ├── services/
│   │   └── gddApi.ts                     # ENHANCED (add new endpoints)
│   └── types/
│       └── gdd.types.ts                  # ENHANCED (add drawer types)
```

---

## 🚀 Implementation Phases

### Phase 11.1: Layout & Navigation (2-3 hours)

1. Create `CommandCenterLayout.tsx`
2. Create `LeftSidebar.tsx` with navigation menu
3. Create `SystemStatusBar.tsx` with status cards
4. Update `GDDDashboard/index.tsx` to use new layout
5. Add corner separator component
6. Test responsive layout (desktop only for now)

**Acceptance Criteria**:

- [ ] Left sidebar visible with navigation menu
- [ ] Top bar shows 4 status cards with real data
- [ ] Corner separators on all panels
- [ ] Navigation switches between views
- [ ] Layout matches reference images (structure)

### Phase 11.2: Health Panel & Activity Log (1-2 hours)

1. Create `HealthPanel.tsx`
2. Parse `docs/system-validation.md` for activity log
3. Create `ActivityLogItem.tsx` component
4. Integrate with `useGDDData` hook
5. Add auto-refresh mechanism

**Acceptance Criteria**:

- [ ] Health metrics display correctly
- [ ] Activity log shows recent 10 events
- [ ] Data refreshes every 30 seconds
- [ ] Manual refresh button works
- [ ] Color-coded status indicators

### Phase 11.3: Interactive Graph & Node Drawer (2-3 hours)

1. Create `GraphView.tsx` wrapper
2. Enhance `DependencyGraph.tsx` with click handlers
3. Create `NodeDetailsDrawer.tsx`
4. Implement slide-in animation (framer-motion)
5. Add node metadata display
6. Create `NodeChip.tsx` for dependency chips

**Acceptance Criteria**:

- [ ] Clicking node opens drawer
- [ ] Drawer shows correct metadata
- [ ] Dependencies are clickable chips
- [ ] "Open in Repo" button links to GitHub
- [ ] Smooth slide animation
- [ ] Clicking outside drawer closes it

### Phase 11.4: Reports Viewer Enhancement (1 hour)

1. Update `ReportsViewer.tsx` styling
2. Add Snake Eater themed dropdown
3. Add download button (MD/PDF export)
4. Implement auto-refresh for reports
5. Add loading states

**Acceptance Criteria**:

- [ ] Dropdown styled with dark theme
- [ ] Download button functional
- [ ] Reports refresh when files change
- [ ] Loading spinner during fetch
- [ ] Markdown renders correctly

### Phase 11.5: Polish & Accessibility (1 hour)

1. Add loading states to all components
2. Add error boundaries
3. Test keyboard navigation
4. Add ARIA labels
5. Test with screen reader
6. Verify color contrast (WCAG AA)

**Acceptance Criteria**:

- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels on all controls
- [ ] Error states display gracefully
- [ ] Loading spinners consistent
- [ ] Color contrast passes WCAG AA

---

## 🎨 Design Tokens

### Spacing

```typescript
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px'
};
```

### Typography

```typescript
export const typography = {
  fontFamily: {
    mono: "'JetBrains Mono', 'Fira Code', monospace"
  },
  fontSize: {
    xs: '10px',
    sm: '12px',
    md: '14px',
    lg: '16px',
    xl: '20px',
    xxl: '24px'
  },
  fontWeight: {
    regular: 400,
    semibold: 600,
    bold: 700
  }
};
```

### Shadows

```typescript
export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.5)',
  md: '0 4px 6px rgba(0, 0, 0, 0.6)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.7)',
  glow: '0 0 10px rgba(80, 250, 123, 0.5)'
};
```

---

## 🧪 Testing Strategy

### Unit Tests

- `useGDDData` hook (data fetching)
- Status card calculations (health score, drift risk)
- Activity log parser (Markdown extraction)

### Integration Tests

- Left sidebar navigation
- Graph node click → drawer open
- Drawer dependency chip click → navigate to node
- Reports dropdown → content switch

### E2E Tests (Playwright)

- Full workflow: Open dashboard → Click node → View details → Close drawer
- Reports viewer: Select report → Download → Verify file
- Auto-refresh: Wait 30s → Verify data updates

---

## ⚠️ Known Constraints

1. **No emojis**: User explicitly requested professional, data-driven UI
2. **Desktop-first**: Mobile responsiveness deferred to Phase 11.6
3. **Real data only**: No mock data, all sources must be live
4. **Snake Eater theme**: Must use existing theme system, no custom colors
5. **Existing DependencyGraph**: Keep recently redesigned component, wrap it

---

## 📝 Commit Strategy

**Commit 1**: Layout & Navigation

```
feat(phase-11): Add Command Center layout with left sidebar

- Create CommandCenterLayout with grid structure
- Implement LeftSidebar with navigation menu
- Add SystemStatusBar with status cards
- Add corner separator component
- Update GDDDashboard to use new layout
```

**Commit 2**: Health Panel & Activity Log

```
feat(phase-11): Implement Health Panel with activity log

- Create HealthPanel component
- Parse system-validation.md for activity events
- Add ActivityLogItem component
- Integrate auto-refresh mechanism
- Add manual refresh button
```

**Commit 3**: Interactive Graph & Node Drawer

```
feat(phase-11): Add interactive graph with node details drawer

- Create GraphView wrapper component
- Enhance DependencyGraph with click handlers
- Implement NodeDetailsDrawer with slide animation
- Add node metadata display
- Create clickable dependency chips
```

**Commit 4**: Reports Viewer Enhancement

```
feat(phase-11): Enhance Reports Viewer with Snake Eater styling

- Update ReportsViewer with dark theme dropdown
- Add download button for MD/PDF export
- Implement auto-refresh for reports
- Add loading states
```

**Commit 5**: Polish & Accessibility

```
feat(phase-11): Add polish and accessibility features

- Add loading states to all components
- Implement error boundaries
- Add keyboard navigation support
- Add ARIA labels for screen readers
- Verify WCAG AA color contrast
```

---

## 🎯 Success Metrics

- [ ] Visual similarity to reference images: **90%+**
- [ ] No emojis in UI
- [ ] All data from live sources (no mocks)
- [ ] Interactive graph with functional drawer
- [ ] Reports viewer with download capability
- [ ] Auto-refresh every 30 seconds
- [ ] Keyboard accessible
- [ ] WCAG AA compliant
- [ ] Framer Motion animations smooth (60fps)
- [ ] User approval: **High emotional satisfaction**

---

## 🚦 Next Steps

1. **User Approval**: Get confirmation on plan before implementation
2. **Phase 11.1**: Start with layout & navigation
3. **Incremental Commits**: Commit after each phase for review
4. **Visual Validation**: Screenshot comparisons with reference images
5. **User Feedback**: Iterate based on visual approval

---

**Priority**: P0
**Estimated Time**: 7-10 hours total
**User Emotion**: High excitement ("me haría mucha ilusión")
**Risk**: Low (isolated feature, no breaking changes)

---

**Next Action**: Wait for user approval, then proceed with Phase 11.1 implementation.
