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
│       ├── StyleProfileCard.jsx  # Style Profile widget (NEW)
│       ├── HealthFlagsCard.jsx
│       ├── ActivityFeedCard.jsx
│       ├── JobsQueueCard.jsx
│       ├── UsageCostCard.jsx
│       ├── LogsTableCard.jsx
│       └── index.js          # Registry de widgets
├── pages/                    # Páginas principales
│   ├── Dashboard.jsx         # Dashboard con widgets
│   ├── PlanPicker.jsx        # Selección de planes (NEW)
│   ├── Connect.jsx           # Conexión de plataformas (NEW)
│   ├── StyleProfile.jsx      # Generación de perfiles (NEW)
│   ├── Compose.jsx           # Composición de roasts
│   ├── Integrations.jsx     # Gestión de plataformas (original)
│   ├── Billing.jsx          # Facturación y planes
│   ├── Settings.jsx         # Configuración de usuario
│   └── Logs.jsx             # Visualización de logs
└── lib/
    ├── utils.js             # Utilidades de Tailwind
    └── mockMode.js          # Utilidades de Mock Mode
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
| **StyleProfileCard** | Estado y gestión del perfil de estilo IA | 1 col | ❌ |
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

## 🎨 Style Profile Feature (NEW)

### Descripción General
El **Style Profile** es una funcionalidad exclusiva de **Creator+** que genera perfiles de estilo de roast personalizados basados en el contenido de redes sociales del usuario.

### Flujo de Usuario

#### 1. **Selección de Plan** (`/plans`)
- Comparación visual de planes Free/Pro/Creator+
- Style Profile destacado como feature exclusivo de Creator+
- Navegación automática a `/integrations/connect` tras selección

#### 2. **Conexión de Plataformas** (`/integrations/connect`)  
- 7 plataformas soportadas: Twitter, Instagram, YouTube, TikTok, LinkedIn, Facebook, Bluesky
- OAuth mock con simulación de éxito/fallo (5% fallos para testing UX)
- Import automático de hasta 300 items por plataforma
- Progreso en tiempo real con estimaciones de tiempo

#### 3. **Análisis y Generación** (`/style-profile`)
- Detección automática de idiomas (mínimo 50 items por idioma)
- Análisis de tono, estilo, patrones de escritura
- Generación de prompts personalizados (máx 1200 caracteres)
- Ejemplos de roast en el estilo del usuario

### Arquitectura Técnica

#### Backend APIs
```javascript
// Plan Management
GET  /api/plan/available          // Lista de planes
POST /api/plan/select            // Selección de plan
GET  /api/plan/current           // Plan actual del usuario

// Platform Integrations  
GET  /api/integrations/platforms  // Plataformas disponibles
POST /api/integrations/connect    // Conectar plataforma (OAuth mock)
POST /api/integrations/import     // Importar contenido
GET  /api/integrations/status     // Estado de conexiones

// Style Profile
GET  /api/style-profile/status    // Acceso y estado del feature
POST /api/style-profile/generate  // Generar perfil (Creator+ only)
GET  /api/style-profile          // Obtener perfil generado
GET  /api/style-profile/preview/:lang // Preview por idioma
DELETE /api/style-profile        // Eliminar perfil
```

#### Frontend Components

**PlanPicker.jsx**
- Grid responsive de planes con precios
- Destacado visual del plan Creator+
- Feature flags para mostrar/ocultar Style Profile
- Navegación automática post-selección

**Connect.jsx**
- Grid de plataformas con estados de conexión
- Progreso de import con barras animadas
- Validación de contenido mínimo (50+ items)
- CTA dinámico para generar perfil cuando esté listo

**StyleProfile.jsx**
- Interface de generación con validaciones
- Tabs por idioma para perfiles multi-lenguaje
- Copy-to-clipboard para prompts
- Metadata detallada (fuentes, estadísticas, fechas)

**StyleProfileCard.jsx** (Widget)
- Estados: Sin acceso / Generar / Resumen de perfil
- Stats rápidas: items analizados, idiomas, plataformas
- Preview de prompts con copy directo
- Enlaces a gestión completa

### Mock Mode Implementation

**Contenido Mock Generado:**
```javascript
// Ejemplo de contenido simulado
{
  id: "twitter_123",
  text: "Excelente punto, completamente de acuerdo con tu análisis 👍",
  lang: "es", 
  platform: "twitter",
  createdAt: "2025-01-09T15:30:00Z",
  metrics: { likes: 23, replies: 5 }
}
```

**Detección de Idiomas:**
- Algoritmo de umbral: 25% mínimo + 50 items mínimo
- Idiomas soportados: es, en, pt, fr, it, de
- Generación de perfiles separados por idioma

**Generación de Perfiles:**
```javascript
// Estructura de perfil generado
{
  lang: "es",
  prompt: "Eres un usuario amigable y cercano que usa un estilo equilibrado...",
  sources: { twitter: 180, instagram: 95 },
  metadata: {
    totalItems: 275,
    avgLength: 85,
    dominantTone: "friendly",
    styleType: "medium",
    emojiUsage: 0.25
  },
  examples: [
    "No me parece correcto eso, creo que deberías reconsiderarlo.",
    "Excelente observación! Muy acertado tu punto al respecto."
  ],
  createdAt: "2025-01-09T16:00:00Z"
}
```

### Gating y Control de Acceso

**Plan Gating:**
- Free/Pro: Mostrar CTA de upgrade
- Creator+: Funcionalidad completa
- Validación en backend y frontend

**Feature Flag:**
```bash
ENABLE_STYLE_PROFILE=true   # Feature habilitado
ENABLE_STYLE_PROFILE=false  # Feature deshabilitado (503 responses)
```

### Testing

**Backend Tests:**
- Gating por plan (Free/Pro vs Creator+)
- Generación con contenido insuficiente/suficiente
- Multi-idioma y detección de umbrales
- Error handling y edge cases

**Frontend Tests:**
- Flujo completo: plan → connect → import → generate
- Estados de loading/error/success
- Copy functionality y navegación
- Componentes de widget con diferentes estados

### Métricas y Analytics

**Tracking de Uso:**
- Generaciones por usuario/plan
- Idiomas más populares
- Plataformas más utilizadas
- Tiempo promedio de generación

## 🎯 Próximos Pasos

### Funcionalidades Futuras
- [ ] Regeneración automática periódica de perfiles
- [ ] Más plataformas (Reddit, Discord, etc.)
- [ ] Análisis de sentimiento avanzado  
- [ ] Templates de prompt personalizables
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