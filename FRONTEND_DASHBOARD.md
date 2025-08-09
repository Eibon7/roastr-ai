# Frontend Dashboard - Guía Técnica

## Descripción General

El dashboard frontend de Roastr.ai es una aplicación React moderna con diseño **mock-first**, construida para funcionar independientemente de servicios externos. Utiliza shadcn/ui para componentes consistentes y Tailwind CSS para estilos responsivos.

## Arquitectura del Sistema

### 🏗️ Estructura de Componentes

```
frontend/src/
├── components/
│   ├── AppShell.jsx          # Layout principal con sidebar y topbar
│   ├── TopBar.jsx            # Barra superior con user info y estados
│   ├── Sidebar.jsx           # Navegación lateral
│   ├── ui/                   # Componentes base de shadcn/ui
│   │   ├── card.jsx
│   │   ├── badge.jsx
│   │   ├── button.jsx
│   │   ├── skeleton.jsx
│   │   ├── input.jsx
│   │   └── select.jsx
│   └── widgets/              # Widgets del dashboard
│       ├── PlanStatusCard.jsx
│       ├── IntegrationsCard.jsx
│       ├── HealthFlagsCard.jsx
│       ├── ActivityFeedCard.jsx
│       ├── JobsQueueCard.jsx
│       ├── UsageCostCard.jsx
│       ├── LogsTableCard.jsx
│       └── index.js          # Registry de widgets
├── pages/                    # Páginas principales
│   ├── Dashboard.jsx         # Dashboard con widgets
│   ├── Compose.jsx           # Composición de roasts
│   ├── Integrations.jsx     # Gestión de plataformas
│   ├── Billing.jsx          # Facturación y planes
│   ├── Settings.jsx         # Configuración de usuario
│   └── Logs.jsx             # Visualización de logs
└── lib/
    └── utils.js             # Utilidades de Tailwind
```

### 🎛️ Sistema de Widgets

Los widgets siguen un patrón consistente:

```javascript
// Ejemplo: PlanStatusCard.jsx
export default function PlanStatusCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch data from API
    // 2. Handle loading states
    // 3. Error handling
  }, []);

  if (loading) {
    return <SkeletonLoader />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Widget Title</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Widget content */}
      </CardContent>
    </Card>
  );
}
```

**Características de los Widgets:**
- ✅ **Estados de carga** con skeleton loaders
- ✅ **Estados vacíos** informativos
- ✅ **Manejo de errores** graceful
- ✅ **Actualización automática** (algunos widgets)
- ✅ **Diseño responsivo**

### 📊 Widgets Disponibles

| Widget | Descripción | Grid | Auto-refresh |
|--------|-------------|------|--------------|
| **PlanStatusCard** | Estado del plan y límites de uso | 1 col | ❌ |
| **IntegrationsCard** | Plataformas conectadas/disponibles | 1 col | ❌ |
| **HealthFlagsCard** | Salud del sistema y feature flags | 1 col | ✅ 30s |
| **ActivityFeedCard** | Actividad reciente del sistema | 2 col | ❌ |
| **JobsQueueCard** | Estado de trabajos en cola | 1 col | ✅ 10s |
| **UsageCostCard** | Estadísticas de uso y costos | 2 col | ❌ |
| **LogsTableCard** | Tabla de logs con filtros | 3 col | ✅ 15s |

## 🔗 Integración con API Backend

### Endpoints Utilizados

```javascript
// Salud del sistema
GET /api/health
Response: {
  services: { api: "ok", ai: "degraded", ... },
  flags: { rqc: true, shield: false, ... },
  timestamp: "2025-01-09T15:30:00Z"
}

// Información del usuario
GET /api/user  
Response: {
  id: "u_mock_user",
  email: "user@roastr.ai",
  plan: "pro",
  rqcEnabled: true,
  ...
}

// Integraciones de plataformas
GET /api/integrations
Response: [
  {
    name: "twitter",
    displayName: "Twitter/X", 
    status: "connected",
    icon: "𝕏",
    lastSync: "2025-01-09T14:30:00Z"
  },
  ...
]

// Logs del sistema
GET /api/logs?limit=50&level=error
Response: [
  {
    id: "log_123",
    level: "error",
    message: "Failed to generate roast",
    timestamp: "2025-01-09T15:30:00Z",
    service: "api"
  },
  ...
]

// Estadísticas de uso
GET /api/usage
Response: {
  aiCalls: 150,
  costCents: 1250,
  breakdown: {
    roastGeneration: 200,
    toxicityAnalysis: 100,
    ...
  },
  limits: {
    aiCallsLimit: 1000,
    ...
  }
}

// Preview de roast
POST /api/roast/preview
Body: { text: "mensaje a roastear", intensity: 3 }
Response: {
  roast: "Your comment just called - it wants its logic back 📞",
  intensity: 3,
  confidence: 0.87,
  isMock: true
}

// Portal de facturación
POST /api/billing/portal
Response: {
  url: "#mock-portal",
  message: "Mock billing portal in dev mode"
}
```

### 🔄 Manejo de Estados

**Patrón de Loading States:**
```javascript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

// Loading: Skeleton components
if (loading) return <Skeleton />;

// Error: Error message with retry
if (error) return <ErrorMessage onRetry={refetch} />;

// Success: Render data
return <DataComponent data={data} />;
```

**Skeleton Loaders:**
Cada widget tiene skeletons consistentes usando la clase `animate-pulse` de Tailwind.

## 🎨 Sistema de Diseño

### Colores y Temas

```css
/* Palette principal */
--primary: hsl(222 84% 5%);
--secondary: hsl(210 40% 96%);
--accent: hsl(210 40% 94%);
--muted: hsl(210 40% 96%);

/* Estados */
--success: text-green-600
--warning: text-yellow-600  
--error: text-red-600
--info: text-blue-600
```

### Componentes de UI

**shadcn/ui Components utilizados:**
- `Card` - Contenedores principales
- `Badge` - Estados y etiquetas
- `Button` - Acciones
- `Skeleton` - Estados de carga
- `Input` - Campos de formulario
- `Select` - Selectores (implementación custom)

### 📱 Responsive Design

```css
/* Breakpoints */
sm: 640px    /* Mobile landscape */
md: 768px    /* Tablet */
lg: 1024px   /* Desktop */
xl: 1280px   /* Large desktop */

/* Grid Layout */
.grid-cols-1 md:grid-cols-3  /* Mobile: 1 col, Desktop: 3 col */
```

## 🧪 Testing

### Configuración

```javascript
// setupTests.js
import '@testing-library/jest-dom';

// Mock fetch globally
global.fetch = jest.fn();

beforeEach(() => {
  fetch.mockClear();
});
```

### Ejemplos de Tests

```javascript
// Widget test pattern
test('renders loading state initially', () => {
  render(<PlanStatusCard />);
  expect(screen.getByText('Plan Status')).toBeInTheDocument();
  expect(screen.getAllByTestId('skeleton')).toHaveLength(4);
});

test('renders data after API call', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockData
  });

  render(<PlanStatusCard />);
  
  await waitFor(() => {
    expect(screen.getByText('Pro Plan')).toBeInTheDocument();
  });
});
```

### Tests Coverage

- ✅ Rendering de componentes
- ✅ Estados de loading/error/success  
- ✅ Interacciones de usuario
- ✅ API calls y mocking
- ✅ Filtros y búsqueda
- ✅ Formularios y validación

## 🚀 Scripts de Desarrollo

```bash
# Desarrollo
cd frontend && npm start       # Dev server en puerto 3001
cd frontend && npm test        # Tests con Jest + RTL
cd frontend && npm run build   # Build de producción

# Backend (desde root)
npm run start:api             # API server en puerto 3000
npm test                      # Tests del backend
```

## 🔧 Configuración

### Variables de Entorno

```bash
# frontend/.env (opcional)
REACT_APP_API_URL=http://localhost:3000
```

### Proxy Configuration

```javascript
// frontend/package.json
{
  "proxy": "http://localhost:3000"
}
```

Esto permite llamadas a `/api/*` desde el frontend sin configurar CORS.

## 📦 Dependencias Principales

```json
{
  "react": "^19.1.1",
  "react-router-dom": "^7.7.1",
  "lucide-react": "^0.539.0",
  "tailwindcss": "^4.1.11",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.3.1"
}
```

**Dependencias de Testing:**
```json
{
  "@testing-library/react": "^16.3.0",
  "@testing-library/jest-dom": "^6.6.4", 
  "@testing-library/user-event": "^14.6.1"
}
```

## 🎯 Próximos Pasos

### Funcionalidades Futuras
- [ ] Drag & drop para reordenar widgets
- [ ] Temas personalizables (dark/light mode)
- [ ] Notificaciones en tiempo real
- [ ] Dashboard personalizable por usuario
- [ ] Export de datos (CSV, PDF)
- [ ] Filtros avanzados en logs
- [ ] Métricas de performance

### Mejoras Técnicas
- [ ] Lazy loading de widgets
- [ ] Service Workers para cache
- [ ] Bundle optimization
- [ ] Accessibility (a11y) improvements
- [ ] E2E tests con Playwright
- [ ] Storybook para componentes

---

## 💡 Consejos de Desarrollo

1. **Mock-first approach**: Todos los components funcionan con datos mock
2. **Error boundaries**: Implementar para capturar errores de widgets
3. **Performance**: Usar React.memo para widgets que no cambian
4. **Accesibilidad**: Añadir aria-labels y roles semánticos
5. **Loading states**: Siempre mostrar feedback visual al usuario

Para más detalles técnicos, consulta también `MOCK_MODE.md`.