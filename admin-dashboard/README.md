# Roastr AI - Admin Dashboard

## GDD System Monitoring & Administration

Snake Eater UI themed admin panel for Graph-Driven Development monitoring.

---

## 🚀 Quick Start

### Install Dependencies

```bash
cd admin-dashboard
npm install
```

### Run Development Server

```bash
npm run dev
```

Dashboard will be available at: [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm run preview  # Preview production build
```

---

## 📁 Project Structure

```text
admin-dashboard/
├── src/
│   ├── pages/
│   │   └── GDDDashboard/        # Main dashboard page
│   ├── components/
│   │   ├── shared/              # Reusable UI components
│   │   └── dashboard/           # Dashboard-specific components
│   ├── theme/
│   │   ├── darkCyberTheme.ts    # Snake Eater UI color palette
│   │   ├── globalStyles.ts      # Global CSS
│   │   └── SnakeEaterThemeProvider.tsx
│   ├── hooks/                   # Custom React hooks
│   ├── services/                # API clients
│   ├── types/                   # TypeScript types
│   ├── utils/                   # Utility functions
│   ├── App.tsx                  # Main App component
│   └── main.tsx                 # Entry point
├── public/                      # Static assets
├── package.json
├── vite.config.ts               # Vite configuration
└── tsconfig.json                # TypeScript configuration
```

---

## 🎨 Snake Eater UI Theme

**Design Philosophy:**

- Metal Gear Solid codec screen inspired
- Dark-cyber aesthetic
- Terminal/hacker vibe

**Color Palette:**

- **Primary:** `#00FF41` (Neon green)
- **Background:** `#0A0E14` (Deep space blue-black)
- **Surface:** `#151921` (Elevated surface)
- **Text Primary:** `#E5E9F0` (Light gray)

**Typography:**

- **Monospace:** JetBrains Mono, Fira Code
- **Sans-serif:** Inter

**Accessibility:**

- WCAG AA compliant contrast ratios
- Full keyboard navigation
- Screen reader support

---

## 🧩 Dashboard Components (Phase 11)

### 1. Overview Panel

- System status indicator (🟢 Healthy / 🟡 Warning / 🔴 Critical)
- 4 metric cards (Health avg, Drift risk, Total nodes, Coverage avg)
- Recent activity timeline

### 2. Node Explorer

- Searchable table of all GDD nodes
- Filter by status, coverage, drift risk
- Sortable columns
- Expandable rows with node details

### 3. Dependency Graph

- D3.js force-directed graph
- Interactive zoom/pan
- Node color by health status
- Click to highlight dependencies

### 4. Reports Viewer

- Tabs: Validation, Health, Drift, Auto-Repair
- Markdown rendering with syntax highlighting
- Export buttons (JSON, Markdown)

---

## 🔌 Backend API

**Expected API endpoints** (to be implemented in main backend):

```text
GET  /api/admin/gdd/health        # Health scores per node
GET  /api/admin/gdd/status        # Validation status
GET  /api/admin/gdd/drift         # Drift predictions
GET  /api/admin/gdd/system-map    # Dependency graph
GET  /api/admin/gdd/reports/:type # Markdown reports
```

**WebSocket namespace:**

```text
/admin/gdd  # Real-time updates
```

---

## 🛠️ Tech Stack

- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Routing:** React Router v6
- **State Management:** Zustand + React Query
- **Styling:** styled-components
- **Data Visualization:** D3.js + react-force-graph
- **Real-time:** Socket.IO client
- **Markdown:** react-markdown + remark-gfm
- **Syntax Highlighting:** react-syntax-highlighter

---

## 📦 NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 3000) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

---

## 🧪 Testing

(Phase 11.E - To be implemented by Test Engineer Agent)

```bash
npm run test          # Run unit tests (Jest)
npm run test:e2e      # Run E2E tests (Playwright)
npm run test:coverage # Generate coverage report
```

---

## 🚢 Deployment

**Recommended deployment:**

- **URL:** `https://admin.roastr.ai`
- **Platform:** Vercel or Netlify
- **Environment Variables:**
  - `VITE_API_URL` - Backend API URL
  - `VITE_WS_URL` - WebSocket URL

**Build command:** `npm run build`

**Output directory:** `dist/`

---

## 🔐 Security

- Admin panel is **separate** from client app (`/frontend/`)
- Requires authentication (to be implemented)
- HTTPS only in production
- CORS configured for admin subdomain

---

## 📝 Documentation

- **Design Spec:** `docs/ui/design/phase-11-dashboard/ui-spec.md`
- **Implementation Plan:** `docs/plan/phase-11-dashboard.md`
- **UI Review:** `docs/ui-review.md`

---

## 🎯 Current Status

**Phase 11.A:** ✅ Foundation Complete

- Vite + React 18 + TypeScript configured
- Snake Eater UI theme system implemented
- Main dashboard page with placeholders

**Phase 11.B:** 🚧 In Progress

- Implementing shared UI components
- Creating dashboard components

**Phase 11.C:** ⏳ Pending

- Backend API integration
- Real-time WebSocket updates

---

## 📞 Support

For issues or questions, see:

- **Planning:** `docs/plan/phase-11-dashboard.md`
- **Design:** `docs/ui/design/phase-11-dashboard/ui-spec.md`
- **GDD Docs:** `docs/GDD-IMPLEMENTATION-SUMMARY.md`

---

**Version:** 1.0.0

**Last Updated:** 2025-10-06

**Status:** Foundation Ready ✅
