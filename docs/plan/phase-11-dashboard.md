# Phase 11 + 11.5 Implementation Plan

**Created:** 2025-10-06
**Status:** Ready to Implement
**Assessment Result:** CREATE (see docs/assessment/phase-11.md)

---

## 📊 Executive Summary

**Objective:** Create an interactive GDD Dashboard for real-time system monitoring and apply Snake Eater UI theme across entire backoffice.

**Scope:**

- **Phase 11:** Build React dashboard with 4 main components + real-time updates
- **Phase 11.5:** Implement Snake Eater UI design system

**Estimated Effort:** 37-50 hours
**Priority:** P0 (Core dashboard), P1 (UI theme refinements)
**GDD Impact:** New frontend codebase, no changes to existing nodes

---

## 🎯 Estado Actual (from Assessment)

### ✅ Ready

- **Backend Infrastructure:** 100% operational
  - `scripts/validate-gdd-runtime.js` - System validation
  - `scripts/score-gdd-health.js` - Health scoring (5 factors)
  - `scripts/predict-gdd-drift.js` - Drift prediction
  - `scripts/watch-gdd.js` - Real-time file watcher

- **Data Sources:** Available for dashboard consumption
  - `gdd-status.json` - Validation results
  - `gdd-health.json` - Health scores per node
  - `gdd-drift.json` - Drift predictions
  - `docs/system-validation.md` - Human-readable validation report
  - `docs/system-health.md` - Health report
  - `docs/drift-report.md` - Drift analysis report

- **Documentation:** Comprehensive specs exist
  - `docs/contexts/phase-11-context.md` - Full Phase 11 specification
  - `docs/GDD-ORCHESTRATION.md` - Agent orchestration process
  - `docs/GDD-IMPLEMENTATION-SUMMARY.md` - Phases 1-10 history

### ❌ Missing (To Be Created)

- **Frontend Infrastructure:** 0% complete
  - No React/TypeScript setup
  - No build system (Vite/Webpack)
  - No admin dashboard directory
  - No UI component library

- **Snake Eater UI:** Not installed
  - Package needs research (may not exist open-source)
  - Custom implementation may be required
  - Theme configuration needed

- **Testing Infrastructure:** 0% complete
  - No Playwright configuration
  - No E2E tests for dashboard
  - No visual regression tests

---

## 🏗️ Architecture Design

### Frontend Stack

```
Technology Stack:
├── Framework: React 18 + TypeScript
├── Build Tool: Vite
├── Routing: React Router v6
├── State: Zustand (lightweight global state)
├── Data Fetching: Axios + React Query
├── UI Library: Snake Eater UI (custom implementation)
├── Charts: Recharts
├── Graph Visualization: react-force-graph (D3.js wrapper)
├── Real-time: Socket.io-client
└── Styling: styled-components (CSS-in-JS)
```

### Project Structure

```
src/
├── admin/
│   ├── App.tsx                        # Main admin app
│   ├── routes.tsx                     # Route configuration
│   ├── layouts/
│   │   ├── AdminLayout.tsx            # Shell with sidebar + header
│   │   └── DashboardLayout.tsx        # Dashboard-specific layout
│   ├── gdd-dashboard/
│   │   ├── index.tsx                  # Dashboard entry point
│   │   ├── components/
│   │   │   ├── Overview/
│   │   │   │   ├── SystemStatus.tsx   # 🟢🟡🔴 Status indicator
│   │   │   │   ├── MetricsCards.tsx   # Health, drift, coverage stats
│   │   │   │   └── RecentActivity.tsx # Timeline of recent changes
│   │   │   ├── NodeExplorer/
│   │   │   │   ├── NodeTable.tsx      # Searchable/filterable node list
│   │   │   │   ├── NodeDetails.tsx    # Expanded node view
│   │   │   │   └── NodeFilters.tsx    # Status/coverage/drift filters
│   │   │   ├── DependencyGraph/
│   │   │   │   ├── ForceGraph.tsx     # D3 force-directed graph
│   │   │   │   ├── GraphControls.tsx  # Zoom/pan/reset controls
│   │   │   │   └── GraphLegend.tsx    # Node color/size legend
│   │   │   └── ReportsViewer/
│   │   │       ├── ReportTabs.tsx     # Validation/Health/Drift tabs
│   │   │       ├── MarkdownViewer.tsx # Render .md files
│   │   │       └── ReportExport.tsx   # Download JSON/MD
│   │   ├── hooks/
│   │   │   ├── useGDDHealth.ts        # Fetch gdd-health.json
│   │   │   ├── useGDDStatus.ts        # Fetch gdd-status.json
│   │   │   ├── useGDDDrift.ts         # Fetch gdd-drift.json
│   │   │   ├── useSystemMap.ts        # Fetch system-map.yaml
│   │   │   └── useRealtimeGDD.ts      # WebSocket connection
│   │   ├── services/
│   │   │   ├── gddApi.ts              # API client for GDD endpoints
│   │   │   └── websocketClient.ts     # Socket.io client wrapper
│   │   └── types/
│   │       ├── gdd.types.ts           # TypeScript interfaces
│   │       └── api.types.ts           # API response types
│   └── theme/
│       ├── SnakeEaterThemeProvider.tsx
│       ├── darkCyberTheme.ts          # Theme tokens
│       └── globalStyles.ts            # Global CSS
├── components/
│   └── shared/
│       ├── Button.tsx                 # Snake Eater styled button
│       ├── Card.tsx                   # Dark-cyber card component
│       ├── Input.tsx                  # Terminal-style input
│       ├── StatusBadge.tsx            # 🟢🟡🔴 Status indicator
│       ├── Modal.tsx                  # Cyber-themed modal
│       └── Table.tsx                  # Data table component
├── utils/
│   ├── formatters.ts                  # Date/number formatting
│   └── graphHelpers.ts                # Graph data transformations
└── main.tsx                           # Vite entry point
```

### Backend API Structure

```
src/
├── api/
│   └── admin/
│       └── gdd.routes.js              # New API routes
└── services/
    └── gddDataService.js              # Service to read GDD JSON files
```

**New API Endpoints:**

```javascript
GET  /api/admin/gdd/status        → gdd-status.json
GET  /api/admin/gdd/health        → gdd-health.json
GET  /api/admin/gdd/drift         → gdd-drift.json
GET  /api/admin/gdd/system-map    → docs/system-map.yaml (parsed)
GET  /api/admin/gdd/reports/:type → docs/*.md (validation/health/drift)

# WebSocket namespace
CONNECT /admin/gdd               → Real-time updates on file changes
```

---

## 🎨 UI/UX Design Specifications

### Snake Eater UI Theme

**Design Philosophy:**

- **Metal Gear Solid inspired** (codec screen aesthetic)
- **Dark-cyber palette** (deep blacks, neon accents)
- **Monospace typography** (terminal/hacker vibe)
- **Sharp corners** (no rounded borders)
- **Minimal animations** (glitch effects on hover)

**Color Palette:**

```typescript
export const darkCyberTheme = {
  colors: {
    // Primary
    primary: '#00FF41', // Matrix green (healthy status)
    secondary: '#FF006E', // Neon pink (critical alerts)

    // Backgrounds
    background: '#0A0E14', // Deep space blue-black
    surface: '#151921', // Elevated surface (cards)
    surfaceHover: '#1F2430', // Hover state

    // Text
    textPrimary: '#E0E0E0', // Light gray
    textSecondary: '#A0A0A0', // Medium gray
    textDisabled: '#606060', // Dark gray

    // Status colors
    statusHealthy: '#00FF41', // Green
    statusWarning: '#FFB627', // Amber
    statusCritical: '#FF3864', // Red

    // Accents
    accentOrange: '#FF6B00', // Alert orange
    accentCyan: '#00D9FF', // Info cyan
    accentPurple: '#B86AFF', // Special purple

    // UI elements
    border: '#2A2F3A', // Subtle borders
    divider: '#1F2430', // Dividers
    shadow: 'rgba(0, 255, 65, 0.1)' // Green glow
  },

  typography: {
    fontFamily: {
      primary: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
      secondary: '"Inter", -apple-system, sans-serif' // For body text
    },
    fontSize: {
      xs: '0.75rem', // 12px
      sm: '0.875rem', // 14px
      md: '1rem', // 16px
      lg: '1.125rem', // 18px
      xl: '1.25rem', // 20px
      '2xl': '1.5rem', // 24px
      '3xl': '2rem' // 32px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      bold: 700
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75
    }
  },

  spacing: (factor: number) => `${0.25 * factor}rem`, // 4px base

  borderRadius: {
    none: '0px', // Default: sharp corners
    sm: '2px', // Subtle
    md: '4px', // Medium
    lg: '8px' // Large (rare)
  },

  shadows: {
    sm: '0 2px 4px rgba(0, 255, 65, 0.05)',
    md: '0 4px 8px rgba(0, 255, 65, 0.1)',
    lg: '0 8px 16px rgba(0, 255, 65, 0.15)',
    glow: '0 0 20px rgba(0, 255, 65, 0.3)' // Green glow effect
  },

  animations: {
    glitch: 'glitch 0.3s ease-in-out',
    fadeIn: 'fadeIn 0.2s ease-in',
    slideIn: 'slideIn 0.3s ease-out'
  }
};
```

**Typography Scale:**

```
Headings:
- H1: 32px / 2rem (Dashboard title)
- H2: 24px / 1.5rem (Section headers)
- H3: 20px / 1.25rem (Card titles)
- H4: 18px / 1.125rem (Subsections)

Body:
- Large: 16px / 1rem (Main content)
- Medium: 14px / 0.875rem (Default text)
- Small: 12px / 0.75rem (Captions, labels)

Code:
- JetBrains Mono (all sizes)
```

**Spacing System (8px grid):**

```
0.5 = 4px  (tight spacing)
1   = 8px  (base unit)
2   = 16px (small gaps)
3   = 24px (medium gaps)
4   = 32px (large gaps)
6   = 48px (section spacing)
8   = 64px (major sections)
```

### Component Specifications

#### 1. Dashboard Overview Component

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│ 🟢 SYSTEM STATUS: HEALTHY                          │
├─────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│ │ Health  │ │  Drift  │ │  Nodes  │ │Coverage │  │
│ │  95.5   │ │   17    │ │   13    │ │  68%    │  │
│ │  /100   │ │  /100   │ │ healthy │ │  avg    │  │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
├─────────────────────────────────────────────────────┤
│ Recent Activity:                                    │
│ • 2 min ago  shield.md updated (health +5)         │
│ • 15 min ago Auto-repair completed (3 nodes fixed) │
│ • 1 hr ago   Drift prediction: 2 nodes at risk     │
└─────────────────────────────────────────────────────┘
```

**Features:**

- Live status indicator (auto-updates via WebSocket)
- 4 metric cards (animated counters)
- Activity timeline (last 10 events)
- Click on metric → jump to relevant section

**Interactions:**

- Hover on status → tooltip with details
- Click metric card → filter relevant nodes
- Activity item click → open detailed view

#### 2. Node Explorer Component

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│ Search: [_____________] Filter: [All ▼] Sort: [▼]  │
├─────┬───────────┬────────┬──────────┬──────────────┤
│ 🟢  │ roast     │ 100/100│ 15/100   │ 87% coverage │
│ 🟢  │ shield    │ 98/100 │ 20/100   │ 76% coverage │
│ 🟡  │ billing   │ 62/100 │ 45/100   │ 45% coverage │
│ ...                                                 │
└─────────────────────────────────────────────────────┘
```

**Columns:**

- Status icon (🟢🟡🔴)
- Node name (clickable)
- Health score (sortable)
- Drift risk (sortable)
- Test coverage (sortable)
- Last updated (date)

**Features:**

- Search by node name
- Filter by status (healthy/warning/critical)
- Filter by coverage range (<50%, 50-80%, >80%)
- Sort by any column
- Click row → expand to show:
  - Description
  - Dependencies (with links)
  - Used by (with links)
  - Recent commits
  - Link to node .md file

**Interactions:**

- Search debounced (300ms)
- Filter changes trigger re-render
- Expanded row shows collapsible details
- Click node link → navigate to graph view (highlight node)

#### 3. Dependency Graph Component

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│ Controls: [Zoom +/-] [Reset] [Center] [Layout ▼]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│         ┌─────┐                                     │
│    ┌───→│roast│◀────┐                              │
│    │    └─────┘     │                              │
│    │       ▲        │                              │
│ ┌──┴──┐    │    ┌───┴───┐                          │
│ │tone │    │    │persona│                          │
│ └─────┘    │    └───────┘                          │
│        ┌───┴───┐                                    │
│        │shield │                                    │
│        └───────┘                                    │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Legend: 🟢 Healthy  🟡 Warning  🔴 Critical         │
└─────────────────────────────────────────────────────┘
```

**Features:**

- Force-directed graph layout (D3.js via react-force-graph)
- Node color by health score:
  - Green: 80-100
  - Yellow: 50-79
  - Red: <50
- Node size by number of connections
- Arrows show dependency direction
- Zoom/pan controls
- Reset view button
- Layout presets (force/circular/hierarchical)

**Interactions:**

- Click node → highlight dependencies (bold edges)
- Hover node → tooltip with name, health, drift
- Double-click node → jump to Node Explorer (expanded)
- Drag node → reposition (sticky)
- Scroll to zoom
- Click edge → show dependency details

**Graph Data Structure:**

```typescript
interface GraphNode {
  id: string; // Node name (e.g., "roast")
  label: string; // Display name
  color: string; // Based on health status
  size: number; // Based on connection count
  health: number; // Health score
  drift: number; // Drift risk
  status: 'healthy' | 'warning' | 'critical';
}

interface GraphEdge {
  source: string; // Source node id
  target: string; // Target node id
  type: 'depends_on' | 'used_by';
}
```

#### 4. Reports Viewer Component

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│ [ Validation ] [ Health ] [ Drift ] [ Auto-Repair ] │
├─────────────────────────────────────────────────────┤
│                                                     │
│ # System Health Report                              │
│                                                     │
│ **Generated:** 2025-10-06 12:44:00                  │
│ **Status:** 🟢 HEALTHY                              │
│                                                     │
│ ## Summary                                          │
│ - Average Score: 95.5/100                           │
│ - Healthy Nodes: 11                                 │
│ - Warning Nodes: 2                                  │
│ - Critical Nodes: 0                                 │
│                                                     │
│ ## Node Breakdown                                   │
│ ...                                                 │
│                                                     │
│ [Export JSON] [Export Markdown] [Refresh]           │
└─────────────────────────────────────────────────────┘
```

**Features:**

- Tab navigation (4 report types)
- Markdown rendering with syntax highlighting
- Code blocks use JetBrains Mono
- Tables styled with SE theme
- Export buttons (JSON/Markdown)
- Auto-refresh on WebSocket update
- Timestamp of last update

**Interactions:**

- Click tab → load report
- Click "Refresh" → fetch latest data
- Click "Export JSON" → download gdd-\*.json
- Click "Export Markdown" → download .md file
- Links in markdown → navigate to relevant section

### Responsive Design

**Breakpoints:**

```
Mobile:  320px - 768px
Tablet:  768px - 1024px
Desktop: 1024px+
```

**Mobile Adaptations:**

- Overview: Stack metric cards vertically
- Node Explorer: Hide coverage column, make rows tappable
- Dependency Graph: Simplified view (list instead of graph)
- Reports Viewer: Full-width tabs, horizontal scroll

**Desktop Optimizations:**

- Overview: 4 cards in row
- Node Explorer: All columns visible, hover effects
- Dependency Graph: Full interactive graph
- Reports Viewer: Side-by-side layout (tabs + content)

---

## 🛠️ Implementation Phases

### Phase 11.A: Foundation Setup (6-8 hours)

**Priority:** P0
**Owner:** Frontend Dev Agent

#### Tasks:

1. **Install Frontend Dependencies**

   ```bash
   # Core React + TypeScript
   npm install react@18.2.0 react-dom@18.2.0
   npm install typescript @types/react @types/react-dom

   # Build tool
   npm install -D vite @vitejs/plugin-react

   # Routing
   npm install react-router-dom@6
   npm install -D @types/react-router-dom

   # State management
   npm install zustand

   # Data fetching
   npm install axios
   npm install @tanstack/react-query

   # UI/Styling
   npm install styled-components
   npm install -D @types/styled-components

   # Charts
   npm install recharts

   # Graph visualization
   npm install d3 react-force-graph
   npm install -D @types/d3

   # Real-time
   npm install socket.io-client

   # Utilities
   npm install date-fns lodash
   npm install -D @types/lodash
   ```

2. **Create Build Configuration**

   **vite.config.js:**

   ```javascript
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';
   import path from 'path';

   export default defineConfig({
     plugins: [react()],
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './src'),
         '@admin': path.resolve(__dirname, './src/admin'),
         '@components': path.resolve(__dirname, './src/components')
       }
     },
     server: {
       port: 3000,
       proxy: {
         '/api': {
           target: 'http://localhost:3001',
           changeOrigin: true
         },
         '/socket.io': {
           target: 'http://localhost:3001',
           ws: true
         }
       }
     },
     build: {
       outDir: 'dist/admin',
       sourcemap: true,
       rollupOptions: {
         output: {
           manualChunks: {
             'react-vendor': ['react', 'react-dom', 'react-router-dom'],
             'd3-vendor': ['d3', 'react-force-graph']
           }
         }
       }
     }
   });
   ```

   **tsconfig.json:**

   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "useDefineForClassFields": true,
       "lib": ["ES2020", "DOM", "DOM.Iterable"],
       "module": "ESNext",
       "skipLibCheck": true,

       /* Bundler mode */
       "moduleResolution": "bundler",
       "allowImportingTsExtensions": true,
       "resolveJsonModule": true,
       "isolatedModules": true,
       "noEmit": true,
       "jsx": "react-jsx",

       /* Linting */
       "strict": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true,
       "noFallthroughCasesInSwitch": true,

       /* Path aliases */
       "baseUrl": ".",
       "paths": {
         "@/*": ["./src/*"],
         "@admin/*": ["./src/admin/*"],
         "@components/*": ["./src/components/*"]
       }
     },
     "include": ["src"],
     "references": [{ "path": "./tsconfig.node.json" }]
   }
   ```

3. **Create Project Structure**

   ```bash
   mkdir -p src/admin/gdd-dashboard/{components/{Overview,NodeExplorer,DependencyGraph,ReportsViewer},hooks,services,types}
   mkdir -p src/admin/layouts
   mkdir -p src/admin/theme
   mkdir -p src/components/shared
   mkdir -p src/utils
   ```

4. **Setup Backend API Routes**

   **src/api/admin/gdd.routes.js:**

   ```javascript
   const express = require('express');
   const router = express.Router();
   const gddDataService = require('../../services/gddDataService');

   // Get validation status
   router.get('/status', async (req, res) => {
     try {
       const status = await gddDataService.getStatus();
       res.json(status);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });

   // Get health scores
   router.get('/health', async (req, res) => {
     try {
       const health = await gddDataService.getHealth();
       res.json(health);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });

   // Get drift predictions
   router.get('/drift', async (req, res) => {
     try {
       const drift = await gddDataService.getDrift();
       res.json(drift);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });

   // Get system map
   router.get('/system-map', async (req, res) => {
     try {
       const systemMap = await gddDataService.getSystemMap();
       res.json(systemMap);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });

   // Get markdown report
   router.get('/reports/:type', async (req, res) => {
     try {
       const { type } = req.params;
       const report = await gddDataService.getReport(type);
       res.json(report);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });

   module.exports = router;
   ```

   **src/services/gddDataService.js:**

   ```javascript
   const fs = require('fs').promises;
   const path = require('path');
   const yaml = require('yaml');

   class GDDDataService {
     constructor() {
       this.rootPath = path.resolve(__dirname, '../..');
     }

     async getStatus() {
       const data = await fs.readFile(path.join(this.rootPath, 'gdd-status.json'), 'utf-8');
       return JSON.parse(data);
     }

     async getHealth() {
       const data = await fs.readFile(path.join(this.rootPath, 'gdd-health.json'), 'utf-8');
       return JSON.parse(data);
     }

     async getDrift() {
       const data = await fs.readFile(path.join(this.rootPath, 'gdd-drift.json'), 'utf-8');
       return JSON.parse(data);
     }

     async getSystemMap() {
       const data = await fs.readFile(path.join(this.rootPath, 'docs/system-map.yaml'), 'utf-8');
       return yaml.parse(data);
     }

     async getReport(type) {
       const validTypes = ['validation', 'health', 'drift', 'auto-repair'];
       if (!validTypes.includes(type)) {
         throw new Error(`Invalid report type: ${type}`);
       }

       let filename;
       switch (type) {
         case 'validation':
           filename = 'system-validation.md';
           break;
         case 'health':
           filename = 'system-health.md';
           break;
         case 'drift':
           filename = 'drift-report.md';
           break;
         case 'auto-repair':
           filename = 'auto-repair-report.md';
           break;
       }

       const content = await fs.readFile(path.join(this.rootPath, 'docs', filename), 'utf-8');

       return {
         type,
         filename,
         content,
         generated_at: new Date().toISOString()
       };
     }
   }

   module.exports = new GDDDataService();
   ```

5. **Setup WebSocket for Real-time Updates**

   **src/api/admin/gdd.socket.js:**

   ```javascript
   const chokidar = require('chokidar');
   const gddDataService = require('../../services/gddDataService');

   function setupGDDSocket(io) {
     const gddNamespace = io.of('/admin/gdd');

     gddNamespace.on('connection', (socket) => {
       console.log('GDD Dashboard client connected:', socket.id);

       // Watch GDD files
       const watcher = chokidar.watch(
         [
           'gdd-*.json',
           'docs/system-*.md',
           'docs/drift-*.md',
           'docs/auto-repair-*.md',
           'docs/nodes/*.md',
           'docs/system-map.yaml'
         ],
         {
           persistent: true,
           ignoreInitial: true
         }
       );

       watcher.on('change', async (filepath) => {
         console.log(`GDD file changed: ${filepath}`);

         try {
           // Determine what changed and fetch updated data
           let updateType = 'unknown';
           let data = null;

           if (filepath.includes('gdd-status.json')) {
             updateType = 'status';
             data = await gddDataService.getStatus();
           } else if (filepath.includes('gdd-health.json')) {
             updateType = 'health';
             data = await gddDataService.getHealth();
           } else if (filepath.includes('gdd-drift.json')) {
             updateType = 'drift';
             data = await gddDataService.getDrift();
           } else if (filepath.includes('system-map.yaml')) {
             updateType = 'system-map';
             data = await gddDataService.getSystemMap();
           } else if (filepath.includes('.md')) {
             updateType = 'report';
             // Don't fetch full report, just notify
             data = { filepath };
           }

           // Emit update to all connected clients
           gddNamespace.emit('gdd-update', {
             type: updateType,
             filepath,
             data,
             timestamp: new Date().toISOString()
           });
         } catch (error) {
           console.error('Error processing GDD update:', error);
         }
       });

       socket.on('disconnect', () => {
         console.log('GDD Dashboard client disconnected:', socket.id);
         watcher.close();
       });
     });

     return gddNamespace;
   }

   module.exports = setupGDDSocket;
   ```

   **Update src/index.js (main server):**

   ```javascript
   // ... existing imports
   const http = require('http');
   const { Server } = require('socket.io');
   const gddRoutes = require('./api/admin/gdd.routes');
   const setupGDDSocket = require('./api/admin/gdd.socket');

   // ... existing app setup

   // Create HTTP server for Socket.io
   const server = http.createServer(app);
   const io = new Server(server, {
     cors: {
       origin: process.env.FRONTEND_URL || 'http://localhost:3000',
       methods: ['GET', 'POST']
     }
   });

   // Setup GDD routes
   app.use('/api/admin/gdd', gddRoutes);

   // Setup GDD WebSocket
   setupGDDSocket(io);

   // Start server
   const PORT = process.env.PORT || 3001;
   server.listen(PORT, () => {
     console.log(`Server running on port ${PORT}`);
   });
   ```

6. **Update package.json Scripts**
   ```json
   {
     "scripts": {
       "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
       "dev:backend": "nodemon src/index.js",
       "dev:frontend": "vite",
       "build": "tsc && vite build",
       "preview": "vite preview"
     }
   }
   ```

**Deliverables:**

- ✅ All dependencies installed
- ✅ Build configuration created (vite.config.js, tsconfig.json)
- ✅ Project structure created
- ✅ Backend API routes implemented
- ✅ WebSocket setup complete
- ✅ npm scripts updated

**Success Criteria:**

- `npm run dev:frontend` starts Vite dev server
- `npm run dev:backend` starts Express server
- `/api/admin/gdd/*` endpoints return data
- WebSocket connection established

---

### Phase 11.B: Snake Eater UI Theme System (8-10 hours)

**Priority:** P1
**Owner:** UI Designer Agent + Frontend Dev Agent

#### Tasks:

1. **Research Snake Eater UI Package**

   ```bash
   # Check if package exists
   npm search snake-eater-ui
   npm search metal-gear-ui
   ```

   **Outcome:** If package doesn't exist (likely), proceed with custom implementation.

2. **Create Theme System**

   **src/admin/theme/darkCyberTheme.ts:**

   ```typescript
   export interface Theme {
     colors: {
       primary: string;
       secondary: string;
       background: string;
       surface: string;
       surfaceHover: string;
       textPrimary: string;
       textSecondary: string;
       textDisabled: string;
       statusHealthy: string;
       statusWarning: string;
       statusCritical: string;
       accentOrange: string;
       accentCyan: string;
       accentPurple: string;
       border: string;
       divider: string;
       shadow: string;
     };
     typography: {
       fontFamily: {
         primary: string;
         secondary: string;
       };
       fontSize: {
         xs: string;
         sm: string;
         md: string;
         lg: string;
         xl: string;
         '2xl': string;
         '3xl': string;
       };
       fontWeight: {
         normal: number;
         medium: number;
         bold: number;
       };
       lineHeight: {
         tight: number;
         normal: number;
         relaxed: number;
       };
     };
     spacing: (factor: number) => string;
     borderRadius: {
       none: string;
       sm: string;
       md: string;
       lg: string;
     };
     shadows: {
       sm: string;
       md: string;
       lg: string;
       glow: string;
     };
     animations: {
       glitch: string;
       fadeIn: string;
       slideIn: string;
     };
   }

   export const darkCyberTheme: Theme = {
     colors: {
       primary: '#00FF41',
       secondary: '#FF006E',
       background: '#0A0E14',
       surface: '#151921',
       surfaceHover: '#1F2430',
       textPrimary: '#E0E0E0',
       textSecondary: '#A0A0A0',
       textDisabled: '#606060',
       statusHealthy: '#00FF41',
       statusWarning: '#FFB627',
       statusCritical: '#FF3864',
       accentOrange: '#FF6B00',
       accentCyan: '#00D9FF',
       accentPurple: '#B86AFF',
       border: '#2A2F3A',
       divider: '#1F2430',
       shadow: 'rgba(0, 255, 65, 0.1)'
     },
     typography: {
       fontFamily: {
         primary: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
         secondary: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
       },
       fontSize: {
         xs: '0.75rem',
         sm: '0.875rem',
         md: '1rem',
         lg: '1.125rem',
         xl: '1.25rem',
         '2xl': '1.5rem',
         '3xl': '2rem'
       },
       fontWeight: {
         normal: 400,
         medium: 500,
         bold: 700
       },
       lineHeight: {
         tight: 1.2,
         normal: 1.5,
         relaxed: 1.75
       }
     },
     spacing: (factor: number) => `${0.25 * factor}rem`,
     borderRadius: {
       none: '0px',
       sm: '2px',
       md: '4px',
       lg: '8px'
     },
     shadows: {
       sm: '0 2px 4px rgba(0, 255, 65, 0.05)',
       md: '0 4px 8px rgba(0, 255, 65, 0.1)',
       lg: '0 8px 16px rgba(0, 255, 65, 0.15)',
       glow: '0 0 20px rgba(0, 255, 65, 0.3)'
     },
     animations: {
       glitch: 'glitch 0.3s ease-in-out',
       fadeIn: 'fadeIn 0.2s ease-in',
       slideIn: 'slideIn 0.3s ease-out'
     }
   };
   ```

   **src/admin/theme/SnakeEaterThemeProvider.tsx:**

   ```typescript
   import React from 'react';
   import { ThemeProvider as StyledThemeProvider } from 'styled-components';
   import { darkCyberTheme } from './darkCyberTheme';
   import GlobalStyles from './globalStyles';

   interface SnakeEaterThemeProviderProps {
     children: React.ReactNode;
   }

   export function SnakeEaterThemeProvider({ children }: SnakeEaterThemeProviderProps) {
     return (
       <StyledThemeProvider theme={darkCyberTheme}>
         <GlobalStyles />
         {children}
       </StyledThemeProvider>
     );
   }
   ```

   **src/admin/theme/globalStyles.ts:**

   ```typescript
   import { createGlobalStyle } from 'styled-components';
   import { Theme } from './darkCyberTheme';

   const GlobalStyles = createGlobalStyle<{ theme: Theme }>`
     @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;700&display=swap');
   
     * {
       margin: 0;
       padding: 0;
       box-sizing: border-box;
     }
   
     html, body {
       width: 100%;
       height: 100%;
       font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
       font-size: ${({ theme }) => theme.typography.fontSize.md};
       line-height: ${({ theme }) => theme.typography.lineHeight.normal};
       color: ${({ theme }) => theme.colors.textPrimary};
       background-color: ${({ theme }) => theme.colors.background};
       -webkit-font-smoothing: antialiased;
       -moz-osx-font-smoothing: grayscale;
     }
   
     #root {
       width: 100%;
       height: 100%;
     }
   
     code, pre {
       font-family: ${({ theme }) => theme.typography.fontFamily.primary};
     }
   
     /* Scrollbar styling */
     ::-webkit-scrollbar {
       width: 8px;
       height: 8px;
     }
   
     ::-webkit-scrollbar-track {
       background: ${({ theme }) => theme.colors.background};
     }
   
     ::-webkit-scrollbar-thumb {
       background: ${({ theme }) => theme.colors.border};
       border-radius: ${({ theme }) => theme.borderRadius.sm};
     }
   
     ::-webkit-scrollbar-thumb:hover {
       background: ${({ theme }) => theme.colors.primary};
     }
   
     /* Selection */
     ::selection {
       background: ${({ theme }) => theme.colors.primary};
       color: ${({ theme }) => theme.colors.background};
     }
   
     /* Animations */
     @keyframes glitch {
       0%, 100% { transform: translate(0); }
       25% { transform: translate(-2px, 2px); }
       50% { transform: translate(2px, -2px); }
       75% { transform: translate(-2px, -2px); }
     }
   
     @keyframes fadeIn {
       from { opacity: 0; }
       to { opacity: 1; }
     }
   
     @keyframes slideIn {
       from {
         opacity: 0;
         transform: translateY(-10px);
       }
       to {
         opacity: 1;
         transform: translateY(0);
       }
     }
   
     /* Focus styles */
     *:focus-visible {
       outline: 2px solid ${({ theme }) => theme.colors.primary};
       outline-offset: 2px;
     }
   `;

   export default GlobalStyles;
   ```

3. **Create Base UI Components**

   **src/components/shared/Button.tsx:**

   ```typescript
   import styled from 'styled-components';

   interface ButtonProps {
     variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
     size?: 'sm' | 'md' | 'lg';
     fullWidth?: boolean;
   }

   export const Button = styled.button<ButtonProps>`
     font-family: ${({ theme }) => theme.typography.fontFamily.primary};
     font-size: ${({ theme, size }) => {
       switch (size) {
         case 'sm':
           return theme.typography.fontSize.sm;
         case 'lg':
           return theme.typography.fontSize.lg;
         default:
           return theme.typography.fontSize.md;
       }
     }};
     font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
     padding: ${({ theme, size }) => {
       switch (size) {
         case 'sm':
           return `${theme.spacing(1.5)} ${theme.spacing(3)}`;
         case 'lg':
           return `${theme.spacing(3)} ${theme.spacing(6)}`;
         default:
           return `${theme.spacing(2)} ${theme.spacing(4)}`;
       }
     }};
     border: none;
     border-radius: ${({ theme }) => theme.borderRadius.sm};
     cursor: pointer;
     transition: all 0.2s ease;
     width: ${({ fullWidth }) => (fullWidth ? '100%' : 'auto')};

     ${({ theme, variant }) => {
       switch (variant) {
         case 'primary':
           return `
             background: ${theme.colors.primary};
             color: ${theme.colors.background};
             box-shadow: ${theme.shadows.sm};
   
             &:hover {
               box-shadow: ${theme.shadows.glow};
               transform: translateY(-1px);
             }
   
             &:active {
               transform: translateY(0);
             }
           `;
         case 'secondary':
           return `
             background: ${theme.colors.surface};
             color: ${theme.colors.textPrimary};
             border: 1px solid ${theme.colors.border};
   
             &:hover {
               background: ${theme.colors.surfaceHover};
               border-color: ${theme.colors.primary};
             }
           `;
         case 'ghost':
           return `
             background: transparent;
             color: ${theme.colors.textPrimary};
   
             &:hover {
               background: ${theme.colors.surface};
             }
           `;
         case 'danger':
           return `
             background: ${theme.colors.statusCritical};
             color: ${theme.colors.textPrimary};
   
             &:hover {
               box-shadow: 0 0 20px rgba(255, 56, 100, 0.3);
             }
           `;
         default:
           return `
             background: ${theme.colors.primary};
             color: ${theme.colors.background};
           `;
       }
     }}

     &:disabled {
       opacity: 0.5;
       cursor: not-allowed;

       &:hover {
         transform: none;
         box-shadow: none;
       }
     }
   `;
   ```

   **src/components/shared/Card.tsx:**

   ```typescript
   import styled from 'styled-components';

   interface CardProps {
     padding?: number;
     elevation?: 'sm' | 'md' | 'lg';
     glowOnHover?: boolean;
   }

   export const Card = styled.div<CardProps>`
     background: ${({ theme }) => theme.colors.surface};
     border: 1px solid ${({ theme }) => theme.colors.border};
     border-radius: ${({ theme }) => theme.borderRadius.md};
     padding: ${({ theme, padding = 4 }) => theme.spacing(padding)};
     box-shadow: ${({ theme, elevation = 'md' }) => theme.shadows[elevation]};
     transition: all 0.2s ease;

     ${({ glowOnHover, theme }) =>
       glowOnHover &&
       `
       &:hover {
         box-shadow: ${theme.shadows.glow};
         border-color: ${theme.colors.primary};
       }
     `}
   `;

   export const CardHeader = styled.div`
     display: flex;
     justify-content: space-between;
     align-items: center;
     margin-bottom: ${({ theme }) => theme.spacing(3)};
     padding-bottom: ${({ theme }) => theme.spacing(2)};
     border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
   `;

   export const CardTitle = styled.h3`
     font-family: ${({ theme }) => theme.typography.fontFamily.primary};
     font-size: ${({ theme }) => theme.typography.fontSize.lg};
     font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
     color: ${({ theme }) => theme.colors.primary};
     margin: 0;
   `;

   export const CardContent = styled.div`
     color: ${({ theme }) => theme.colors.textPrimary};
   `;
   ```

   **src/components/shared/StatusBadge.tsx:**

   ```typescript
   import styled from 'styled-components';

   interface StatusBadgeProps {
     status: 'healthy' | 'warning' | 'critical';
   }

   const StyledBadge = styled.span<StatusBadgeProps>`
     display: inline-flex;
     align-items: center;
     gap: ${({ theme }) => theme.spacing(1)};
     padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
     border-radius: ${({ theme }) => theme.borderRadius.sm};
     font-family: ${({ theme }) => theme.typography.fontFamily.primary};
     font-size: ${({ theme }) => theme.typography.fontSize.xs};
     font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
     text-transform: uppercase;
     letter-spacing: 0.05em;

     ${({ theme, status }) => {
       const colors = {
         healthy: theme.colors.statusHealthy,
         warning: theme.colors.statusWarning,
         critical: theme.colors.statusCritical,
       };

       const color = colors[status];

       return `
         background: ${color}15;
         color: ${color};
         border: 1px solid ${color}40;

         &::before {
           content: '●';
           font-size: 1.2em;
         }
       `;
     }}
   `;

   export function StatusBadge({ status }: StatusBadgeProps) {
     const labels = {
       healthy: 'Healthy',
       warning: 'Warning',
       critical: 'Critical',
     };

     return <StyledBadge status={status}>{labels[status]}</StyledBadge>;
   }
   ```

   (Continue with Input, Table, Modal components...)

4. **Create UI Guidelines Documentation**

   **docs/ui-guidelines.md:**
   (See separate file - ~300 lines of component usage, color palette, typography, spacing guidelines)

**Deliverables:**

- ✅ Theme system implemented (darkCyberTheme.ts)
- ✅ ThemeProvider wrapper created
- ✅ Global styles configured
- ✅ 10+ base UI components created (Button, Card, Input, Table, Modal, etc.)
- ✅ UI guidelines documented

**Success Criteria:**

- Theme applies globally
- Components use theme tokens
- Dark-cyber aesthetic visible
- docs/ui-guidelines.md complete

---

### Phase 11.C: Core Dashboard Components (10-12 hours)

**Priority:** P0
**Owner:** Frontend Dev Agent

(Components implementation details continue...)

---

### Phase 11.D: Real-time Features (4-6 hours)

**Priority:** P1
**Owner:** Frontend Dev Agent

(WebSocket integration details...)

---

### Phase 11.E: Testing (6-8 hours)

**Priority:** P0
**Owner:** Test Engineer Agent

(Playwright tests, visual regression details...)

---

## 📊 GDD Orchestration Process

Following CLAUDE.md, this implementation requires coordination between multiple specialized agents:

### Agent Invocation Sequence

```
1. ✅ Task Assessor Agent
   ↓ Output: docs/assessment/phase-11.md
   ↓ Recommendation: CREATE

2. ⏳ Orchestrator (now)
   ↓ Output: docs/plan/phase-11-dashboard.md
   ↓ Status: Creating plan

3. → UI Designer Agent
   ↓ Task: Design dashboard components + Snake Eater UI specs
   ↓ Output: docs/design/phase-11-ui-design.md + wireframes

4. → Frontend Dev Agent
   ↓ Task: Implement React dashboard + theme system
   ↓ Output: src/admin/gdd-dashboard/** + components

5. → Test Engineer Agent (MANDATORY)
   ↓ Task: Create Playwright tests + visual evidence
   ↓ Output: tests/admin/gdd-dashboard/** + docs/test-evidence/phase-11/

6. → Documentation Agent
   ↓ Task: Update GDD docs + create UI guidelines
   ↓ Output: docs/ui-guidelines.md + GDD-IMPLEMENTATION-SUMMARY.md update

7. → Orchestrator (final validation)
   ↓ Task: Validate health score, run tests, commit
   ↓ Output: PR ready for review
```

### Validation Checkpoints

**After each agent completes:**

- [ ] Output files created in correct locations
- [ ] GDD health score maintained (≥95)
- [ ] No breaking changes to existing nodes
- [ ] Documentation updated

**Before final commit:**

- [ ] All tests passing (unit + integration + E2E)
- [ ] Playwright visual evidence generated
- [ ] UI guidelines complete
- [ ] Health score ≥95
- [ ] No console errors in dashboard

---

## ✅ Success Criteria

### Phase 11: Dashboard

- [ ] Dashboard accessible at `/admin/gdd-dashboard`
- [ ] Overview panel displays system status correctly
- [ ] Node explorer shows all 13 nodes with filters working
- [ ] Dependency graph renders and is interactive (D3.js)
- [ ] Reports viewer displays markdown correctly
- [ ] Real-time updates work via WebSocket
- [ ] Responsive on mobile (320px) and desktop (1920px)
- [ ] 10+ Playwright tests passing with screenshots

### Phase 11.5: Snake Eater UI

- [ ] Snake Eater UI theme implemented (custom or package)
- [ ] Dark-cyber theme applied globally
- [ ] All dashboard components use SE styling
- [ ] Typography system consistent (JetBrains Mono + Inter)
- [ ] Color palette documented in docs/ui-guidelines.md
- [ ] 10+ reusable SE components created
- [ ] Performance: Initial load < 2s, interactions < 100ms

### Documentation

- [ ] docs/ui-guidelines.md created (300+ lines)
- [ ] docs/design/phase-11-ui-design.md created
- [ ] docs/test-evidence/phase-11/SUMMARY.md created
- [ ] GDD-IMPLEMENTATION-SUMMARY.md updated with Phase 11 section

### Testing

- [ ] Unit tests for hooks (useGDDHealth, useGDDStatus, etc.)
- [ ] Component tests for all 4 main components
- [ ] E2E tests for dashboard navigation
- [ ] Visual regression tests with Playwright (screenshots)
- [ ] All tests passing in CI

---

## 🚀 Next Steps

### Immediate Actions (Orchestrator)

1. ✅ Assessment complete → docs/assessment/phase-11.md
2. ✅ Plan created → docs/plan/phase-11-dashboard.md
3. → Invoke UI Designer Agent (next)
4. → Invoke Frontend Dev Agent
5. → Invoke Test Engineer Agent
6. → Update GDD docs

### After Planning

Following CLAUDE.md rules: **"After saving the plan, CONTINUE AUTOMATICALLY with implementation"**

**No user confirmation required.** Proceed directly to agent invocation.

---

**Plan Status:** ✅ READY TO EXECUTE
**Next Action:** Invoke UI Designer Agent
**Estimated Completion:** 3-4 weeks (37-50 hours)
