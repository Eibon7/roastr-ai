# Mock Mode - Frontend

## 🎭 Qué es Mock Mode

Mock Mode es un sistema de funcionamiento sin dependencias externas que permite al frontend de Roastr AI funcionar completamente sin necesidad de:

- Base de datos Supabase
- APIs externas
- Configuración de autenticación
- Variables de entorno complejas

Esto es ideal para **demostraciones**, **desarrollo frontend independiente**, y **onboarding de desarrolladores**.

## 🚀 Activación Automática

Mock Mode se activa **automáticamente** en las siguientes situaciones:

### Escenario 1: Variables de Entorno Faltantes

```bash
# Si estas variables NO están configuradas:
REACT_APP_SUPABASE_URL=     # Vacía o no existe
REACT_APP_SUPABASE_ANON_KEY=  # Vacía o no existe

# Mock Mode se activa automáticamente
```

### Escenario 2: Activación Explícita

```bash
# Forzar Mock Mode incluso con Supabase configurado:
REACT_APP_ENABLE_MOCK_MODE=true
```

## 🏗️ Arquitectura Técnica

### Detección de Mock Mode

**Archivo:** `src/lib/mockMode.js`

```javascript
// Lógica de prioridad:
// 1. Si faltan vars de Supabase → Mock Mode forzado
// 2. Si REACT_APP_ENABLE_MOCK_MODE=true → Mock Mode explícito
// 3. Default → Modo real

const isMockModeEnabled = () => {
  if (!isSupabaseConfigured()) {
    return true; // Auto-activación
  }
  return process.env.REACT_APP_ENABLE_MOCK_MODE === 'true';
};
```

### Factory Pattern para Cliente

**Archivo:** `src/lib/supabaseClient.js`

```javascript
function createSupabaseClient() {
  if (isMockModeEnabled()) {
    return new MockSupabaseClient(); // Cliente simulado
  }
  return createClient(supabaseUrl, supabaseKey); // Cliente real
}
```

### MockSupabaseClient

Una implementación completa que simula la API de Supabase usando localStorage:

```javascript
class MockSupabaseClient {
  auth = {
    signInWithPassword: async (credentials) => {
      /* ... */
    },
    signUp: async (credentials) => {
      /* ... */
    },
    signOut: async () => {
      /* ... */
    },
    getSession: async () => {
      /* ... */
    },
    getUser: async () => {
      /* ... */
    },
    onAuthStateChange: (callback) => {
      /* ... */
    }
  };
}
```

## 🔧 Componentes y Funcionalidades

### AuthContext Unificado

**Archivo:** `src/contexts/AuthContext.js`

- **Detección automática** del modo (real vs mock)
- **Estado persistente** usando localStorage en mock mode
- **API idéntica** para ambos modos
- **Datos realistas** de usuario simulado

```javascript
const AuthProvider = ({ children }) => {
  const [mockMode] = useState(isMockModeEnabled());
  // Lógica unificada para ambos modos...
};
```

### Indicadores Visuales

**Archivo:** `src/components/ui/MockModeIndicator.jsx`

Badges que aparecen automáticamente cuando mock mode está activo:

```jsx
// Se muestra solo si mock mode está habilitado
<MockModeIndicator size="sm" tooltip="Using mock data - no external APIs required" />
```

**Ubicaciones:**

- Headers de widgets principales
- Esquinas de cards importantes
- Responsive (se oculta en móvil por defecto)

### Datos Simulados

Cada widget muestra datos realistas pero estáticos:

#### PlanStatusCard

```javascript
const mockUserData = {
  name: 'Demo User',
  email: 'demo@roastr.ai',
  plan: 'pro',
  usage: { aiCalls: 150, limits: { aiCallsLimit: 1000 } }
};
```

#### HealthFlagsCard

```javascript
const mockHealthData = {
  services: { database: 'ok', queue: 'ok', openai: 'ok' },
  flags: { rqc: true, shield: true, mockMode: true }
};
```

#### IntegrationsCard

```javascript
const mockIntegrations = {
  twitter: { connected: true, username: '@demo_user' },
  youtube: { connected: false },
  instagram: { connected: true, followers: 1250 }
};
```

## 📋 Estados de Mock Mode

El sistema proporciona información detallada sobre su estado:

```javascript
const status = getMockModeStatus();
// {
//   enabled: true,
//   supabaseConfigured: false,
//   mockModeForced: true,
//   mockModeExplicit: false,
//   reason: "Missing Supabase environment variables"
// }
```

## 🧪 Testing

### Tests Incluidos

**Mock Mode Detection** (`src/lib/__tests__/mockMode.test.js`):

- ✅ Detección con diferentes combinaciones de variables de entorno
- ✅ Prioridad de activación (forzado > explícito > default)
- ✅ Información de estado detallada

**MockSupabaseClient** (mismo archivo):

- ✅ Autenticación simulada (signIn, signUp, signOut)
- ✅ Gestión de sesiones con localStorage
- ✅ API compatible con Supabase real

**Integration Tests** (`src/__tests__/routes.mock.test.js`):

- ✅ Auto-detección en diferentes escenarios
- ✅ Funcionamiento básico de rutas

### Ejecutar Tests

```bash
# Tests específicos de mock mode
npm test -- --testPathPattern="mockMode"

# Tests de integración
npm test -- --testPathPattern="routes.mock"

# Tests de AuthContext
npm test -- --testPathPattern="AuthContext.mock"
```

## 🚦 Flujos de Usuario

### Primera Visita (Sin Configuración)

1. Usuario clona el repo
2. Ejecuta `npm install && npm start`
3. **Mock Mode se activa automáticamente**
4. Ve mensaje: "🔄 Mock mode enabled - no Supabase configuration found"
5. Puede navegar y explorar todas las funcionalidades

### Demo/Presentación

1. Activar: `REACT_APP_ENABLE_MOCK_MODE=true`
2. Todos los widgets muestran datos atractivos
3. Badges "Mock data" indican el estado claramente
4. Navegación completa funciona sin errores
5. Login/logout simulado funciona

### Desarrollo Frontend

1. Desarrolladores pueden trabajar sin backend
2. Datos consistentes y realistas
3. Todas las rutas renderizán correctamente
4. Tests automatizados validan comportamientos

## ⚠️ Consideraciones Importantes

### Seguridad

- ✅ No expone credenciales reales
- ✅ Datos de prueba claramente marcados
- ✅ Separación clara entre mock y producción

### Experiencia de Usuario

- ✅ Indicadores visuales claros
- ✅ Datos realistas pero estáticos
- ✅ No hay llamadas de red fallidas
- ✅ Rendimiento optimizado

### Desarrollo

- ✅ Hot reload funciona normalmente
- ✅ Build de producción excluye mock code
- ✅ Tests cubren ambos modos
- ✅ Documentación completa

## 📈 Beneficios

### Para Desarrolladores

- **Setup inmediato**: Sin configuración compleja
- **Desarrollo independiente**: Frontend sin esperar backend
- **Testing aislado**: Componentes sin dependencias externas
- **Onboarding rápido**: Nuevos desarrolladores productivos rápidamente

### Para Demos/Ventas

- **Primera impresión**: Producto funcional inmediatamente
- **Sin configuración**: No necesita setup técnico
- **Datos atractivos**: Widgets con información realista
- **Confiabilidad**: Sin fallos por APIs externas

### Para Testing

- **Tests estables**: Sin dependencias de red
- **Data consistente**: Resultados predecibles
- **Cobertura completa**: Todos los flujos testeable
- **CI/CD friendly**: Tests rápidos y confiables

## 🔄 Migración entre Modos

### De Mock a Real

```bash
# Agregar variables requeridas:
echo "REACT_APP_SUPABASE_URL=https://tu-proyecto.supabase.co" > .env
echo "REACT_APP_SUPABASE_ANON_KEY=tu_clave_anonima" >> .env

# Remover override si existe:
# REACT_APP_ENABLE_MOCK_MODE=false  # o comentar/eliminar
```

### De Real a Mock

```bash
# Opción 1: Remover variables
rm .env  # o comentar las variables de Supabase

# Opción 2: Override explícito
echo "REACT_APP_ENABLE_MOCK_MODE=true" >> .env
```

## 🐛 Troubleshooting

### Mock Mode no se activa

- Verificar que `REACT_APP_SUPABASE_URL` y `REACT_APP_SUPABASE_ANON_KEY` no estén definidas
- Revisar archivo `.env` en directorio `frontend/`
- Comprobar variables de entorno del sistema
- Reiniciar servidor de desarrollo después de cambios

### Datos no aparecen

- Verificar badges "Mock data" en widgets
- Abrir DevTools → Console para logs de mock mode
- Confirmar que `isMockModeEnabled()` devuelve `true`

### Tests fallan

- Variables de entorno pueden estar interfiriendo
- Ejecutar tests con entorno limpio
- Verificar que tests no tengan variables hardcodeadas

### Performance

- Mock mode es más rápido (sin llamadas de red)
- Si hay lentitud, verificar loops infinitos en useEffect
- DevTools → Performance para profiling

## 🎯 Casos de Uso Recomendados

### ✅ Cuándo usar Mock Mode

- **Desarrollo inicial** de componentes UI
- **Demos de producto** para clientes/stakeholders
- **Onboarding** de nuevos desarrolladores
- **Testing** de comportamientos frontend
- **CI/CD** para tests rápidos y estables
- **Desarrollo offline** o con conectividad limitada

### ❌ Cuándo NO usar Mock Mode

- **Testing de integración** real con APIs
- **Desarrollo de features** que requieren datos reales
- **Performance testing** con cargas reales
- **Producción** o staging environments
- **Validación** de flujos completos end-to-end
