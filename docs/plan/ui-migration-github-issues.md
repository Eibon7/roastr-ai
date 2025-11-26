# Issues de GitHub - Migración UI a shadcn/ui

**Proyecto:** Roastr.AI
**Objetivo:** Migración completa de UI a shadcn/ui con estructura de admin panel y user app
**Total Estimado:** 28 Issues organizados en 8 épicas

---

## 📋 Índice por Épica

1. [Épica: Migración UI → shadcn](#epic-1-migración-ui--shadcn) (4 issues)
2. [Épica: Admin Panel](#epic-2-admin-panel) (5 issues)
3. [Épica: User App Home](#epic-3-user-app-home) (3 issues)
4. [Épica: User App — Accounts](#epic-4-user-app--accounts) (4 issues)
5. [Épica: User App — Settings](#epic-5-user-app--settings) (4 issues)
6. [Épica: Auth](#epic-6-auth) (2 issues)
7. [Épica: Feature Flags & Configuración](#epic-7-feature-flags--configuración) (3 issues)
8. [Épica: Métricas](#epic-8-métricas) (3 issues)

---

## Epic 1: Migración UI → shadcn

### Issue #1: Configurar shadcn/ui y ThemeProvider

**Title:** Configurar shadcn/ui con Tailwind y ThemeProvider (claro/oscuro/sistema)

**Description:**
Instalar y configurar shadcn/ui en el proyecto React con Tailwind CSS. Implementar ThemeProvider global usando `next-themes` con soporte para modo claro, oscuro y sistema (sistema como default).

**Acceptance Criteria:**

- [ ] shadcn/ui instalado y configurado en el proyecto
- [ ] Tailwind configurado con `darkMode: "class"`
- [ ] ThemeProvider global implementado con `next-themes`
- [ ] Temas disponibles: `light`, `dark`, `system`
- [ ] `defaultTheme="system"` configurado
- [ ] Componente `theme-toggle.tsx` creado en `components/layout/`
- [ ] Theme toggle funcional en todas las rutas (admin + user app)

**Labels:** `frontend`, `shadcn`, `ui`, `theme`, `setup`

**Dependencies:** Ninguna (issue inicial)

**Checklist:**

- [ ] Instalar `shadcn/ui` y dependencias
- [ ] Configurar `tailwind.config.js`
- [ ] Crear `ThemeProvider` en layout principal
- [ ] Crear componente `theme-toggle.tsx`
- [ ] Probar en claro/oscuro/sistema
- [ ] Tests para theme switching

---

### Issue #2: Migrar componentes UI caseros a shadcn/ui

**Title:** Auditar y migrar componentes UI caseros (Button, Card, Modal, Input, Table)

**Description:**
Identificar todos los componentes UI caseros existentes (Button, Card, Modal, Input, Table, etc.) y crear plan de migración a equivalentes de shadcn/ui. Marcar componentes para deprecación progresiva.

**Acceptance Criteria:**

- [ ] Inventario completo de componentes UI caseros creado
- [ ] Mapeo 1:1 con componentes shadcn equivalentes documentado
- [ ] Componentes shadcn instalados: `button`, `card`, `dialog`, `input`, `table`, `switch`, `tabs`, `accordion`, `select`, `dropdown-menu`, `toast`, `scroll-area`, `sheet`
- [ ] Al menos 3 componentes caseros migrados como PoC
- [ ] Guía de migración documentada en `docs/ui-migration-guide.md`

**Labels:** `frontend`, `shadcn`, `refactor`, `ui`, `cleanup`

**Dependencies:** #1 (ThemeProvider configurado)

**Checklist:**

- [ ] Ejecutar búsqueda de componentes en `/components/ui` o `/components/common`
- [ ] Instalar componentes shadcn necesarios
- [ ] Migrar Button → `components/ui/button.tsx`
- [ ] Migrar Card → `components/ui/card.tsx`
- [ ] Migrar Modal/Dialog → `components/ui/dialog.tsx`
- [ ] Refactorizar usos y eliminar componentes viejos cuando dejen de usarse

---

### Issue #3: Limpiar estilos globales y CSS legacy

**Title:** Limpiar CSS legacy y mantener solo Tailwind + shadcn styles

**Description:**
Eliminar estilos globales, CSS modules, y styled-components que dupliquen funcionalidad de shadcn/ui. Mantener solo imports de Tailwind y variables de shadcn.

**Acceptance Criteria:**

- [ ] `src/globals.css` o `src/index.css` limpiado (solo Tailwind + shadcn vars)
- [ ] CSS modules identificados y marcados para migración
- [ ] Componentes con `.module.css`, `.scss`, `styled()` inventariados
- [ ] Al menos 50% de estilos legacy eliminados
- [ ] No hay duplicación de colores/tipografías (usar theme de shadcn)

**Labels:** `frontend`, `cleanup`, `css`, `refactor`

**Dependencies:** #2 (componentes shadcn instalados)

**Checklist:**

- [ ] Auditar `src/index.css` o `src/globals.css`
- [ ] Buscar archivos `.module.css`, `.scss`
- [ ] Marcar styled-components para migración
- [ ] Eliminar resets custom y tipografías duplicadas
- [ ] Verificar que no hay colores hardcoded

---

### Issue #4: Crear estructura de layouts (auth, admin, app)

**Title:** Crear layouts base para rutas (auth, admin, user app)

**Description:**
Implementar estructura de layouts según App Router (o equivalente en Vite/CRA): layout minimal para `/login`, layout con sidebar para `/admin`, layout con topbar para `/app`.

**Acceptance Criteria:**

- [ ] Layout `app/(auth)/login/layout.tsx` creado (minimal, sin navegación)
- [ ] Layout `app/(admin)/admin/layout.tsx` creado (sidebar con navegación)
- [ ] Layout `app/(app)/app/layout.tsx` creado (topbar responsive)
- [ ] Layouts responsive (móvil, tablet, desktop)
- [ ] Componentes de navegación creados en `components/layout/`
- [ ] Sheet/Drawer para móvil implementado

**Labels:** `frontend`, `shadcn`, `layout`, `navigation`, `responsive`

**Dependencies:** #1, #2

**Checklist:**

- [ ] Crear `app/(auth)/layout.tsx`
- [ ] Crear `app/(admin)/admin/layout.tsx` con sidebar
- [ ] Crear `app/(app)/app/layout.tsx` con topbar
- [ ] Crear `components/layout/admin-shell.tsx`
- [ ] Crear `components/layout/main-nav.tsx`
- [ ] Crear `components/layout/mobile-nav.tsx`
- [ ] Probar responsive en móvil/tablet/desktop

---

## Epic 2: Admin Panel

### Issue #5: Implementar página de usuarios (/admin/users)

**Title:** Crear tabla de usuarios con búsqueda y acciones CRUD

**Description:**
Implementar página `/admin/users` con tabla de usuarios, búsqueda, y acciones (añadir, editar, borrar, entrar como usuario). Solo metadatos visibles (NO datos sensibles como persona/sponsors).

**Acceptance Criteria:**

- [ ] Ruta `/admin/users` creada
- [ ] Tabla con columnas: Nombre, Email, User ID, Estado (activo/inactivo)
- [ ] Barra de búsqueda funcional (filtro por nombre/email)
- [ ] Dialog para añadir usuario (formulario mínimo)
- [ ] Dialog para editar usuario
- [ ] Acción de borrar con confirmación
- [ ] Botón "Entrar como usuario" (impersonation/redirección a /app)
- [ ] NO mostrar Roastr persona, prompts, sponsors

**Labels:** `frontend`, `admin`, `shadcn`, `crud`, `users`

**Dependencies:** #4 (layout admin creado)

**Checklist:**

- [ ] Crear `app/(admin)/admin/users/page.tsx`
- [ ] Usar `components/ui/table.tsx` de shadcn
- [ ] Implementar búsqueda con `input` de shadcn
- [ ] Crear `components/admin/users-table.tsx`
- [ ] Dialog de añadir con `dialog` de shadcn
- [ ] Dialog de editar
- [ ] Acción de borrar con confirmación
- [ ] Conectar a endpoint `/api/admin/users`

---

### Issue #6: Implementar gestión de feature flags (/admin/config/feature-flags)

**Title:** Crear tabla de feature flags con switches on/off

**Description:**
Implementar página `/admin/config/feature-flags` con tabla de feature flags que permita activar/desactivar flags desde la UI. Persiste cambios en backend.

**Acceptance Criteria:**

- [ ] Ruta `/admin/config/feature-flags` creada
- [ ] Tabla con columnas: Nombre, Descripción, Switch (on/off)
- [ ] Switch funcional usando `components/ui/switch.tsx`
- [ ] Al cambiar switch, llamada a backend para persistir estado
- [ ] Feedback visual (toast) cuando el cambio es exitoso
- [ ] Manejo de errores si el cambio falla

**Labels:** `frontend`, `admin`, `shadcn`, `feature-flags`, `config`

**Dependencies:** #4, #5

**Checklist:**

- [ ] Crear `app/(admin)/admin/config/feature-flags/page.tsx`
- [ ] Usar `components/ui/table.tsx` y `components/ui/switch.tsx`
- [ ] Crear `components/admin/feature-flags-table.tsx`
- [ ] Conectar a endpoint `/api/admin/feature-flags`
- [ ] Implementar toast para feedback
- [ ] Manejo de errores

---

### Issue #7: Implementar configuración de planes y límites (/admin/config/plans)

**Title:** Crear tabla de planes con límites editables y checkboxes de features

**Description:**
Implementar página `/admin/config/plans` con tabla por filas (Starter, Pro, Plus, TrialStarter30d) y columnas editables para límites de análisis/roasts y checkboxes para features (Shield, Roastr persona, Tono original, Sponsors).

**Acceptance Criteria:**

- [ ] Ruta `/admin/config/plans` creada
- [ ] Tabla con filas: Starter, Pro, Plus, TrialStarter30d
- [ ] Columnas: Límite análisis/mes, Límite roasts/mes
- [ ] Checkboxes para: Shield, Roastr persona, Tono original, Sponsors (solo Plus)
- [ ] Inputs editables para límites (números)
- [ ] Persistencia de cambios vía API
- [ ] Feedback visual (toast) al guardar

**Labels:** `frontend`, `admin`, `shadcn`, `billing`, `config`

**Dependencies:** #4, #5

**Checklist:**

- [ ] Crear `app/(admin)/admin/config/plans/page.tsx`
- [ ] Usar `components/ui/table.tsx`, `components/ui/checkbox.tsx`, `components/ui/input.tsx`
- [ ] Crear `components/admin/plan-config-table.tsx`
- [ ] Conectar a endpoint `/api/admin/config/plans`
- [ ] Implementar validación de inputs
- [ ] Manejo de errores

---

### Issue #8: Implementar gestión de tonos (/admin/config/tones)

**Title:** Crear CRUD de tonos con modelo por defecto y prompt base

**Description:**
Implementar página `/admin/config/tones` con lista/tabla de tonos (Flanders, Balanceado, Canalla, NSFW) y acciones para crear, editar, eliminar tonos. Configurar modelo por defecto y prompt base.

**Acceptance Criteria:**

- [ ] Ruta `/admin/config/tones` creada
- [ ] Tabla con tonos: Flanders, Balanceado, Canalla, NSFW (esqueleto)
- [ ] Columnas: Nombre, Descripción, Modelo por defecto, Prompt base
- [ ] Dialog para añadir tono
- [ ] Dialog para editar tono
- [ ] Acción de borrar con confirmación
- [ ] Dropdown para selección de modelo (gateway de modelos)
- [ ] Persistencia de cambios vía API

**Labels:** `frontend`, `admin`, `shadcn`, `tones`, `config`

**Dependencies:** #4, #5

**Checklist:**

- [ ] Crear `app/(admin)/admin/config/tones/page.tsx`
- [ ] Usar `components/ui/table.tsx`, `components/ui/dialog.tsx`, `components/ui/select.tsx`
- [ ] Crear `components/admin/tones-table.tsx`
- [ ] Dialog de añadir/editar con formulario completo
- [ ] Conectar a endpoint `/api/admin/tones`

---

### Issue #9: Implementar panel de métricas (/admin/metrics)

**Title:** Crear dashboard de métricas con totales, ratios y costes

**Description:**
Implementar página `/admin/metrics` con métricas agregadas del backend: análisis totales, roasts totales, usuarios activos, distribución por plan, uso de features, costes. Primera versión solo números y tablas (sin gráficos).

**Acceptance Criteria:**

- [ ] Ruta `/admin/metrics` creada
- [ ] Widgets de totales: Análisis totales, Roasts totales, Usuarios activos
- [ ] Ratios: Análisis medios/usuario, Roasts medios/usuario
- [ ] Distribución % usuarios por plan
- [ ] Uso de features: % con Roastr persona, % con sponsor, % con tono original
- [ ] Costes: Coste medio/análisis, tokens medios/análisis, coste medio/roast, tokens medios/roast
- [ ] Datos obtenidos de endpoint `/api/admin/metrics`
- [ ] Responsive (móvil/tablet/desktop)

**Labels:** `frontend`, `admin`, `shadcn`, `metrics`, `dashboard`

**Dependencies:** #4, #5

**Checklist:**

- [ ] Crear `app/(admin)/admin/metrics/page.tsx`
- [ ] Usar `components/ui/card.tsx` para widgets
- [ ] Crear `components/admin/metrics-overview.tsx`
- [ ] Conectar a endpoint `/api/admin/metrics`
- [ ] Formatear números (separadores de miles, decimales)
- [ ] Diseño responsive

---

## Epic 3: User App Home

### Issue #10: Implementar widgets de análisis (/app)

**Title:** Crear widgets de consumo de análisis y roasts del mes

**Description:**
Implementar dos widgets en `/app` (Home) que muestren consumo de análisis y roasts del mes con barras de progreso (consumidos/disponibles según plan).

**Acceptance Criteria:**

- [ ] Ruta `/app` creada (Home)
- [ ] Widget 1: "Análisis este mes" con X/Y y porcentaje
- [ ] Widget 2: "Roasts este mes" con X/Y y porcentaje
- [ ] Barras o círculos de progreso visuales
- [ ] Datos obtenidos de endpoint `/api/usage/current`
- [ ] Responsive (móvil/tablet/desktop)

**Labels:** `frontend`, `user-app`, `shadcn`, `widgets`, `usage`

**Dependencies:** #4 (layout app creado)

**Checklist:**

- [ ] Crear `app/(app)/app/page.tsx`
- [ ] Usar `components/ui/card.tsx`, `components/ui/progress.tsx`
- [ ] Crear `components/app/home/usage-widgets.tsx`
- [ ] Conectar a endpoint `/api/usage/current`
- [ ] Diseño responsive

---

### Issue #11: Implementar bloque de redes disponibles (/app)

**Title:** Crear bloque de conexión de redes sociales con OAuth

**Description:**
Implementar bloque en `/app` con botones para conectar redes sociales (X, Instagram, etc.). Mostrar ratio cuentas_actuales/máximo_por_plan y deshabilitar botón si se alcanzó el máximo. Manejar flujo OAuth.

**Acceptance Criteria:**

- [ ] Bloque de redes disponibles visible en `/app`
- [ ] Botones por red social con texto "X/Y" (cuentas actuales/máximo)
- [ ] Botones deshabilitados si usuario alcanzó máximo del plan
- [ ] Al pulsar botón: llamada a backend para iniciar OAuth
- [ ] Manejo de callback de éxito y actualización de lista
- [ ] Mensaje de confirmación: "Cuenta conectada correctamente"

**Labels:** `frontend`, `user-app`, `shadcn`, `oauth`, `integrations`

**Dependencies:** #4, #10

**Checklist:**

- [ ] Crear `components/app/home/connect-network-card.tsx`
- [ ] Usar `components/ui/button.tsx`, `components/ui/card.tsx`
- [ ] Conectar a endpoint `/api/accounts/connect/:platform`
- [ ] Manejar OAuth redirect y callback
- [ ] Actualizar estado tras conexión exitosa
- [ ] Toast de confirmación

---

### Issue #12: Implementar tabla de cuentas conectadas (/app)

**Title:** Crear tabla de cuentas conectadas con stats y navegación a detalle

**Description:**
Implementar tabla en `/app` con todas las cuentas conectadas del usuario. Mostrar red social, handle, estado, roasts emitidos, intercepciones shield. Toda la fila clickable para navegar a `/app/accounts/[accountId]`.

**Acceptance Criteria:**

- [ ] Tabla de cuentas conectadas visible en `/app`
- [ ] Columnas: Icono+red social, Handle, Estado, Roasts emitidos, Intercepciones shield
- [ ] Filas clickables que navegan a `/app/accounts/[accountId]`
- [ ] Datos obtenidos de endpoint `/api/accounts`
- [ ] Responsive (en móvil: scroll horizontal o tarjetas)

**Labels:** `frontend`, `user-app`, `shadcn`, `accounts`, `table`

**Dependencies:** #4, #10

**Checklist:**

- [ ] Crear `components/app/home/accounts-table.tsx`
- [ ] Usar `components/ui/table.tsx`
- [ ] Conectar a endpoint `/api/accounts`
- [ ] Implementar navegación a detalle (onClick)
- [ ] Diseño responsive

---

## Epic 4: User App — Accounts

### Issue #13: Implementar header y widgets de detalle de cuenta (/app/accounts/[id])

**Title:** Crear header de cuenta con red social, estado y stats

**Description:**
Implementar página de detalle de cuenta `/app/accounts/[accountId]` con header mostrando red social, handle, estado, y widgets de stats (roasts, shield, etc.).

**Acceptance Criteria:**

- [ ] Ruta `/app/accounts/[accountId]` creada
- [ ] Header con red social, handle y estado
- [ ] Widgets de stats: roasts emitidos, intercepciones shield
- [ ] Datos obtenidos de endpoint `/api/accounts/:id`
- [ ] Responsive

**Labels:** `frontend`, `user-app`, `shadcn`, `accounts`, `detail`

**Dependencies:** #12 (navegación desde tabla)

**Checklist:**

- [ ] Crear `app/(app)/app/accounts/[accountId]/page.tsx`
- [ ] Crear `components/app/accounts/account-header.tsx`
- [ ] Usar `components/ui/card.tsx` para widgets
- [ ] Conectar a endpoint `/api/accounts/:id`

---

### Issue #14: Implementar dialog de settings de cuenta

**Title:** Crear dialog de configuración de cuenta (aprobación, shield, tono)

**Description:**
Implementar dialog de settings en detalle de cuenta con toggle de aprobación automática, selector de nivel de Shield, selector de tono por defecto, y preview de roast con ese tono.

**Acceptance Criteria:**

- [ ] Botón "Settings" en header de cuenta
- [ ] Dialog con configuración de cuenta
- [ ] Toggle: Aprobación automática de roasts
- [ ] Texto legal: "Los roasts autopublicados indicarán que son generados por IA"
- [ ] Selector de nivel de Shield (dropdown)
- [ ] Selector de tono por defecto (dropdown)
- [ ] Preview de ejemplo de roast con tono seleccionado
- [ ] Toggle/select: Pausar cuenta
- [ ] Persistencia vía API

**Labels:** `frontend`, `user-app`, `shadcn`, `accounts`, `settings`

**Dependencies:** #13

**Checklist:**

- [ ] Crear `components/app/accounts/account-settings-dialog.tsx`
- [ ] Usar `components/ui/dialog.tsx`, `components/ui/switch.tsx`, `components/ui/select.tsx`
- [ ] Conectar a endpoint `/api/accounts/:id/settings`
- [ ] Implementar preview de roast

---

### Issue #15: Implementar tabla de roasts de la cuenta

**Title:** Crear tabla de roasts del mes con aprobación manual

**Description:**
Implementar tabla en detalle de cuenta con roasts del mes. Si aprobación manual está activa, mostrar botones para regenerar, descartar y enviar roast.

**Acceptance Criteria:**

- [ ] Tabla de roasts del mes visible
- [ ] Columnas: Comentario original, Roast emitido
- [ ] Si aprobación manual: botones Regenerar, Descartar, Enviar
- [ ] Botones funcionales con llamadas a API
- [ ] Datos obtenidos de endpoint `/api/accounts/:id/roasts`
- [ ] Responsive

**Labels:** `frontend`, `user-app`, `shadcn`, `roasts`, `table`

**Dependencies:** #13

**Checklist:**

- [ ] Crear `components/app/accounts/roasts-table.tsx`
- [ ] Usar `components/ui/table.tsx`, `components/ui/button.tsx`
- [ ] Conectar a endpoint `/api/accounts/:id/roasts`
- [ ] Implementar acciones: regenerar, descartar, enviar
- [ ] Manejo de errores

---

### Issue #16: Implementar acordeón de Shield

**Title:** Crear acordeón de Shield con tabla de comentarios interceptados

**Description:**
Implementar acordeón "Shield" en detalle de cuenta (cerrado por defecto) con estado del shield y tabla de comentarios interceptados con acciones tomadas.

**Acceptance Criteria:**

- [ ] Acordeón "Shield" cerrado por defecto
- [ ] Dentro: estado del Shield (activo/pausado/inactivo)
- [ ] Tabla de comentarios interceptados
- [ ] Columnas: Comentario interceptado, Acción (bloquear/ocultar/suavizar)
- [ ] Botón "Ver comentario" que navega al comentario original
- [ ] Datos obtenidos de endpoint `/api/accounts/:id/shield`

**Labels:** `frontend`, `user-app`, `shadcn`, `shield`, `accordion`

**Dependencies:** #13

**Checklist:**

- [ ] Crear `components/app/accounts/shield-accordion.tsx`
- [ ] Usar `components/ui/accordion.tsx`, `components/ui/table.tsx`
- [ ] Conectar a endpoint `/api/accounts/:id/shield`
- [ ] Implementar navegación a comentario original

---

## Epic 5: User App — Settings

### Issue #17: Implementar navegación por tabs en Settings

**Title:** Crear estructura de tabs para /app/settings (Cuenta, Ajustes, Billing)

**Description:**
Implementar navegación por tabs en `/app/settings` con 3 tabs: Cuenta, Ajustes, Billing. Base para las páginas de configuración.

**Acceptance Criteria:**

- [ ] Ruta `/app/settings` creada con tabs
- [ ] Tabs: Cuenta, Ajustes, Billing
- [ ] Navegación funcional entre tabs
- [ ] Responsive (móvil/tablet/desktop)

**Labels:** `frontend`, `user-app`, `shadcn`, `settings`, `navigation`

**Dependencies:** #4 (layout app creado)

**Checklist:**

- [ ] Crear `app/(app)/app/settings/page.tsx`
- [ ] Usar `components/ui/tabs.tsx`
- [ ] Crear subrutas: `/app/settings/account`, `/app/settings/preferences`, `/app/settings/billing`

---

### Issue #18: Implementar tab de Cuenta (/app/settings/account)

**Title:** Crear tab de cuenta con email, cambiar contraseña, GDPR y logout

**Description:**
Implementar tab "Cuenta" en `/app/settings` con email del usuario, botón de cambiar contraseña (dispara reset por email), botón de descargar datos (GDPR), y logout.

**Acceptance Criteria:**

- [ ] Tab "Cuenta" visible en `/app/settings`
- [ ] Mostrar email del usuario (no editable)
- [ ] Botón "Cambiar contraseña" → llama a backend para reset por email
- [ ] Botón "Descargar mis datos" → endpoint GDPR
- [ ] Botón "Logout" funcional
- [ ] Feedback visual (toast) tras acciones

**Labels:** `frontend`, `user-app`, `shadcn`, `settings`, `auth`

**Dependencies:** #17

**Checklist:**

- [ ] Crear `app/(app)/app/settings/account/page.tsx`
- [ ] Crear `components/app/settings/account-settings-form.tsx`
- [ ] Conectar a endpoints: `/api/auth/reset-password`, `/api/gdpr/export`, `/api/auth/logout`
- [ ] Implementar toast de confirmación

---

### Issue #19: Implementar tab de Ajustes (/app/settings/preferences)

**Title:** Crear tab de ajustes con Roastr persona, transparencia y sponsor

**Description:**
Implementar tab "Ajustes" en `/app/settings` con campos de Roastr persona (bio, tono, preferencias), copy de transparencia, prompt de estilo personalizado (solo Pro/Plus con feature flag), y configuración de Sponsor (solo Plus).

**Acceptance Criteria:**

- [ ] Tab "Ajustes" visible en `/app/settings`
- [ ] Campos de Roastr persona: bio, tono, preferencias
- [ ] Copy explicando transparencia (roasts firmados como IA)
- [ ] Prompt de estilo personalizado visible solo si: Plan Pro/Plus + feature flag ON
- [ ] Configuración de Sponsor visible solo si: Plan Plus
- [ ] Persistencia vía API
- [ ] Feedback visual (toast)

**Labels:** `frontend`, `user-app`, `shadcn`, `settings`, `persona`, `sponsor`

**Dependencies:** #17

**Checklist:**

- [ ] Crear `app/(app)/app/settings/preferences/page.tsx`
- [ ] Crear `components/app/settings/persona-settings-form.tsx`
- [ ] Crear `components/app/settings/sponsor-settings-form.tsx`
- [ ] Conectar a endpoints: `/api/persona`, `/api/sponsor`
- [ ] Implementar lógica de visibilidad por plan + feature flag

---

### Issue #20: Implementar tab de Billing (/app/settings/billing)

**Title:** Crear tab de billing con método de pago, plan activo y acciones

**Description:**
Implementar tab "Billing" en `/app/settings` con método de pago actual, info del plan activo, fecha del próximo cobro, botones de upgrade y cancelación. Mostrar copy especial si el usuario canceló.

**Acceptance Criteria:**

- [ ] Tab "Billing" visible en `/app/settings`
- [ ] Mostrar método de pago actual (últimos 4 dígitos)
- [ ] Info del plan: nombre, fecha del próximo cobro
- [ ] Si plan cancelado: "Roastr.AI estará activo hasta [fecha]"
- [ ] Botón "Upgrade plan" → navegación a planes
- [ ] Botón "Cancelar suscripción" → confirmación y llamada a API
- [ ] Datos obtenidos de endpoint `/api/billing`

**Labels:** `frontend`, `user-app`, `shadcn`, `settings`, `billing`, `subscription`

**Dependencies:** #17

**Checklist:**

- [ ] Crear `app/(app)/app/settings/billing/page.tsx`
- [ ] Crear `components/app/settings/billing-panel.tsx`
- [ ] Conectar a endpoint `/api/billing`
- [ ] Implementar confirmación de cancelación con dialog
- [ ] Manejo de errores

---

## Epic 6: Auth

### Issue #21: Implementar página de login (/login)

**Title:** Crear página de login con email/password y magic link

**Description:**
Implementar página `/login` con formulario de email + contraseña y opción de magic link. Tras autenticación, redirigir a `/admin/users` si es admin, o a `/app` si no.

**Acceptance Criteria:**

- [ ] Ruta `/login` creada
- [ ] Formulario con email y password
- [ ] Botón "Envíame un magic link" (opcional)
- [ ] Al enviar: llamada a backend para autenticación
- [ ] Si `isAdmin === true` → redirect a `/admin/users`
- [ ] Si no → redirect a `/app`
- [ ] Manejo de errores (credenciales incorrectas)
- [ ] Responsive

**Labels:** `frontend`, `auth`, `shadcn`, `login`

**Dependencies:** #1, #4 (layout auth creado)

**Checklist:**

- [ ] Crear `app/(auth)/login/page.tsx`
- [ ] Usar `components/ui/input.tsx`, `components/ui/button.tsx`, `components/ui/card.tsx`
- [ ] Conectar a endpoint `/api/auth/login`
- [ ] Implementar lógica de redirección
- [ ] Manejo de errores con toast

---

### Issue #22: Implementar capa de cliente API y auth provider

**Title:** Crear capa de cliente API centralizada y auth provider

**Description:**
Crear capa de cliente API en `/lib/api` con funciones tipadas para todos los endpoints. Implementar auth provider global para gestión de sesión.

**Acceptance Criteria:**

- [ ] Carpeta `/lib/api` creada
- [ ] Clientes API para: Auth, Usuarios, Feature flags, Planes, Tonos, Métricas, Cuentas, Roasts, Shield, Billing
- [ ] Auth provider global implementado
- [ ] Manejo centralizado de tokens/sesión
- [ ] Interceptors para manejo de errores 401/403
- [ ] Uso consistente de SWR/React Query o fetch

**Labels:** `frontend`, `auth`, `api`, `infra`

**Dependencies:** Ninguna (puede hacerse en paralelo)

**Checklist:**

- [ ] Crear `/lib/api/auth.ts`
- [ ] Crear `/lib/api/users.ts`
- [ ] Crear `/lib/api/feature-flags.ts`
- [ ] Crear `/lib/api/plans.ts`
- [ ] Crear `/lib/api/tones.ts`
- [ ] Crear `/lib/api/metrics.ts`
- [ ] Crear `/lib/api/accounts.ts`
- [ ] Crear `/lib/api/roasts.ts`
- [ ] Crear `/lib/api/shield.ts`
- [ ] Crear `/lib/api/billing.ts`
- [ ] Crear `/lib/auth/provider.tsx`
- [ ] Implementar interceptors

---

## Epic 7: Feature Flags & Configuración

### Issue #23: Conectar feature flags a contexto global

**Title:** Crear contexto global de feature flags y hook useFeatureFlag

**Description:**
Implementar contexto React para feature flags que se sincronice con backend y permita verificar flags desde cualquier componente con hook `useFeatureFlag`.

**Acceptance Criteria:**

- [ ] Contexto `FeatureFlagsProvider` creado
- [ ] Hook `useFeatureFlag(flagName)` implementado
- [ ] Sincronización con endpoint `/api/feature-flags` al cargar app
- [ ] Cache de flags en memoria
- [ ] Refresco periódico (opcional)

**Labels:** `frontend`, `feature-flags`, `infra`, `context`

**Dependencies:** #22 (capa API creada)

**Checklist:**

- [ ] Crear `/lib/context/feature-flags.tsx`
- [ ] Crear hook `useFeatureFlag`
- [ ] Conectar a endpoint `/api/feature-flags`
- [ ] Integrar en `app/layout.tsx`

---

### Issue #24: Implementar lógica de visibilidad por plan

**Title:** Crear hook usePlanFeatures y lógica de visibilidad condicional

**Description:**
Implementar hook `usePlanFeatures` que devuelva features disponibles según plan del usuario (Starter, Pro, Plus). Usar para mostrar/ocultar elementos de UI condicionalmente.

**Acceptance Criteria:**

- [ ] Hook `usePlanFeatures` creado
- [ ] Devuelve: `hasShield`, `hasPersona`, `hasToneOriginal`, `hasSponsor`
- [ ] Lógica según plan del usuario (obtenido de auth context)
- [ ] Usado en: Ajustes (prompt personalizado, sponsor), detalle de cuenta

**Labels:** `frontend`, `billing`, `infra`, `plans`

**Dependencies:** #22 (auth provider)

**Checklist:**

- [ ] Crear `/lib/hooks/usePlanFeatures.ts`
- [ ] Conectar a auth context para obtener plan
- [ ] Implementar lógica de features por plan
- [ ] Integrar en componentes de ajustes

---

### Issue #25: Implementar guards de rutas (admin, auth)

**Title:** Crear guards de rutas para proteger /admin y /app

**Description:**
Implementar guards de rutas que verifiquen autenticación y rol de usuario. Proteger `/admin` (solo admin), `/app` (solo autenticados), redirigir a `/login` si no autenticado.

**Acceptance Criteria:**

- [ ] Guard de autenticación implementado (verifica sesión)
- [ ] Guard de admin implementado (verifica `isAdmin`)
- [ ] Rutas `/admin/*` protegidas con guard de admin
- [ ] Rutas `/app/*` protegidas con guard de autenticación
- [ ] Redirección a `/login` si no autenticado
- [ ] Redirección a `/app` si usuario no admin intenta acceder a `/admin`

**Labels:** `frontend`, `auth`, `infra`, `guards`

**Dependencies:** #22 (auth provider)

**Checklist:**

- [ ] Crear `/lib/guards/auth-guard.tsx`
- [ ] Crear `/lib/guards/admin-guard.tsx`
- [ ] Integrar en layouts de `/admin` y `/app`
- [ ] Probar redirecciones

---

## Epic 8: Métricas

### Issue #26: Implementar endpoint de métricas agregadas (backend)

**Title:** Crear endpoint /api/admin/metrics con métricas agregadas

**Description:**
Implementar endpoint en backend que devuelva métricas agregadas: análisis totales, roasts totales, usuarios activos, distribución por plan, uso de features, costes.

**Acceptance Criteria:**

- [ ] Endpoint `/api/admin/metrics` creado
- [ ] Devuelve: análisis totales, roasts totales, usuarios activos
- [ ] Devuelve: análisis medios/usuario, roasts medios/usuario
- [ ] Devuelve: % usuarios por plan
- [ ] Devuelve: % uso de features (persona, sponsor, tono original)
- [ ] Devuelve: coste medio/análisis, tokens medios/análisis
- [ ] Devuelve: coste medio/roast, tokens medios/roast
- [ ] Solo accesible por admin
- [ ] Tests de integración

**Labels:** `backend`, `admin`, `metrics`, `api`

**Dependencies:** Ninguna (puede hacerse en paralelo)

**Checklist:**

- [ ] Crear `/src/routes/admin/metrics.js`
- [ ] Implementar queries agregadas en DB
- [ ] Agregar control de acceso (solo admin)
- [ ] Tests de integración

---

### Issue #27: Implementar endpoint de uso actual del usuario (backend)

**Title:** Crear endpoint /api/usage/current con consumo del mes

**Description:**
Implementar endpoint en backend que devuelva consumo actual del usuario del mes: análisis consumidos/disponibles, roasts consumidos/disponibles.

**Acceptance Criteria:**

- [ ] Endpoint `/api/usage/current` creado
- [ ] Devuelve: análisis consumidos, análisis disponibles (según plan)
- [ ] Devuelve: roasts consumidos, roasts disponibles (según plan)
- [ ] Solo accesible por usuario autenticado
- [ ] Tests de integración

**Labels:** `backend`, `user-app`, `usage`, `api`

**Dependencies:** Ninguna (puede hacerse en paralelo)

**Checklist:**

- [ ] Crear `/src/routes/usage/current.js`
- [ ] Implementar query para consumo del mes
- [ ] Obtener límites desde plan del usuario
- [ ] Tests de integración

---

### Issue #28: Implementar formateo de métricas y números en UI

**Title:** Crear utilidades de formateo de números y métricas

**Description:**
Crear funciones de utilidad para formateo de números (separadores de miles, decimales, porcentajes, moneda) y usarlas en widgets de métricas y uso.

**Acceptance Criteria:**

- [ ] Utilidades de formateo creadas en `/lib/utils/format.ts`
- [ ] Funciones: `formatNumber`, `formatCurrency`, `formatPercentage`, `formatDecimal`
- [ ] Usadas en: widgets de análisis, métricas de admin
- [ ] Tests unitarios para utilidades

**Labels:** `frontend`, `ui`, `utils`

**Dependencies:** Ninguna (puede hacerse en paralelo)

**Checklist:**

- [ ] Crear `/lib/utils/format.ts`
- [ ] Implementar `formatNumber` (separadores de miles)
- [ ] Implementar `formatCurrency` (€ / $)
- [ ] Implementar `formatPercentage` (%)
- [ ] Implementar `formatDecimal` (2 decimales)
- [ ] Tests unitarios
- [ ] Integrar en componentes

---

## 📊 Resumen de Dependencies

**Issues sin dependencias (pueden iniciarse en paralelo):**

- #1: Configurar shadcn/ui y ThemeProvider
- #22: Implementar capa de cliente API
- #26: Endpoint de métricas agregadas (backend)
- #27: Endpoint de uso actual (backend)
- #28: Utilidades de formateo

**Issues bloqueantes (muchos dependen de estos):**

- #1: ThemeProvider (bloquea #2, #3, #21)
- #2: Componentes shadcn (bloquea #3, #4)
- #4: Layouts (bloquea toda implementación de UI)
- #22: Capa API (bloquea #23, #24, #25)

---

## 🎯 Sugerencia de Orden de Implementación

**Sprint 1: Fundamentos (Issues #1, #2, #3, #4, #21, #22)**

- Configurar shadcn + ThemeProvider
- Migrar componentes base
- Crear layouts
- Login + capa API

**Sprint 2: Admin Panel (Issues #5, #6, #7, #8, #9)**

- Implementar todas las páginas de admin

**Sprint 3: User App Home (Issues #10, #11, #12, #23, #24, #25, #26, #27, #28)**

- Implementar home de usuario
- Feature flags + guards
- Endpoints de backend

**Sprint 4: User App Accounts (Issues #13, #14, #15, #16)**

- Implementar detalle de cuenta y roasts

**Sprint 5: User App Settings (Issues #17, #18, #19, #20)**

- Implementar configuración de usuario

---

**Total: 28 Issues**
**Épicas: 8**
**Estimación: 5-6 sprints (10-12 semanas)**

---

_Este documento debe ser usado como base para crear los Issues en GitHub. Cada issue puede ser copiado y pegado directamente en la UI de GitHub Issues._
