# Frontend Dashboard - Roastr AI

## Descripción General

El frontend de Roastr AI es una aplicación React que proporciona una interfaz de usuario moderna y funcional para el sistema de moderación de contenido y generación de roasts. El dashboard está diseñado con un enfoque en la experiencia del usuario y incluye soporte completo para **Mock Mode**, permitiendo desarrollo y demostración sin dependencias externas.

## Características Principales

### 🎭 Mock Mode (Modo Demostración)

El sistema incluye un **modo mock automático** que permite al frontend funcionar sin conexión a APIs externas:

- **Auto-detección**: Se activa automáticamente cuando faltan las variables de entorno de Supabase
- **UI consistente**: Todos los componentes muestran datos de demostración realistas
- **Indicadores visuales**: Badges "Mock data" para claridad del estado actual
- **Navegación completa**: Todas las rutas funcionan sin errores

#### Configuración de Mock Mode

```bash
# Automático cuando faltan estas variables:
# REACT_APP_SUPABASE_URL
# REACT_APP_SUPABASE_ANON_KEY

# O forzado explícitamente:
REACT_APP_ENABLE_MOCK_MODE=true
```

### 📊 Dashboard Widgets

El dashboard incluye widgets informativos:

- **Plan Status Card**: Estado del plan del usuario y límites de uso
- **Health Flags Card**: Estado del sistema y servicios
- **Integrations Card**: Estado de conexiones con plataformas sociales
- **Usage Cost Card**: Métricas de uso y costos
- **Activity Feed**: Actividad reciente del sistema
- **Jobs Queue**: Estado de trabajos en cola
- **Logs Table**: Registros de sistema en tiempo real

### 🔐 Sistema de Autenticación

- **AuthContext**: Contexto React unificado que soporta tanto modo real como mock
- **Sesiones persistentes**: Manejo de sesiones con localStorage en mock mode
- **Rutas protegidas**: Sistema de protección de rutas basado en autenticación
- **Flujos completos**: Login, registro, logout funcionan en ambos modos

### 🎨 Interfaz de Usuario

- **Design System**: Componentes UI consistentes con Tailwind CSS
- **Tema oscuro/claro**: Toggle de tema persistente
- **Responsive**: Diseño adaptable a diferentes tamaños de pantalla
- **Navegación intuitiva**: Sidebar colapsible con navegación clara

## Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── ui/             # Componentes base del design system
│   │   └── widgets/        # Widgets del dashboard
│   ├── contexts/           # Context providers de React
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilidades y configuración
│   │   ├── mockMode.js     # Sistema de detección mock mode
│   │   └── supabaseClient.js # Factory de cliente con soporte mock
│   ├── pages/              # Páginas de la aplicación
│   └── __tests__/          # Tests automatizados
```

## Rutas Disponibles

### Rutas Públicas
- `/login` - Página de inicio de sesión
- `/register` - Registro de nuevos usuarios
- `/reset-password` - Recuperación de contraseña

### Rutas Protegidas
- `/dashboard` - Dashboard principal con widgets
- `/compose` - Interfaz de composición de contenido
- `/integrations` - Configuración de integraciones
- `/billing` - Gestión de facturación y planes
- `/settings` - Configuración de usuario
- `/logs` - Visualización de logs del sistema

### Rutas de Administración
- `/admin` - Dashboard de administración
- `/admin/users` - Gestión de usuarios
- `/admin/user/:id` - Detalle de usuario específico

## Desarrollo Local

### Prerrequisitos
- Node.js 16+
- npm o yarn

### Instalación
```bash
cd frontend
npm install
```

### Modos de Ejecución

#### Mock Mode (Desarrollo sin APIs)
```bash
# No configurar variables de Supabase, o:
echo "REACT_APP_ENABLE_MOCK_MODE=true" > .env

npm start
```

#### Modo Real (Con APIs)
```bash
# Configurar en .env:
echo "REACT_APP_SUPABASE_URL=tu_url_supabase" > .env
echo "REACT_APP_SUPABASE_ANON_KEY=tu_clave_supabase" >> .env

npm start
```

### Scripts Disponibles

```bash
npm start          # Desarrollo con hot reload
npm run build      # Build de producción
npm test           # Ejecutar tests
npm run test:coverage # Tests con cobertura
npm run lint       # Linting con ESLint
```

## Testing

### Estrategia de Testing

El proyecto incluye tests comprehensivos para:

- **Mock Mode Detection**: Verificación de la lógica de auto-detección
- **MockSupabaseClient**: Tests del cliente simulado
- **Route Rendering**: Tests de renderizado de rutas en mock mode
- **Component Integration**: Tests de integración de componentes

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests específicos de mock mode
npm test -- --testPathPattern="mockMode"

# Tests de rutas
npm test -- --testPathPattern="routes.mock"

# Tests de AuthContext
npm test -- --testPathPattern="AuthContext.mock"
```

## Casos de Uso

### 1. Demostración de Producto
- Activar mock mode para mostrar funcionalidades sin setup
- Datos realistas en todos los widgets
- Navegación completa sin errores

### 2. Desarrollo Frontend
- Desarrollo independiente del backend
- Iteración rápida en UI/UX
- Testing de componentes aislados

### 3. Onboarding de Desarrolladores
- Setup inmediato sin configuración compleja
- Experiencia completa del producto
- Entendimiento de flujos de usuario

## Integración con Backend

### Variables de Entorno Requeridas (Modo Real)

```bash
REACT_APP_SUPABASE_URL=https://tu-proyecto.supabase.co
REACT_APP_SUPABASE_ANON_KEY=tu_clave_anonima_supabase
```

### Variables Opcionales

```bash
REACT_APP_ENABLE_MOCK_MODE=true  # Forzar mock mode
```

## Troubleshooting

### Problemas Comunes

#### Frontend no carga
- Verificar que Node.js esté instalado (version 16+)
- Ejecutar `npm install` en el directorio frontend
- Verificar que el puerto 3000 esté disponible

#### Mock Mode no se activa
- Verificar que las variables `REACT_APP_SUPABASE_*` no están configuradas
- Revisar el archivo `.env` del frontend
- Confirmar que `REACT_APP_ENABLE_MOCK_MODE=true` si se fuerza

#### Datos no aparecen en widgets
- En mock mode, los datos son simulados y estáticos
- Verificar la consola del navegador para errores
- Confirmar que los componentes muestran "Mock data" badges

#### Tests fallan
- Ejecutar `npm install` para dependencias actualizadas
- Verificar que no hay variables de entorno interferiendo en tests
- Revisar logs específicos del test que falla

## Próximas Mejoras

- [ ] Tema personalizable por organización
- [ ] Más widgets configurables
- [ ] PWA support para uso offline
- [ ] Mejores animaciones y transiciones
- [ ] Análisis de rendimiento con Core Web Vitals