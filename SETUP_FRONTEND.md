# 🚀 Guía de Setup del Frontend

## ✅ Sistema Completado

Has implementado exitosamente la interfaz de login y registro para Roastr.ai con las siguientes características:

### 🎯 **Funcionalidades Implementadas**

✅ **Autenticación Completa**
- Login con email/password
- Magic links (sin contraseña)
- Registro de nuevos usuarios
- Recuperación de contraseña
- Toggle configurable entre métodos

✅ **Tema Dinámico**
- Modo claro/oscuro automático
- Detección de preferencia del sistema (`prefers-color-scheme`)
- Toggle manual en esquina inferior derecha
- Persistencia en localStorage

✅ **Diseño Profesional**
- React + TailwindCSS
- Responsive design
- Componentes reutilizables
- Transiciones suaves

✅ **Configuración por Entorno**
- Variable `USE_MAGIC_LINK` para habilitar/deshabilitar magic links
- Configuración completa via `.env`

## 📦 **Archivos Creados**

```
frontend/
├── src/
│   ├── components/
│   │   ├── AuthForm.js          # ✅ Login email/password
│   │   ├── MagicLinkForm.js     # ✅ Login magic link  
│   │   └── ThemeToggle.js       # ✅ Toggle tema
│   ├── pages/
│   │   ├── login.jsx            # ✅ Página login
│   │   ├── register.jsx         # ✅ Página registro
│   │   ├── reset-password.jsx   # ✅ Reset contraseña
│   │   ├── dashboard.jsx        # ✅ Dashboard
│   │   └── auth-callback.jsx    # ✅ Callback magic links
│   ├── hooks/
│   │   └── useTheme.js          # ✅ Hook tema
│   ├── lib/
│   │   └── supabaseClient.js    # ✅ Cliente Supabase
│   ├── App.js                   # ✅ App principal
│   └── App.css                  # ✅ Estilos globales
├── public/
│   ├── index.html               # ✅ HTML principal
│   └── manifest.json            # ✅ PWA manifest
└── package.json                 # ✅ Dependencias
```

## 🛠️ **Setup Paso a Paso**

### 1. **Instalar Dependencias**

```bash
# Instalar dependencias del frontend
npm run frontend:install

# O alternativamente:
cd frontend && npm install
```

### 2. **Configuración de Variables de Entorno**

Crea `frontend/.env` basado en `frontend/.env.example`:

```bash
# Supabase Configuration (REQUERIDO)
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Authentication Configuration
REACT_APP_USE_MAGIC_LINK=true    # false para deshabilitar magic links

# App Configuration (OPCIONAL)
REACT_APP_APP_NAME=Roastr.ai
REACT_APP_SUPPORT_EMAIL=support@roastr.ai
```

### 3. **Iniciar Servidor de Desarrollo**

```bash
# Desde la raíz del proyecto
npm run frontend:start

# O alternativamente:
cd frontend && npm start
```

El frontend se abrirá en `http://localhost:3001`

### 4. **Build para Producción**

```bash
# Construir para producción
npm run frontend:build

# Archivos generados en frontend/build/
```

## 🎮 **Cómo Probar el Sistema**

### **Escenario 1: Login con Email/Password**

1. Ve a `http://localhost:3001`
2. Verás el formulario de login por defecto
3. Si no tienes cuenta, clic en "crea una cuenta nueva"
4. Registra un usuario con email, password y nombre
5. Supabase enviará email de confirmación
6. Confirma tu email y luego inicia sesión

### **Escenario 2: Magic Links (si está habilitado)**

1. En la página de login, clic en "¿Prefieres iniciar sesión con un enlace mágico?"
2. Ingresa tu email
3. Clic en "Enviar enlace mágico"
4. Revisa tu email y clic en el enlace
5. Serás redirigido automáticamente al dashboard

### **Escenario 3: Reset de Contraseña**

1. En login, clic en "¿Olvidaste tu contraseña?"
2. Ingresa tu email
3. Clic en "Enviar enlace de restablecimiento"
4. Revisa tu email y sigue las instrucciones

### **Escenario 4: Tema Claro/Oscuro**

1. El tema se detecta automáticamente del sistema
2. Usa el botón flotante (🌙/☀️) en esquina inferior derecha para cambiarlo
3. La preferencia se guarda automáticamente

## ⚙️ **Variables de Configuración**

### **Magic Links ON/OFF**

```env
# Mostrar toggle entre email/password y magic link
REACT_APP_USE_MAGIC_LINK=true

# Solo mostrar email/password (sin toggle)
REACT_APP_USE_MAGIC_LINK=false
```

### **Configurar en Supabase**

1. **Authentication Settings**:
   - Habilita "Enable email confirmations"
   - Configura "Site URL": `http://localhost:3001` (desarrollo)
   - Añade "Redirect URLs": `http://localhost:3001/auth/callback`

2. **Email Templates** (opcional):
   - Personaliza templates de confirmación y reset
   - Asegúrate que los links apunten a tu dominio

## 🎨 **Personalización**

### **Colores y Tema**

Edita `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      primary: {
        // Cambia estos valores para personalizar
        500: '#e073ff',  
        600: '#ca4bff',
        // ...
      }
    }
  }
}
```

### **Textos y Mensajes**

Los textos están en los componentes y se pueden personalizar fácilmente:
- `src/components/AuthForm.js`
- `src/components/MagicLinkForm.js`
- `src/pages/login.jsx`

### **Logo y Branding**

- Reemplaza el ícono SVG en los componentes
- Añade tu logo en `public/`
- Actualiza `public/manifest.json`

## 🔧 **Troubleshooting**

### **Error: Magic links no funcionan**
- Verifica `REACT_APP_USE_MAGIC_LINK=true`
- Confirma callback URL en Supabase
- Revisa console del navegador

### **Error: Supabase connection**  
- Verifica `REACT_APP_SUPABASE_URL` y `REACT_APP_SUPABASE_ANON_KEY`
- Confirma que las keys sean correctas
- Revisa Network tab en DevTools

### **Error: Tema no persiste**
- Verifica localStorage en DevTools
- Confirma que el script en `index.html` se ejecute

### **Error: Build falla**
- Verifica que todas las variables `REACT_APP_*` estén definidas
- Ejecuta `npm run frontend:install` de nuevo
- Revisa versiones de Node.js (recomendado: 16+)

## 📱 **Características Mobile**

- **Responsive**: Optimizado para móviles
- **Touch Friendly**: Botones accesibles en touch
- **PWA Ready**: Manifest incluido para instalación
- **Fast Loading**: Optimizado para conexiones lentas

## 🚀 **Deploy**

### **Netlify/Vercel**

```bash
# Build command
npm run frontend:build

# Publish directory
frontend/build

# Environment variables
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-key
REACT_APP_USE_MAGIC_LINK=true
```

### **Nginx/Apache**

Sirve archivos estáticos desde `frontend/build/` con:
- Rewrite rules para SPA routing
- HTTPS forzado
- Headers de seguridad

## 🎉 **¡Listo para Usar!**

Tu interfaz de login y registro está **completamente funcional** con:

✅ Autenticación robusta  
✅ Tema dinámico  
✅ Diseño profesional  
✅ Magic links configurables  
✅ Mobile responsive  
✅ Deploy ready  

**Siguiente paso:** Conecta con tu sistema backend de integraciones para completar la experiencia de usuario.