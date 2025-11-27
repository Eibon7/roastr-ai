# Guía para Ver el Admin Panel - Frontend Demo

**Fecha:** 2025-11-26

---

## 🚀 Iniciar el Servidor de Desarrollo

El servidor de desarrollo está configurado para iniciarse en segundo plano. Para verlo:

### Paso 1: Verificar que el servidor está corriendo

```bash
cd frontend
npm run dev
```

**URL del servidor:** http://localhost:5173

---

## 🎯 Cómo Entrar al Admin Panel (SIN Backend)

### Opción 1: Modo Demo (Recomendado)

1. Abre tu navegador y ve a: http://localhost:5173/login
2. **NO necesitas ingresar credenciales**
3. Haz clic en el botón **"Modo Demo (Sin Backend)"** (botón con icono de estrellas)
4. Serás redirigido automáticamente al Admin Dashboard como usuario admin demo

**Credenciales Demo:**

- Email: `admin@demo.roastr.ai`
- Rol: Admin
- Plan: Plus

### Opción 2: Login Normal (Requiere Backend)

Si tienes el backend corriendo:

1. Ve a http://localhost:5173/login
2. Ingresa tus credenciales reales
3. Haz clic en "Iniciar Sesión"

---

## 🎨 Pantallas Disponibles

Una vez dentro, podrás ver todas estas pantallas:

### 1. Admin Dashboard (`/admin/dashboard`)

- Vista principal del admin
- Cards con métricas
- Navegación sidebar

### 2. Gestión de Usuarios (`/admin/users`)

- Tabla completa de usuarios
- Búsqueda y filtros
- Acciones: Edit, Delete, Toggle Admin
- Paginación

**Nota:** Las APIs pueden fallar sin backend, pero la UI está completamente funcional.

### 3. Feature Flags (`/admin/config/feature-flags`)

- Lista de feature flags
- Toggle switches interactivos
- Filtros por categoría
- Búsqueda

### 4. Configuración de Planes (`/admin/config/plans`)

- 4 planes (Starter Trial, Starter, Pro, Plus)
- Edición de límites por plan
- Guardado individual

### 5. Gestión de Tonos (`/admin/config/tones`)

- 3 tonos predefinidos
- Edición de intensidad
- Ejemplos por tono

### 6. Panel de Métricas (`/admin/metrics`)

- Dashboard con métricas agregadas
- Cards con estadísticas
- Auto-refresh

---

## 🎨 Características Visuales

### Tema

- ✅ Modo claro/oscuro
- ✅ Toggle en el header
- ✅ Persistencia de preferencia

### Diseño Responsivo

- ✅ Mobile-first
- ✅ Sidebar colapsable en móvil
- ✅ Tablas responsivas

### Componentes UI

- ✅ shadcn/ui components
- ✅ Iconos de Lucide React
- ✅ Animaciones suaves
- ✅ Estados de loading

---

## 🔧 Notas Técnicas

### Modo Demo

El modo demo:

- ✅ **NO requiere backend**
- ✅ Simula un usuario admin en localStorage
- ✅ Permite navegar por todas las pantallas
- ✅ Las APIs mostrarán errores (esperado sin backend)
- ✅ La UI está completamente funcional

### Token Demo

El modo demo usa un token especial que empieza con `demo-token-`. El sistema detecta este token y:

- ✅ NO intenta verificar con el backend
- ✅ Carga el usuario desde localStorage
- ✅ Mantiene la sesión al recargar la página

### Backend API (Opcional)

Si tienes el backend corriendo en `http://localhost:3000`, las páginas se conectarán automáticamente y mostrarán datos reales.

---

## 📝 Comandos Útiles

```bash
# Iniciar servidor
cd frontend && npm run dev

# Ver logs
tail -f frontend/dev.log

# Detener servidor
pkill -f "vite"

# Limpiar localStorage (para salir del modo demo)
# En consola del navegador:
localStorage.clear()
```

---

## 🔗 URLs Disponibles

| Ruta       | Descripción          | Acceso         |
| ---------- | -------------------- | -------------- |
| `/`        | Redirige a login     | Público        |
| `/login`   | Página de login      | Público        |
| `/app/*`   | Aplicación principal | Requiere auth  |
| `/admin/*` | Admin panel          | Requiere admin |

---

## 🎯 Workflow Recomendado

1. **Iniciar servidor:** `npm run dev` en `frontend/`
2. **Abrir navegador:** http://localhost:5173/login
3. **Click en "Modo Demo":** Para entrar sin backend
4. **Navegar por pantallas:** Usa el sidebar para ver todas las páginas
5. **Explorar UI:** Prueba temas, responsive, interacciones

---

**Servidor:** http://localhost:5173  
**Modo Demo:** ✅ Disponible  
**Status:** ✅ Listo para visualizar
