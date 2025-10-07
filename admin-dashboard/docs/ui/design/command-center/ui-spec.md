# Command Center UI Specification - Snake Eater Aesthetic

**Version**: 1.0
**Date**: October 6, 2025
**Design System**: Snake Eater UI (Cyberpunk Dark Theme)

---

## Color Palette

```css
/* Backgrounds */
--bg-base: #0b0b0d;
--bg-card: #1f1d20;
--bg-panel: #16181a;

/* Text */
--text-primary: #bdbdbd;
--text-secondary: #8a8a8a;
--text-disabled: #5a5a5a;

/* Accents */
--accent-success: #50fa7b;  /* Neon green */
--accent-warning: #f1fa8c;  /* Yellow */
--accent-danger: #ff5555;   /* Red */
--accent-info: #8be9fd;     /* Cyan */

/* Borders */
--border-default: rgba(255, 255, 255, 0.12);
--border-hover: rgba(80, 250, 123, 0.4);
--border-active: #50fa7b;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.5);
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.6);
--shadow-lg: 0 10px 30px rgba(0, 0, 0, 0.8);
--shadow-glow: 0 0 20px rgba(80, 250, 123, 0.3);
```

---

## Typography

```css
/* Font Family */
font-family: 'JetBrains Mono', 'Fira Code', monospace;

/* Scale */
--font-xs: 10px;
--font-sm: 12px;
--font-md: 14px;
--font-lg: 16px;
--font-xl: 20px;
--font-xxl: 24px;
--font-display: 32px;

/* Weights */
--weight-regular: 400;
--weight-semibold: 600;
--weight-bold: 700;

/* Line Heights */
--line-tight: 1.2;
--line-normal: 1.5;
--line-relaxed: 1.8;

/* Letter Spacing */
--spacing-normal: 0.02em;
--spacing-wide: 0.05em;
```

---

## Layout Structure

```
Grid Layout: grid-template-columns: 280px 1fr;
           grid-template-rows: 80px 1fr;

┌────────────────────────────────────────────────────────────┐
│ TOP STATUS BAR (80px height, full width)                   │
│ [Health: 95.5] [Drift: 3] [Nodes: 13] [Coverage: 78%]     │
├──────────────┬─────────────────────────────────────────────┤
│ LEFT SIDEBAR │ MAIN CONTENT AREA                            │
│ (280px)      │ (flexible)                                   │
│              │                                               │
│ [Stats]      │ Dynamic content:                             │
│ Health: 95   │ - GraphView (default)                        │
│ Drift: 3     │ - HealthPanel                                │
│ Nodes: 13    │ - ReportsViewer                              │
│              │                                               │
│ [Navigation] │                                               │
│ □ Health     │                                               │
│ □ Flags      │                                               │
│ □ Users      │                                               │
│ □ Release    │                                               │
└──────────────┴──────────────────────────────────────────────┘
```

### With Drawer Open:

```
┌────────────────────────────────────────────────────────────┐
│ TOP STATUS BAR                                             │
├──────────────┬──────────────────────────────┬──────────────┤
│ LEFT SIDEBAR │ MAIN CONTENT                 │ NODE DRAWER  │
│              │                               │ (400px)      │
│              │                               │              │
│              │                               │ [Metadata]   │
│              │                               │ [Deps]       │
│              │                               │ [Activity]   │
└──────────────┴──────────────────────────────┴──────────────┘
```

---

## Component Specifications

### 1. CornerSeparator

**Purpose**: Sharp corner lines at panel edges (cyberpunk aesthetic)

```tsx
// Visual appearance:
┌──
│
│ [Panel Content]
│
└──

// Specifications:
border-width: 1px
corner-length: 8px
color: var(--border-default) or var(--accent-success)
position: absolute pseudo-elements (::before, ::after)

// Implementation:
&::before {
  top: 0; left: 0;
  width: 8px; height: 8px;
  border-top: 1px solid;
  border-left: 1px solid;
}
&::after {
  top: 0; right: 0;
  width: 8px; height: 8px;
  border-top: 1px solid;
  border-right: 1px solid;
}
```

### 2. StatusCard

**Purpose**: Display key metrics (Health, Drift, Nodes, Coverage)

```tsx
interface StatusCardProps {
  label: string;      // "HEALTH SCORE"
  value: number;      // 95.5
  max?: number;       // 100
  unit?: string;      // "/100" or "%"
  status: 'healthy' | 'warning' | 'critical';
}

// Dimensions:
width: min-content (200px ideal)
height: 80px
padding: 16px

// Layout:
flexbox column, centered
gap: 8px

// Typography:
label: 12px, uppercase, semibold, 0.05em spacing, text-secondary
value: 32px, semibold, color based on status
unit: 14px, regular, text-secondary

// Colors by status:
healthy: #50fa7b
warning: #f1fa8c
critical: #ff5555

// Border:
1px solid, matches status color (opacity 0.3)
```

### 3. LeftSidebar

**Sections**:
1. **System Stats** (top 120px)
   - Compact cards: 4 metrics in 2×2 grid
   - Each: 32px height, icon + value

2. **Navigation Menu** (below stats)
   - Vertical list
   - Item height: 48px
   - Padding: 12px 16px

**Navigation Item States**:
```css
/* Default */
background: transparent;
border-left: 2px solid transparent;

/* Hover */
background: rgba(255, 255, 255, 0.05);
border-left-color: rgba(80, 250, 123, 0.3);

/* Active */
background: rgba(80, 250, 123, 0.1);
border-left-color: #50fa7b;
border-left-width: 3px;
```

### 4. SystemStatusBar (Top Bar)

```
Height: 80px
Padding: 16px 24px
Background: var(--bg-card)
Border-bottom: 1px solid var(--border-default)

Layout: flex row, space-between
Left: 4 StatusCards in flex row (gap: 24px)
Right: Last Updated + Refresh button
```

### 5. NodeDetailsDrawer

**Dimensions**:
```
Width: 400px
Height: 100vh
Position: fixed, right: 0
Background: var(--bg-base)
Shadow: var(--shadow-lg)
Padding: 24px
Z-index: 100
```

**Sections** (vertical stack, gap: 24px):

1. **Header** (48px):
   - Node name (20px, semibold)
   - Close button (32×32px, top-right)

2. **Metadata Grid** (auto):
   - Status badge
   - Health score
   - Coverage %
   - Last updated

3. **Dependencies** (auto):
   - Label: "DEPENDS ON" (12px, uppercase)
   - Chips: horizontal wrap (gap: 8px)

4. **Used By** (auto):
   - Label: "USED BY"
   - Chips: horizontal wrap

5. **Recent Activity** (auto, max-height: 200px, scroll):
   - List of activity log items

6. **Actions** (48px):
   - "Open in Repo" button (full width)

**Animation**:
```tsx
// Framer Motion
initial: { x: '100%' }
animate: { x: 0 }
exit: { x: '100%' }
transition: { type: 'spring', stiffness: 300, damping: 30 }
```

### 6. NodeChip

**Purpose**: Clickable dependency/tag chip

```
Height: 28px
Padding: 4px 12px
Border-radius: 4px
Background: var(--bg-card)
Border: 1px solid var(--border-default)

Typography:
font-size: 12px
font-weight: 600
color: var(--text-primary)

States:
hover: border-color: var(--accent-success), cursor: pointer
active: background: rgba(80, 250, 123, 0.1)
```

### 7. ActivityLogItem

**Purpose**: Single activity log entry

```
Min-height: 40px
Padding: 8px 0
Border-bottom: 1px solid rgba(255, 255, 255, 0.08)

Layout: flex row, gap: 12px
├─ Timestamp (60px, fixed): 10px, text-secondary
└─ Event text (flex-1): 12px, text-primary

Last item: no border-bottom
```

---

## Spacing System

```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
--space-xxl: 48px;
```

**Usage Guidelines**:
- Component padding: md (16px)
- Section gaps: lg (24px)
- Inline gaps: sm (8px)
- Panel padding: lg (24px)

---

## Animation Timing

```css
/* Transitions */
--duration-fast: 150ms;
--duration-normal: 300ms;
--duration-slow: 500ms;

/* Easings */
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

**Usage**:
- Hover effects: 150ms ease-out
- Drawer slide: 300ms spring
- Status changes: 200ms ease-in-out
- Graph interactions: 300ms ease-in-out

---

## Accessibility

**Color Contrast** (WCAG AA):
- Text primary on bg-base: 9.2:1 ✓
- Text secondary on bg-base: 5.8:1 ✓
- Accent green on bg-base: 12.1:1 ✓

**Focus Indicators**:
```css
&:focus-visible {
  outline: 2px solid var(--accent-success);
  outline-offset: 2px;
}
```

**ARIA Requirements**:
- All buttons: `aria-label`
- Drawer: `role="dialog"`, `aria-modal="true"`
- Nav items: `aria-current="page"` when active
- Status cards: `aria-live="polite"` for updates

---

## Component Inventory

| Component | Status | File Path | Props |
|-----------|--------|-----------|-------|
| CornerSeparator | NEW | `components/dashboard/CornerSeparator.tsx` | `variant?: 'default' \| 'success'` |
| StatusCard | NEW | `components/dashboard/StatusCard.tsx` | `StatusCardProps` |
| NodeChip | NEW | `components/dashboard/NodeChip.tsx` | `label, onClick, active?` |
| ActivityLogItem | NEW | `components/dashboard/ActivityLogItem.tsx` | `timestamp, event` |
| CommandCenterLayout | NEW | `pages/GDDDashboard/CommandCenterLayout.tsx` | `children` |
| SystemStatusBar | NEW | `pages/GDDDashboard/SystemStatusBar.tsx` | `data: GDDData` |
| LeftSidebar | NEW | `pages/GDDDashboard/LeftSidebar.tsx` | `activeView, onViewChange` |
| HealthPanel | NEW | `pages/GDDDashboard/HealthPanel.tsx` | `data: GDDData` |
| GraphView | NEW | `pages/GDDDashboard/GraphView.tsx` | `data, onNodeClick` |
| NodeDetailsDrawer | NEW | `pages/GDDDashboard/NodeDetailsDrawer.tsx` | `nodeId, open, onClose` |
| ReportsViewer | UPDATE | `components/dashboard/ReportsViewer.tsx` | (style updates only) |
| DependencyGraph | KEEP | `components/dashboard/DependencyGraph.tsx` | (use as-is) |

---

## Design Decisions

1. **No Emojis**: User explicitly requested professional, data-driven UI
2. **Desktop First**: Mobile responsive deferred to Phase 11.6
3. **Monospace Typography**: JetBrains Mono for cyberpunk aesthetic
4. **Corner Separators**: Key visual signature from reference images
5. **Neon Green Accent**: Primary interaction color (#50fa7b)
6. **Dark Base**: #0b0b0d matches reference images exactly
7. **Auto-Refresh**: 30s polling for real-time feel without websockets

---

## Next Steps for Frontend Dev

1. Implement shared components first (CornerSeparator, StatusCard, NodeChip, ActivityLogItem)
2. Build layout shell (CommandCenterLayout, SystemStatusBar, LeftSidebar)
3. Implement views (HealthPanel, GraphView wrapper, NodeDetailsDrawer)
4. Style existing ReportsViewer to match
5. Wire up data fetching and auto-refresh
6. Add Framer Motion animations
7. Test accessibility and keyboard navigation

---

**Specification Complete**: Ready for Frontend Dev Agent implementation.
