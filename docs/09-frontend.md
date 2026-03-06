# 9. Panel de Usuario — Frontend (v3)

*(Versión actualizada para Shield-first, React + Vite, shadcn/ui)*

## 9.1 Stack y principios

- **React 19** + TypeScript estricto
- **Vite** como bundler
- **shadcn/ui** + Tailwind CSS
- **Radix primitives** (accesibilidad base)
- **React Query (TanStack Query)** para data fetching
- **React Router** para navegación
- **next-themes** para tema claro/oscuro/sistema
- **Mobile-first design**

### Normas

- Tema por defecto: **Sistema** (alternativas: Claro / Oscuro)
- Skeletons, loaders y alerts → componentes shadcn
- Estados vacíos → cards específicas por sección
- Tablas → accordions en móvil
- Todo dato dinámico viene de la API (nunca hardcoded)
- Auth via Supabase client directo (`supabase.auth.*`)
- Data fetching via API del backend NestJS (React Query)

---

## 9.2 Rutas

### User App (MVP)

```
/                         → redirect a /dashboard
/login                    → Login (email + password)
/register                 → Signup + selección de plan
/onboarding               → Wizard multi-paso
/dashboard                → Home con widgets y cuentas
/accounts                 → Lista de cuentas conectadas
/accounts/:id             → Detalle de cuenta (roasts, shield, settings)
/settings/profile         → Email, password, descargar datos, logout
/settings/persona         → Roastr Persona (3 campos cifrados)
/settings/billing         → Plan activo, upgrade, cancelar, método de pago
```

### Admin Panel — Phase 2

```
/admin/users              → Tabla de usuarios
/admin/users/:id          → Detalle + impersonación
/admin/settings/flags     → Feature flags
/admin/settings/plans     → Edición de planes
/admin/settings/tones     → Edición de tonos
/admin/metrics            → Métricas de uso y negocio
```

> **MVP:** No se implementa Admin Panel. Gestión via Supabase Dashboard.

---

## 9.3 Dashboard (Home)

### Widgets superiores

**Widget de Análisis:**

- Barra de progreso: `{{used}} / {{limit}} análisis`
- Color: azul (normal) → amarillo (>80%) → rojo (limit reached)
- Si agotados: badge "Análisis agotados" + bloque:
  > "Has alcanzado tus análisis mensuales. Sube de plan para continuar."
  - Botón "Mejorar Plan"

**Widget de Shield:**

- Intercepciones este mes (moderado + crítico)
- Badge con estado: activo / OFF (si análisis agotados)

**Widget de Roasts (si módulo activo):**

- Barra de progreso: `{{used}} / {{limit}} roasts`
- Si roasts agotados pero análisis no:
  > "Puedes seguir protegido por el Shield aunque ya no puedas generar roasts."

### Tabla de cuentas conectadas

| Columna | Contenido |
|---|---|
| Plataforma | Icono (YouTube / X) |
| Handle | @username |
| Estado | Badge: active 🟢 / paused 🟡 / inactive 🔴 |
| Shield este mes | Nº intercepciones |
| Roasts este mes | Nº roasts (si módulo activo) |

Fila completa es link a `/accounts/:id`.

### Añadir cuenta

Cards por plataforma (YouTube, X) con botón:

- "Conectar cuenta (0/1)" → Starter
- "Conectar cuenta (1/2)" → Pro/Plus

Si límite alcanzado → botón disabled con tooltip "Límite de cuentas alcanzado".

---

## 9.4 Detalle de cuenta (`/accounts/:id`)

### Header

- Icono de plataforma + handle + badge de estado
- Botón "Settings" (abre modal/sheet)

### Resumen (widgets)

- Análisis usados por esta cuenta
- Intercepciones Shield
- Roasts generados (si módulo activo)
- Estado auto-approve

### Shield Log

Tabla/acordeón con:

| Campo | Contenido |
|---|---|
| Fecha | Timestamp |
| Acción | Badge: hide / block / report / strike1 |
| Severidad | Score numérico |
| Red line | Si matcheó una línea roja |
| Link | "Ver en plataforma" (si disponible) |

Histórico: máximo 90 días (GDPR).

### Roasts (si módulo activo)

Tabla con:

| Campo | Contenido |
|---|---|
| Comentario | Texto truncado del original |
| Estado | published / pending / discarded / blocked |
| Fecha | Timestamp |
| Acciones | Enviar / Regenerar / Descartar |

### Settings (modal)

- **Auto-approve** ON/OFF con texto legal de transparencia
- **Pausar cuenta** toggle
- **Shield aggressiveness:** selector 90% / 95% / 98% / 100%
- **Tono** (si Roasting activo): flanders / balanceado / canalla / personal (Pro/Plus)

---

## 9.5 Settings del usuario

### Profile (`/settings/profile`)

- Email (read-only, mostrado)
- Cambiar contraseña
- Idioma preferido
- Descargar mis datos (GDPR export)
- Eliminar cuenta (con confirmación doble)
- Logout

### Roastr Persona (`/settings/persona`)

Tres campos de texto (máx 200 chars cada uno):

1. **Lo que me define** — identidades personales
2. **Lo que no tolero** — líneas rojas
3. **Lo que me da igual** — tolerancias

- Cifrado (AES-256-GCM), invisible para admins
- No se puede borrar (solo editar o vaciar campos)
- Obligatorio configurar durante onboarding

### Billing (`/settings/billing`)

- Plan activo con badge
- Uso del mes (análisis + roasts)
- Próximo cobro y fecha
- Si cancelado: "Roastr seguirá activo hasta el {{current_period_end}}."
- Botones: Upgrade / Cancelar / Editar método de pago
- Redirect a Polar para gestión de pago

---

## 9.6 Onboarding wizard

Se activa automáticamente en primera sesión. Se reanuda donde se quedó.

### Pasos

1. **welcome** — Introducción a Roastr
2. **select_plan** — Elección Starter / Pro / Plus con comparativa
3. **payment** — Checkout Polar (método de pago obligatorio)
4. **persona_setup** — Configurar Roastr Persona (obligatorio)
5. **connect_accounts** — Conectar al menos 1 cuenta (YouTube o X)
6. **done** — Redirect a dashboard

Estado persistido en `profiles.onboarding_state`. Se lee en cada login.

---

## 9.7 Estados de UI

| Estado | Componente | Comportamiento |
|---|---|---|
| Empty | Card con CTA | "Añadir cuenta" / "Aún no hay roasts" / "Sin intercepciones" |
| Loading | Skeleton (shadcn) | Shimmer en cada widget/tabla |
| Error | Alert con retry | "Error al cargar. Reintentar" |
| Paused | Badge + explicación | "Cuenta pausada — [motivo]" |
| Inactive | Badge + CTA | "Reconectar cuenta" |
| Limit reached | Badge rojo + upgrade CTA | "Análisis agotados — Mejorar plan" |

---

## 9.8 Componentes reutilizables

- `UsageBar` — barra de progreso con color dinámico
- `StatusBadge` — badge de estado (active/paused/inactive)
- `ShieldActionBadge` — badge de acción (hide/block/report/strike)
- `AccountCard` — card de cuenta conectada
- `WidgetCard` — card genérica para KPIs
- `Modal` / `Sheet` — modal en desktop, sheet en móvil
- `DataTable` — tabla con sorting (shadcn table)
- `AccordionTable` — versión móvil de DataTable

---

## 9.9 Responsive

| Viewport | Layout |
|---|---|
| Desktop (≥1024px) | 2-3 columnas, tablas, modales |
| Tablet (768-1023px) | 2 columnas, tablas compactas |
| Mobile (<768px) | 1 columna, cards apiladas, accordions, sheets |

---

## 9.10 Accesibilidad

- Roles ARIA via Radix primitives
- `focus-visible` en todos los interactivos
- Contraste WCAG AA mínimo en ambos temas
- Texto legible en dark/light
- Accesibilidad avanzada (AAA, screen reader full support) → Phase 2

---

## 9.11 Temas

- Claro / Oscuro / Sistema (default)
- Implementado con `next-themes`
- CSS variables en `:root` y `.dark`
- Persistencia via `localStorage`

---

## 9.12 Seguridad UI

- Nunca mostrar prompts internos ni configuración SSOT
- Roastr Persona cifrado, invisible para admins (incluso en impersonación Phase 2)
- Tokens OAuth nunca expuestos al frontend
- XSS prevention: React escapa por defecto, inputs sanitizados
- CSRF: Supabase Auth maneja tokens via httpOnly cookies o bearer tokens

---

## 9.13 Dependencias

- **Supabase Auth:** Login, signup, session management directo desde frontend.
- **Backend API (NestJS):** Todos los datos de negocio (cuentas, shield logs, roasts, billing).
- **Polar:** Redirect para checkout y gestión de pago.
- **SSOT (via API):** Límites, textos, flags — el frontend lee, nunca escribe.
