# Roastr.ai Frontend

## 🎯 Overview

Interfaz de usuario moderna para Roastr.ai construida con React + TailwindCSS, con soporte para autenticación email/password y magic links.

## ✨ Features

- **🔐 Autenticación Completa**
  - Login con email/password
  - Magic links (sin contraseña)
  - Registro de usuarios
  - Recuperación de contraseña
  - Toggle configurable entre métodos

- **🌙 Tema Dinámico**
  - Modo claro/oscuro automático
  - Detección de preferencia del sistema
  - Toggle manual con persistencia

- **📱 Diseño Responsive**
  - Optimizado para móviles y desktop
  - Componentes reutilizables
  - Interfaz intuitiva y profesional

- **⚡ Performance**
  - React 19 con componentes optimizados
  - TailwindCSS para estilos eficientes
  - Code splitting automático

## 🛠️ Stack Tecnológico

- **Frontend**: React 19
- **Styling**: TailwindCSS 4.x
- **Routing**: React Router DOM 7.x
- **Authentication**: Supabase Auth
- **Build Tool**: Create React App

## 📁 Structure

```
frontend/
├── public/
│   ├── index.html
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── AuthForm.js          # Formulario email/password
│   │   ├── MagicLinkForm.js     # Formulario magic link
│   │   └── ThemeToggle.js       # Toggle de tema
│   ├── pages/
│   │   ├── login.jsx            # Página de login
│   │   ├── register.jsx         # Página de registro
│   │   ├── reset-password.jsx   # Recuperar contraseña
│   │   ├── dashboard.jsx        # Dashboard principal
│   │   └── auth-callback.jsx    # Callback de magic links
│   ├── hooks/
│   │   └── useTheme.js          # Hook para manejo de tema
│   ├── lib/
│   │   └── supabaseClient.js    # Cliente y helpers de Supabase
│   ├── App.js                   # Componente principal
│   ├── App.css                  # Estilos globales
│   └── index.js                 # Entry point
└── package.json
```

## 🚀 Getting Started

### 1. Instalación

```bash
# Instalar dependencias del frontend
npm run frontend:install

# O manualmente
cd frontend
npm install
```

### 2. Configuración

Crea un archivo `.env` en la carpeta `frontend/`:

```env
# Supabase Configuration
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Authentication Configuration
REACT_APP_USE_MAGIC_LINK=true

# App Configuration
REACT_APP_APP_NAME=Roastr.ai
REACT_APP_SUPPORT_EMAIL=support@roastr.ai
```

### 3. Desarrollo

```bash
# Iniciar servidor de desarrollo (puerto 3001)
npm run frontend:start

# O manualmente
cd frontend
npm start
```

### 4. Build de Producción

```bash
# Construir para producción
npm run frontend:build

# O manualmente
cd frontend
npm run build
```

## 🔧 Configuration

### Variables de Entorno

| Variable                      | Descripción                 | Requerido | Default     |
| ----------------------------- | --------------------------- | --------- | ----------- |
| `REACT_APP_SUPABASE_URL`      | URL de tu proyecto Supabase | ✅        | -           |
| `REACT_APP_SUPABASE_ANON_KEY` | Clave anónima de Supabase   | ✅        | -           |
| `REACT_APP_USE_MAGIC_LINK`    | Habilita magic links        | ❌        | `false`     |
| `REACT_APP_APP_NAME`          | Nombre de la aplicación     | ❌        | `Roastr.ai` |
| `REACT_APP_SUPPORT_EMAIL`     | Email de soporte            | ❌        | -           |

### Toggle de Magic Links

El frontend detecta automáticamente si los magic links están habilitados via `REACT_APP_USE_MAGIC_LINK=true`. Si está en `false` o no está definida, solo mostrará login con email/password.

## 📱 Páginas y Flujos

### 1. Login (`/login`)

- Formulario de email/password por defecto
- Toggle opcional a magic link (si está habilitado)
- Enlace a registro
- Enlace a reset de contraseña
- Manejo de errores con mensajes claros

### 2. Registro (`/register`)

- Formulario con email, password y nombre
- Toggle opcional a magic link (si está habilitado)
- Validación en tiempo real
- Redirección automática después del registro

### 3. Reset Password (`/reset-password`)

- Envío de enlace de recuperación
- Confirmación visual del envío
- Opción de reenviar enlace
- Instrucciones claras para el usuario

### 4. Dashboard (`/dashboard`)

- Página principal después del login
- Información del usuario
- Próximos pasos para configuración
- Botón de logout

### 5. Auth Callback (`/auth/callback`)

- Manejo automático de magic links
- Redirección apropiada
- Manejo de errores

## 🎨 Design System

### Colores

- **Primary**: Purple (`#e073ff` y variantes)
- **Gray**: Escala completa para modo claro/oscuro
- **Success**: Verde para estados exitosos
- **Error**: Rojo para errores

### Componentes

- **Forms**: Inputs consistentes con validación
- **Buttons**: Estados hover, loading, disabled
- **Alerts**: Success, error, info
- **Loading**: Spinners y placeholders

## 🌙 Theme System

El sistema de temas incluye:

1. **Auto-detección**: Usa `prefers-color-scheme`
2. **Persistencia**: Guarda preferencia en localStorage
3. **Toggle Manual**: Botón flotante en esquina inferior derecha
4. **Sin Flash**: Previene parpadeo al cargar

### Uso en Componentes

```jsx
import useTheme from '../hooks/useTheme';

const MyComponent = () => {
  const { theme, toggleTheme } = useTheme();

  return <div className="bg-white dark:bg-gray-800">Contenido que se adapta al tema</div>;
};
```

## 🔐 Authentication Flow

### Password Authentication

1. Usuario ingresa email/password
2. Supabase valida credenciales
3. Retorna session si es válido
4. Redirige a dashboard

### Magic Link Authentication

1. Usuario ingresa email
2. Supabase envía magic link
3. Usuario hace clic en enlace
4. Callback automático valida y redirige

### Session Management

- Sessions se mantienen automáticamente
- Refresh tokens manejados por Supabase
- Logout limpia session local y remota

## 🛡️ Security Features

- **CSRF Protection**: Tokens en todas las requests
- **XSS Prevention**: Sanitización automática
- **Secure Headers**: Configurados en build
- **HTTPS Only**: Enforced en producción
- **Session Timeouts**: Configurables

## 📦 Build & Deploy

### Build Assets

```bash
npm run frontend:build
```

Genera archivos optimizados en `frontend/build/`:

- HTML/CSS/JS minificados
- Assets con hash para cache busting
- Service worker para PWA
- Mapas de fuente para debugging

### Deploy Options

**Netlify/Vercel:**

```bash
# Build command
npm run frontend:build

# Publish directory
frontend/build
```

**Nginx/Apache:**
Sirve archivos estáticos desde `frontend/build/`

## 🧪 Testing

```bash
cd frontend
npm test                    # Tests unitarios
npm test -- --coverage     # Con cobertura
npm test -- --watchAll     # Watch mode
```

## 🔍 Debugging

### Development Tools

- React DevTools
- Redux DevTools (si se agrega)
- Network tab para requests a Supabase

### Common Issues

1. **Magic links no funcionan**
   - Verificar `REACT_APP_USE_MAGIC_LINK=true`
   - Confirmar callback URL en Supabase

2. **Theme no persiste**
   - Verificar localStorage del navegador
   - Comprobar script en `index.html`

3. **Errores de CORS**
   - Configurar dominios permitidos en Supabase
   - Verificar URLs en variables de entorno

## 🚀 Performance Optimizations

- **Code Splitting**: Rutas lazy-loaded
- **Tree Shaking**: Elimina código no usado
- **Image Optimization**: WebP cuando es posible
- **CSS Purging**: TailwindCSS elimina estilos no usados
- **Caching**: Service worker para assets estáticos

## 📱 Mobile Experience

- **Responsive Design**: Breakpoints optimizados
- **Touch Friendly**: Botones y enlaces accesibles
- **PWA Ready**: Manifest y service worker incluidos
- **Fast Loading**: Optimizado para conexiones lentas

## 🤝 Contributing

1. Fork el repositorio
2. Crea feature branch (`git checkout -b feature/amazing-feature`)
3. Commit cambios (`git commit -m 'Add amazing feature'`)
4. Push branch (`git push origin feature/amazing-feature`)
5. Abre Pull Request

## 📄 License

Este proyecto está bajo la Licencia ISC - ver archivo LICENSE para detalles.
