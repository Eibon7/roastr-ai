# 📦 Changelog

## [Unreleased]

### ✨ Added
- **Shield Settings Configuration (Issue #362)**: Complete shield threshold configuration system
  - **Backend API**: GET/POST `/api/settings/shield` endpoints with organization and platform-specific settings
  - **Database Schema**: New organization_settings and platform_settings tables with RLS
  - **Aggressiveness Presets**: 90% (Conservative), 95% (Balanced), 98% (Aggressive), 100% (Maximum)
  - **Technical Thresholds**: τ_roast_lower, τ_shield, τ_critical with validation rules
  - **Validation**: Ensures 0 ≤ τ_roast_lower < τ_shield < τ_critical ≤ 1 constraints
  - **ShieldDecisionEngine Integration**: Dynamic threshold loading from database settings

### 🎨 Frontend Components
- **InfoTooltip Component**: Accessible tooltip system with keyboard navigation and ARIA support
- **ThresholdSlider Component**: Dual slider/input interface with real-time validation and percentage conversion
- **ShieldSettings Component**: Complete configuration panel with preset management and validation feedback
- **Real-time Validation**: Immediate error feedback for invalid threshold configurations
- **Accessibility**: Full ARIA compliance, keyboard navigation, and screen reader support

### 🧪 Testing
- **Comprehensive Test Suite**: 74 tests covering unit, integration, and accessibility scenarios
- **Component Testing**: InfoTooltip (13 tests), ThresholdSlider (20 tests), ShieldSettings (41 tests)
- **Validation Testing**: All edge cases for threshold ordering and range constraints
- **Performance Testing**: Rapid input handling and state synchronization validation
- **Accessibility Testing**: Full keyboard navigation and screen reader compliance

### 🔧 Fixed
- **Playwright MCP Server**: Corregido el servidor MCP para cumplir con el protocolo JSON-RPC 2.0
  - Implementada correcta inicialización y handshake del protocolo MCP
  - Añadido soporte completo para métodos: `initialize`, `tools/list`, `tools/call`, `shutdown`
  - Corregida estructura de respuestas JSON-RPC con campos requeridos
  - Mejorado manejo de errores con códigos estándar JSON-RPC
  - Añadidos logs detallados con prefijo `[MCP]` para debugging
  - Validación de requests entrantes según especificación JSON-RPC 2.0

### 📝 Documentación
- **Shield Settings Documentation**: Complete implementation guide in spec.md
- **Test Evidence**: Comprehensive test evidence report in docs/test-evidence/
- **MCP Usage**: El servidor Playwright MCP ahora funciona correctamente con Claude
  - Configuración en `~/.config/claude/mcp.json` apuntando a `playwright-mcp-server.js`
  - Tools disponibles: `browse`, `screenshot`, `inspect`, `visual_test`, `multi_viewport_test`, `check_console`
  - Cada tool incluye JSON Schema completo para validación de parámetros

## v0.8.0 – 2025-08-08

**Descripción:** V1 Pilot Hardening - Sistema completo backend/infra listo con billing Stripe, integraciones mock, seguridad hardening, CI/CD, y feature flags. Todo backend operativo para launch del piloto.

---

### 🏗️ Pilot Infrastructure Ready

#### 🎛️ Feature Flags System Centralizado
- **Central Configuration**: Sistema unificado en `src/config/flags.js` con 15+ flags
- **Graceful Degradation**: Detección automática de claves faltantes → modo mock seguro
- **Service Status**: API endpoints muestran estado de servicios (disponible/mock/unavailable)
- **Runtime Switching**: Flags permiten activar/desactivar funcionalidades sin redeploy

#### 💳 Stripe Billing System (Production Ready)
- **Multi-Plan Support**: Free, Pro ($20/mo), Creator+ ($50/mo) con feature gating
- **Webhook Processing**: Manejo completo de eventos Stripe con verificación de firmas
- **Customer Portal**: Integración completa para gestión de subscriptions
- **Plan Gating**: Middleware `requirePlan()` aplicado en rutas sensibles
- **Degradación Segura**: Modo "billing unavailable" cuando faltan claves

#### 🔌 Mock-Ready Integrations con Persistencia
- **9 Platform Support**: Twitter, YouTube, Instagram, Facebook, Discord, Twitch, Reddit, TikTok, Bluesky
- **Persistent Mocking**: Storage cifrado local + database fallback para integraciones
- **OAuth Simulation**: Flujo completo mock para testing UX sin claves reales
- **API Consistency**: Interfaz idéntica para servicios reales vs mock

#### 🛡️ Security Hardening Completo
- **Helmet Integration**: CSP, HSTS, security headers configurados
- **CORS Strict**: Whitelist de orígenes permitidos con logging de rechazos
- **Rate Limiting**: 3 niveles (general 100/15min, auth 10/15min, billing 20/15min)
- **Input Sanitization**: XSS protection en todos los inputs
- **Request Logging**: Audit trail completo con duración y metadata

#### 📊 Audit Trail y Logging
- **Event Types**: 15+ tipos de eventos críticos (auth, billing, integrations, system)
- **Dual Storage**: Database + file fallback para máxima confiabilidad
- **Security Events**: Rate limits, failed auth, webhook failures, etc.
- **Admin Dashboard Ready**: APIs para mostrar logs filtrados por tipo/fecha

#### 🏁 RQC Feature Flags y Orquestación
- **Global Toggle**: `ENABLE_RQC` flag para activar/desactivar sistema completo
- **Cost Control**: Con flag disabled = 0 coste extra, bypass automático
- **Orchestration Ready**: Plumbing completo para 3-reviewer system
- **Admin Overrides**: Endpoints para togglear RQC por usuario

#### ⚡ CI/CD Pipeline (GitHub Actions)
- **Multi-Node Testing**: Node 18.x y 20.x en paralelo
- **Security Audit**: npm audit + dependency review automático
- **Smoke Tests**: Endpoints críticos verificados en cada build
- **Coverage Reports**: Codecov integration para métricas de testing
- **Slack Notifications**: Alerts automáticos en main/develop branches

#### 🧪 Smoke Tests y Health Checks
- **API Health**: Endpoints `/health` y `/api/health` con service status
- **Feature Flag Tests**: Verificación de inicialización y consistency
- **Security Headers**: Tests automáticos de CORS, rate limits, security
- **Error Handling**: 404/405/500 responses verificados

#### 📚 Documentación Completa
- **Billing Guide**: Configuración Stripe step-by-step con troubleshooting
- **Feature Flags**: Referencia completa de flags disponibles y uso
- **API Documentation**: Endpoints, request/response formats, error codes
- **Local Development**: Setup guides para Stripe webhooks y testing

---

### 📈 Performance y Reliability

#### 🔄 Graceful Degradation
- **Database Fallback**: Todas las features funcionan sin Supabase (modo mock)
- **Service Isolation**: Fallo de un servicio no afecta el resto del sistema  
- **Progressive Enhancement**: Core functionality siempre disponible

#### 🚨 Error Handling Mejorado
- **Consistent Response Format**: Códigos de error uniformes con detalles
- **Rate Limit Feedback**: Mensajes específicos por tipo de límite
- **Webhook Error Recovery**: Reintentos automáticos y logging detallado
- **Feature Flag Safe Defaults**: Flags ausentes = false, nunca undefined

#### 📊 Monitoring Ready
- **Health Endpoints**: Status detallado de servicios y configuración
- **Metrics Collection**: Duración requests, rate limit hits, feature usage
- **Log Aggregation**: Formato estructurado para herramientas de monitoring
- **Version Tracking**: Endpoint health incluye version y environment

---

### 🔧 Developer Experience

#### 🎯 Testing Strategy
- **Unit Tests**: 37+ RQC tests + servicios core
- **Integration Tests**: API endpoints con mocks
- **Smoke Tests**: Health checks automáticos en CI
- **Coverage Goals**: >80% en servicios críticos

#### 🚀 Easy Deployment
- **Environment Detection**: Auto-configure según NODE_ENV
- **Feature Toggle**: Flags permiten deploys graduales
- **Docker Ready**: Configuración lista para containerización
- **Health Monitoring**: Endpoints para load balancer health checks

---

## v0.7.0 – 2025-08-08

**Descripción:** Sistema RQC (Roast Quality Control) multi-plan con moderación básica integrada para Free/Pro y sistema avanzado de 3 revisores paralelos para Creator+. Optimizado para costes con fallback inteligente y testing completo (37 casos).

---

### 🎯 RQC (Roast Quality Control) System

#### 🔬 Multi-Plan Architecture
- **Free & Pro Plans**: Moderación básica integrada en el prompt de generación (sin llamadas extra a GPT)
- **Creator+ Plans**: Sistema RQC avanzado con 3 revisores ejecutándose en paralelo:
  - **🛡️ Moderator**: Verifica cumplimiento de normas de plataforma y nivel de intensidad
  - **😄 Comedian**: Evalúa calidad del humor, creatividad y "punch"
  - **🎨 Style Reviewer**: Comprueba adherencia al estilo y tono configurado
- **💰 Cost Optimization**: Free/Pro usan 1 llamada GPT, Creator+ usa sistema multi-revisor

#### 🤖 Decision Logic Inteligente
- **3 verdes** → Aprobado y publicado inmediatamente
- **2 verdes (Moderador pasa)** → Aprobado en modo Creator+ Pro
- **Moderador falla** → Regenerar siempre (non-negotiable para seguridad)
- **< 2 verdes** → Regenerar con feedback específico
- **Max intentos** → Fallback a roast seguro garantizado

#### 🗄️ Database Schema RQC
- **Tabla `rqc_reviews`**: Historial completo de revisiones con métricas de performance
- **Extensión `user_subscriptions`**: Campos RQC (enabled, intensity_level, custom_style_prompt)
- **Tabla `rqc_plan_configs`**: Configuración específica por plan
- **Funciones PostgreSQL**: `get_user_rqc_config()` y `log_rqc_review()` para eficiencia

#### ⚙️ Configuration System
- **Intensity Levels**: 1-5 (suave a brutal, siempre dentro de reglas)
- **RQC Enable Flag**: Configurable por usuario Creator+ y administradores
- **Custom Style Prompts**: Solo editables por admin para usuarios avanzados
- **Max Regenerations**: Límite configurable por plan (0 Free/Pro, 3 Creator+)

#### 🚀 Performance Features
- **Parallel Processing**: 3 revisores se ejecutan simultáneamente para velocidad
- **Token Tracking**: Seguimiento detallado de uso y costes por plan
- **Smart Fallback**: Sistema que siempre publica algo, nunca falla completamente
- **Database Logging**: Métricas completas para análisis y optimización

#### 🧪 Comprehensive Testing (37 test cases)
- **Plan-based Behavior**: Verificación Free/Pro vs Creator+ flows
- **Cost Control**: Validación de no-extra-calls para planes básicos
- **RQC Decision Logic**: Testing exhaustivo de reglas de aprobación/rechazo
- **Error Handling**: Fallbacks y recovery en todos los puntos de falla
- **Performance**: Tests de ejecución paralela y eficiencia

### 🔧 Technical Implementation
- **`RoastGeneratorEnhanced`**: Servicio principal que reemplaza generator legacy
- **`RQCService`**: Microservicio independiente para sistema de revisión
- **Database Migration**: `004_rqc_system.sql` con schema completo
- **Backward Compatibility**: API existente funciona sin cambios

### 📊 Key Benefits
- **Cost Efficient**: Free/Pro mantienen eficiencia con 1 llamada API
- **Quality Assured**: Creator+ obtiene control de calidad profesional
- **Platform Safe**: Todo contenido cumple guidelines de plataformas
- **User Customizable**: Configuración de intensidad y estilo personalizable
- **Admin Controllable**: Prompts de estilo configurables por administrador
- **Always Publishes**: Sistema de fallback garantiza que siempre se responde

---

## v0.6.0 – 2025-08-07

**Descripción:** Sistema completo de facturación con Stripe Checkout, Customer Portal, webhooks y gating de funcionalidades por plan. Incluye 3 planes (Free, Pro €20, Creator+ €50) con restricciones automáticas y testing comprehensivo.

---

### 💳 Sistema de Facturación Stripe Completo

#### 🎯 Planes de Suscripción Implementados
- **Free Plan**: Gratis con 100 roasts/mes, 1 plataforma, soporte básico
- **Pro Plan**: €20/mes con 1,000 roasts/mes, 5 plataformas, analíticas avanzadas
- **Creator+ Plan**: €50/mes con roasts ilimitados, todas las plataformas, API access
- **Plan gating**: Middleware automático que bloquea funcionalidades según plan
- **Lookup keys**: Configuración flexible de precios via variables de entorno

#### 🔄 Stripe Checkout y Portal Integration
- **Checkout Sessions**: Creación automática con metadata de usuario y plan
- **Customer Portal**: Gestión completa de suscripciones (upgrade/downgrade/cancel)
- **OAuth-style flow**: Redirección a Stripe → Success/Cancel pages
- **Customer management**: Creación y reutilización de customers de Stripe
- **Secure redirects**: URLs configurables para success/cancel/return

#### 🎣 Webhooks y Sincronización Automática
- **Webhook endpoint**: `/webhooks/stripe` con verificación de firma
- **Eventos soportados**:
  - `checkout.session.completed` → Activación de suscripción
  - `customer.subscription.updated` → Cambios de plan/estado
  - `customer.subscription.deleted` → Cancelación y reset a Free
  - `invoice.payment_succeeded/failed` → Estados de pago
- **Sincronización DB**: Actualización automática en `user_subscriptions`
- **Metadata tracking**: Lookup keys y user IDs en todos los eventos

### 🛡️ Plan Gating y Control de Acceso

#### 🔐 Middleware requirePlan
- **Plan hierarchy**: Sistema de niveles (Free=0, Pro=1, Creator+=2)
- **Flexible matching**: Nivel mínimo o lista exacta de planes permitidos
- **Feature gating**: Control granular por características específicas
- **Trial support**: Soporte completo para períodos de prueba
- **Grace period**: Acceso durante `past_due` dentro del período activo
- **Rich error responses**: Códigos específicos y URLs de upgrade

#### 📊 Límites Automatizados por Plan
- **Platform limits**: 1/5/ilimitadas plataformas según plan
- **Roast usage**: Tracking mensual automático con límites (100/1000/∞)
- **Feature flags**: Control de acceso a tones avanzados, API, etc.
- **Usage checking**: Función `checkRoastLimit()` para validación pre-generación
- **Quota monitoring**: Seguimiento en tiempo real del uso

### 🎨 Frontend de Facturación Completo

#### 💰 Página de Planes (`/billing.html`)
- **Grid responsive**: 3 planes con diseño adaptativo mobile-first
- **Plan comparison**: Features, precios y beneficios claramente mostrados
- **Current plan badge**: Indicador visual del plan activo
- **Dynamic pricing**: Carga de precios desde API con fallbacks
- **Portal access**: Botón de gestión para usuarios con suscripción activa
- **Loading states**: Spinners y feedback durante operaciones Stripe

#### ✅ Páginas de Confirmación
- **Success page**: `/billing-success.html` con detalles de suscripción
- **Cancellation page**: `/billing-cancelled.html` con opciones de recuperación
- **Session tracking**: Extracción y display de session_id
- **Auto-refresh**: Carga diferida para permitir webhook processing
- **User guidance**: Next steps y enlaces a configuración

### 🗄️ Base de Datos Multi-tenant

#### 📋 Tabla user_subscriptions
- **Schema completo**: user_id, stripe IDs, plan, status, períodos
- **RLS policies**: Aislamiento completo entre usuarios y organizaciones
- **Indexes optimizados**: Búsqueda eficiente por customer_id y subscription_id
- **Triggers automáticos**: updated_at timestamp y validaciones
- **Migration script**: Setup completo con datos default para usuarios existentes

#### 🔄 Integración Supabase
- **Service client**: Operaciones webhook con permisos elevados
- **User client**: Operaciones frontend con RLS
- **Error handling**: Logging detallado y recovery automático
- **Audit trail**: Tracking completo de cambios de suscripción

### 🧪 Testing Comprehensivo

#### ✅ Backend Testing (Jest)
- **Billing routes**: 15+ test cases cubriendo todos los endpoints
- **Webhook testing**: Verificación de firma y manejo de eventos
- **Plan middleware**: 20+ tests para gating y límites
- **Error scenarios**: Database failures, Stripe errors, invalid data
- **Mock strategy**: Stripe SDK completamente simulado
- **Coverage completa**: Todos los flujos críticos testeados

#### 🖥️ Frontend Testing 
- **DOM manipulation**: Tests de renderizado y estados UI
- **API integration**: Mocking de fetch y localStorage
- **User interactions**: Checkout flow y portal access
- **Error handling**: Network failures y invalid responses
- **Loading states**: Spinners y message display
- **URL parsing**: Session ID extraction en success page

### 🔧 Configuración y Variables de Entorno

#### 🎛️ Variables Stripe (.env.example)
```bash
STRIPE_SECRET_KEY=sk_test_xxx           # Test mode secret
STRIPE_WEBHOOK_SECRET=whsec_xxx         # Webhook signature verification
STRIPE_PRICE_LOOKUP_PRO=pro_monthly     # Lookup key Pro plan
STRIPE_PRICE_LOOKUP_CREATOR=creator_plus_monthly
STRIPE_SUCCESS_URL=.../billing-success.html?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=.../billing-cancelled.html
STRIPE_PORTAL_RETURN_URL=.../billing.html
```

#### 🔒 Security Best Practices
- **No secrets in logs**: Nunca se loggean claves o tokens
- **Webhook verification**: Verificación criptográfica de firmas
- **Environment isolation**: Test keys claramente diferenciadas
- **RLS enforcement**: Base de datos con seguridad a nivel de fila
- **JWT validation**: Autenticación requerida para todos los endpoints

### 📂 Arquitectura de Archivos

#### Backend Implementation
- `src/routes/billing.js` - 5 endpoints principales + webhook handler (450+ líneas)
- `src/middleware/requirePlan.js` - Plan gating completo con límites (200+ líneas)
- `database/migrations/003_user_subscriptions.sql` - Schema y RLS policies

#### Frontend Pages
- `public/billing.html` - Selector de planes con Stripe integration
- `public/billing-success.html` - Confirmación post-checkout
- `public/billing-cancelled.html` - Manejo de cancelaciones

#### Testing Suite
- `tests/unit/routes/billing.test.js` - Backend endpoints (450+ líneas)
- `tests/unit/middleware/requirePlan.test.js` - Plan gating (350+ líneas) 
- `tests/unit/frontend/billing.test.js` - Frontend functionality (400+ líneas)

### 🚀 API Endpoints Implementados

```javascript
// Billing Management
GET    /api/billing/plans                    // Lista de planes disponibles
POST   /api/billing/create-checkout-session  // Crear sesión Stripe Checkout
POST   /api/billing/create-portal-session    // Abrir Customer Portal
GET    /api/billing/subscription             // Datos de suscripción actual

// Webhook Integration  
POST   /webhooks/stripe                      // Procesar eventos Stripe

// Plan Gating Middleware (examples)
app.use('/api/advanced-features', requirePlan('pro'))
app.use('/api/unlimited-roasts', requirePlan('creator_plus'))
app.use('/api/analytics', requirePlan('pro', { feature: 'analytics' }))
```

### 🎯 Flujo Completo de Suscripción

1. **Selección de plan**: Usuario ve planes en `/billing.html`
2. **Stripe Checkout**: Clic en suscribirse → redirección a Stripe
3. **Payment processing**: Stripe maneja pago de forma segura
4. **Webhook sync**: `checkout.session.completed` → actualiza DB
5. **Success redirect**: Usuario regresa a `/billing-success.html`
6. **Plan activation**: Funcionalidades desbloqueadas automáticamente
7. **Portal access**: Gestión completa via Stripe Customer Portal

### 📊 Métricas y Validación

- ✅ **3 planes configurados** con precios EUR y límites específicos
- ✅ **Webhook handling** para 5 eventos críticos de Stripe
- ✅ **Plan gating** protegiendo endpoints según suscripción
- ✅ **85+ test cases** cubriendo todos los flujos
- ✅ **Mobile responsive** design en todas las páginas
- ✅ **Error recovery** robusto en todos los puntos de falla
- ✅ **Test mode ready** con claves claramente diferenciadas

---

## v0.5.0 – 2025-08-07

**Descripción:** Sistema completo de onboarding de usuarios y configuración de plataformas sociales con flujo de 4 pasos, integración de endpoints personalizados y gestión avanzada de preferencias.

---

### 🎯 Sistema de Onboarding Completo (4 Pasos)

#### 🚀 Flujo de Configuración Inicial
- **Paso 1 - Bienvenida**: `/onboarding/step1.html` con introducción y beneficios del sistema
- **Paso 2 - Selección de Plataformas**: Checklist interactivo de las 9 plataformas sociales disponibles
- **Paso 3 - Configuración de Humor**: Selección de tono (sarcástico, sutil, directo, juguetón, ingenioso) y estilo (ingenioso, astuto, humor seco, salvaje, amigable)
- **Paso 4 - Confirmación Final**: Resumen completo de configuración con guardado de preferencias
- **Navegación fluida**: Indicadores de progreso y botones anterior/siguiente
- **Validación inteligente**: Manejo de errores y recuperación de sesión

#### 🔗 Gestión de Plataformas Sociales  
- **Vista principal**: `/platforms.html` con grid de las 9 plataformas integradas
- **Estados dinámicos**: Conectado, Desconectado, Pendiente, Error con indicadores visuales
- **Conexión simulada**: Flujo OAuth mock para todas las plataformas
- **Gestión individual**: Conectar/desconectar plataformas con feedback inmediato
- **Configuración avanzada**: Botón de settings por plataforma (próximamente)
- **Design responsive**: Optimizado para todos los dispositivos

### 🛠️ Backend API Extendido

#### 🔌 Nuevos Endpoints de Usuario (`/api/user`)
- `GET /api/user/integrations` - Lista todas las integraciones del usuario con estados
- `POST /api/user/integrations/connect` - Conecta plataforma con configuración mock OAuth
- `POST /api/user/integrations/disconnect` - Desconecta plataforma manteniendo configuración
- `POST /api/user/preferences` - Guarda preferencias de onboarding y marca como completado
- `GET /api/user/profile` - Perfil completo del usuario con organización y preferencias
- **Integración multi-tenant**: Todos los endpoints respetan RLS y organizaciones
- **Manejo robusto de errores**: Logging detallado y respuestas estandarizadas

#### 🗄️ Integración Supabase Completa
- **Tabla `integration_configs`**: Configuración por organización y plataforma
- **Campo `onboarding_complete`**: Control de flujo de nuevos usuarios  
- **Tabla `users.preferences`**: Almacenamiento JSON de configuración personalizada
- **Row Level Security**: Aislamiento completo entre organizaciones
- **Configuración automática**: Creación de integration_configs basada en plataformas preferidas

### 🎨 Experiencia de Usuario Mejorada

#### 📱 Design System Expandido
- **Componentes reutilizables**: Tarjetas de plataforma, indicadores de estado, botones de acción
- **Paleta de colores**: Colores específicos por plataforma (Twitter azul, Instagram gradiente, etc.)
- **Estados interactivos**: Hover effects, loading states, transiciones suaves
- **Tipografía consistente**: Roboto como fuente principal con jerarquía clara
- **Grid responsive**: Layout adaptativo para móviles, tablets y desktop

#### 🔄 Flujos de Usuario Inteligentes
- **Redirección automática**: Usuarios sin onboarding van directo al paso 1
- **Persistencia de sesión**: Configuración guardada entre pasos con sessionStorage
- **Recovery de configuración**: Usuarios pueden reconfigurar desde dashboard
- **Integración dashboard**: Enlaces directos a gestión de plataformas
- **Feedback visual**: Mensajes de éxito/error con auto-dismissal

### 🧪 Testing y Calidad

#### ✅ Tests Unitarios Implementados
- **User routes testing**: Suite completa para todos los endpoints `/api/user`
- **Mock integration**: Supabase, middleware auth y dependencias externas
- **Casos edge**: Validación de errores, datos faltantes, usuarios sin organización
- **Cobertura endpoints**: GET/POST para integrations, preferences y profile
- **Manejo de autenticación**: Tests de middleware y permisos
- **Error scenarios**: Testing de fallos de base de datos y timeouts

#### 🔍 Configuración Jest Avanzada
- **Proyectos separados**: node-tests para backend, dom-tests para frontend
- **Setup específico**: Variables de entorno mockeadas para tests
- **Mocking strategy**: Supabase client completamente simulado
- **Coverage tracking**: Seguimiento de cobertura por tipo de test

### 💻 Dashboard y Navegación

#### 🏠 Dashboard Actualizado
- **Verificación onboarding**: Redirección automática si no está completo
- **Enlaces rápidos**: Acceso directo a plataformas y reconfiguración
- **Estados del usuario**: Visualización de plan, estado y configuración
- **Navegación mejorada**: Breadcrumbs y enlaces contextuales
- **Plan management**: Integración con selección y upgrade de planes

### 📂 Arquitectura de Archivos

#### Frontend Onboarding
- `public/onboarding/step1.html` - Página de bienvenida con features destacadas
- `public/onboarding/step2.html` - Selección de plataformas con grid interactivo  
- `public/onboarding/step3.html` - Configuración de humor con ejemplos en vivo
- `public/onboarding/step4.html` - Confirmación y resumen con guardado automático
- `public/platforms.html` - Gestión completa de conexiones de plataformas

#### Backend Services
- `src/routes/user.js` - Rutas completas para gestión de usuario (529 líneas)
- `src/index.js` - Integración de rutas user en servidor principal
- `tests/unit/routes/user.test.js` - Suite de tests para endpoints de usuario

#### Configuración y Setup
- `jest.config.js` - Configuración avanzada con proyectos separados
- `tests/setupEnvOnly.js` - Setup específico para tests de backend
- `tests/setup.js` - Setup existente actualizado con variables de entorno

### 🔧 Variables de Configuración

#### Plataformas Soportadas (9 total)
- **Twitter/X**: API v2 con bearer token y OAuth
- **Instagram**: Basic Display API con refresh tokens  
- **Facebook**: Graph API con permisos de páginas
- **YouTube**: Data API v3 con comentarios y videos
- **Discord**: Bot API con webhooks y slash commands
- **Twitch**: API con chat y stream events
- **Reddit**: API con subreddits y posts
- **TikTok**: Business API (en revisión)
- **Bluesky**: AT Protocol con handles personalizados

### 🎯 Flujo Completo de Usuario

1. **Registro**: Usuario se registra con email/password o Google OAuth
2. **Onboarding automático**: Redirección a `/onboarding/step1.html`
3. **Configuración**: 4 pasos de personalización con guardado progresivo
4. **Dashboard**: Acceso completo con enlaces a gestión de plataformas
5. **Conexión de cuentas**: Flujo OAuth simulado para cada plataforma
6. **Uso del sistema**: Bot funcional con configuración personalizada

### 📊 Métricas y Validación

- ✅ **9 plataformas** configurables con estados independientes
- ✅ **4 pasos de onboarding** con navegación fluida y persistencia
- ✅ **5 endpoints nuevos** completamente funcionales y testeados
- ✅ **100% responsive** design verificado en móviles y desktop  
- ✅ **Multi-tenant** architecture con RLS y aislamiento completo
- ✅ **Error handling** robusto con logging y recovery automático

---

## v0.4.0 – 2025-08-07

**Descripción:** Sistema de autenticación completo con frontend HTML, JavaScript vanilla, Google OAuth, Magic Links, recuperación de contraseñas y tests unitarios integrados.

---

### 🔐 Sistema de Autenticación Frontend Completo

#### 🎨 Páginas de Autenticación HTML+CSS
- **Login página**: `/login.html` con formulario email/contraseña
- **Registro página**: `/register.html` con verificación de email
- **Recuperación**: `/password-reset.html` para reset de contraseñas
- **Verificación de email**: `/email-verification.html` para confirmaciones
- **Dashboard**: `/dashboard.html` con selección de planes y logout
- **Estilos unificados**: `/public/css/auth.css` con componentes reutilizables

#### 🔑 Google OAuth Integrado
- **Flujo OAuth completo**: Redirección automática a Google
- **Callback handler**: `/api/auth/callback` para procesar respuestas OAuth
- **Creación automática**: Usuarios nuevos via OAuth se crean automáticamente
- **Redirect inteligente**: Dashboard directo después de autenticación exitosa
- **Manejo de errores**: Fallbacks para OAuth no configurado

#### ✨ Magic Links y Recuperación de Contraseñas
- **Magic link login**: Autenticación sin contraseña vía email
- **Password recovery**: Sistema completo de reset via email
- **Tokens seguros**: Integración con Supabase para tokens temporales
- **URLs de callback**: Redirecciones automáticas después de verificación
- **Prevención enumeración**: Mensajes genéricos para seguridad

#### 💻 JavaScript Vanilla Avanzado
- **Manejo de formularios**: Validación y estados de loading
- **Gestión de sesiones**: LocalStorage con refresh tokens
- **API integration**: Comunicación segura con backend
- **Error handling**: Mensajes de error user-friendly
- **Auto-refresh tokens**: Renovación automática de sesiones
- **Redirecciones inteligentes**: Routing basado en rol de usuario

### 🛠️ Backend Extensions

#### 🔌 Nuevos Endpoints de Autenticación
- `GET /api/auth/google` - Inicia flujo OAuth de Google
- `GET /api/auth/callback` - Procesa callbacks OAuth
- `POST /api/auth/magic-link` - Envía magic link por email
- `POST /api/auth/update-password` - Actualiza contraseña con token
- `GET /api/auth/verify` - Verifica confirmaciones de email
- **Compatibilidad backward**: Endpoints legacy mantenidos

#### 🔒 AuthService Extendido
- **Google OAuth methods**: `signInWithGoogle()` y `handleOAuthCallback()`
- **Magic link support**: Integración completa con Supabase OTP
- **Password updates**: Método seguro para reset de contraseñas
- **Email verification**: Validación de tokens de confirmación
- **Error handling**: Logging detallado y manejo robusto de errores

### 🎨 Experiencia de Usuario Mejorada

#### 📱 Design Responsive
- **Mobile-first**: Formularios optimizados para móviles
- **Estados visuales**: Loading spinners y feedback inmediato
- **Validación en tiempo real**: Errores mostrados instantáneamente
- **Transiciones suaves**: Animaciones CSS para mejor UX
- **Mensajes informativos**: Toast notifications para todas las acciones

#### 🔄 Flujos de Autenticación Intuitivos
- **Registro con verificación**: Email confirmation workflow completo
- **Plan selection**: Dashboard con selección de planes post-registro
- **Admin redirect**: Usuarios admin van directo al panel
- **Remember me**: Opción de sesiones persistentes
- **Auto-logout**: Limpieza de sesión en tokens expirados

### 🧪 Testing Comprehensivo

#### ✅ Tests Unitarios Completos
- **Auth routes testing**: 11 test cases con mocks completos
- **Endpoint coverage**: Registro, login, OAuth, magic links
- **Error scenarios**: Validación de casos edge y manejo errores
- **Security testing**: Validación de mensajes genéricos anti-enumeración
- **Mock integration**: Supabase y dependencias completamente mockeadas

#### 🔍 Coverage de Funcionalidades
- ✅ **User registration** con validaciones
- ✅ **Login/logout** con sesiones persistentes  
- ✅ **Magic links** para autenticación sin contraseña
- ✅ **Password recovery** con tokens seguros
- ✅ **Google OAuth** con creación automática de usuarios
- ✅ **Email verification** workflow completo
- ✅ **Dashboard integration** con plan selection

### 📂 Archivos Nuevos/Modificados

#### Frontend
- `public/login.html` - Página de login con Google OAuth y magic link
- `public/register.html` - Registro con verificación de email
- `public/password-reset.html` - Reset de contraseña con token
- `public/email-verification.html` - Confirmación de email
- `public/dashboard.html` - Dashboard con OAuth callback handling
- `public/css/auth.css` - Estilos unificados (400+ líneas)
- `public/js/auth.js` - JavaScript de autenticación (450+ líneas)

#### Backend
- `src/services/authService.js` - Métodos OAuth y password update
- `src/routes/auth.js` - Endpoints Google OAuth y callback
- `tests/unit/auth.test.js` - Test suite completo (11 casos)

### 🔧 Configuración y Setup

#### 🌍 Variables de Entorno
- `FRONTEND_URL` - URL base para redirects OAuth
- `SUPABASE_URL` - Supabase project URL (existente)
- `SUPABASE_ANON_KEY` - Public key para frontend (existente)
- **Google OAuth setup**: Requiere configuración en Supabase Dashboard

#### 🚀 Comandos Disponibles
- `npm test -- tests/unit/auth.test.js` - Ejecutar tests de autenticación
- `npm start` - Servidor con nuevos endpoints OAuth
- **Acceso directo**: `http://localhost:3000/login.html`

### 🎯 Validación Funcional

- ✅ **Formularios HTML** funcionando con validación JavaScript
- ✅ **Google OAuth** configurado (requiere setup en Supabase)
- ✅ **Magic links** enviando emails correctamente
- ✅ **Password recovery** con tokens seguros
- ✅ **Dashboard integration** con plan selection
- ✅ **Tests unitarios** pasando 11/11
- ✅ **Mobile responsive** design verificado

---

## v0.3.0 – 2025-01-07

**Descripción:** Funcionalidades avanzadas del panel de administración con métricas comprehensivas, sistema de suspensión de usuarios y monitoreo de integraciones en tiempo real.

---

### 🚀 Nuevas Funcionalidades Principales

#### 📊 Dashboard Avanzado con Métricas Comprehensivas
- **Estadísticas mejoradas**: Total usuarios con conteo de suspendidos
- **Métricas de roasts**: Conteos diarios, semanales y mensuales en tiempo real
- **Top 5 usuarios**: Ranking por volumen de actividad con indicadores oro/plata/bronce  
- **Estado de integraciones**: Monitoreo en vivo con timestamps de última ejecución
- **Chart de actividad**: Integraciones más activas con barras de progreso animadas
- **Actualización automática**: Dashboard con datos en tiempo real

#### 🔒 Sistema de Suspensión de Usuarios  
- **Suspender usuarios**: Previene generación de roasts manteniendo acceso al dashboard
- **Reactivar usuarios**: Restaura funcionalidad completa con log de auditoría  
- **Indicadores visuales**: Estados Activo/Inactivo/Suspendido en tabla de usuarios
- **Razón de suspensión**: Campo opcional para documentar motivos
- **Logging administrativo**: Registro completo de acciones para compliance
- **Permisos granulares**: Control fino sobre capacidades del usuario

#### 🔌 Monitoreo de Integraciones en Tiempo Real
- **Estado en vivo**: Badges de estado (Activa, Configurada, Deshabilitada)  
- **Timestamps de ejecución**: Última vez que cada integración se ejecutó
- **Indicadores de salud**: Monitoreo visual del estado de cada plataforma
- **Lista interactiva**: Vista detallada de todas las 9 integraciones
- **Chart de actividad**: Visualización de integraciones más utilizadas

### 🛠️ Mejoras Técnicas Backend

#### 🎯 MetricsService - Nuevo Servicio de Análisis
- **Agregación de métricas**: Servicio comprehensivo para estadísticas del dashboard
- **Queries optimizadas**: Consultas eficientes con manejo de errores  
- **Datos de fallback**: Manejo robusto cuando las tablas están vacías
- **Cálculos inteligentes**: Métricas simuladas para desarrollo y testing
- **Logging completo**: Trazabilidad de todas las operaciones

#### 🔐 AuthService Extendido  
- **Métodos de suspensión**: `suspendUser()` y `unsuspendUser()` con metadatos
- **Verificación de permisos**: `canUserGenerateRoasts()` para control granular
- **Logging de actividades**: Registro automático de acciones administrativas  
- **Gestión de estados**: Tracking completo de cambios de estado del usuario

#### 🌐 API Endpoints Nuevos
- `POST /api/admin/users/:userId/suspend` - Suspender cuenta de usuario
- `POST /api/admin/users/:userId/reactivate` - Reactivar usuario suspendido  
- `GET /api/admin/dashboard` - Métricas comprehensivas mejoradas
- **Manejo de errores**: Respuestas estandarizadas con logging detallado
- **Validación robusta**: Verificación de permisos y datos de entrada

### 🎨 Mejoras Frontend Avanzadas

#### 📱 Dashboard Rediseñado
- **Cards de estadísticas**: 4 cards con iconos codificados por color
- **Top 5 usuarios**: Lista de ranking con posiciones oro/plata/bronce
- **Estado de integraciones**: Lista visual con badges de estado  
- **Chart de actividad**: Barras de progreso con animaciones CSS
- **Design responsive**: Optimizado para todos los dispositivos

#### 👥 Gestión de Usuarios Mejorada
- **Indicadores de suspensión**: Estados visuales en la tabla de usuarios
- **Botones Suspender/Reactivar**: Acciones con confirmación y razón opcional
- **Actualizaciones en tiempo real**: Estados se actualizan automáticamente
- **Diálogos de confirmación**: UX mejorada para acciones críticas

#### 🎨 Sistema de Estilos Expandido
- **Listas de ranking**: Estilos para posiciones con indicadores de medalla
- **Badges de estado**: Indicadores visuales para suspensión 
- **Charts de actividad**: Barras de progreso con fills animados
- **Estados responsive**: Diseño mejorado para móviles y tablets

### 🗄️ Cambios de Base de Datos

#### 📝 Schema Updates
- **Tipos de actividad**: Agregado 'account_reactivated' a user_activities constraint
- **Campos de suspensión**: Support completo para tracking de suspensiones
  - `suspended` boolean
  - `suspended_reason` texto opcional
  - `suspended_at` timestamp  
  - `suspended_by` referencia al admin

### 🧪 Testing Comprehensivo

#### ✅ Cobertura de Tests Completa
- **MetricsService tests**: 7 test cases con mocking completo
- **Admin routes tests**: 17 test cases incluyendo suspend/reactivate  
- **Manejo de errores**: Testing de casos edge y recuperación
- **Integración**: Tests de workflows completos admin

### 📊 Métricas y Performance

- **Queries optimizadas**: Mejores consultas para dashboard metrics
- **Caching inteligente**: Datos calculados una vez y reutilizados
- **Fallback robusto**: Sistema resiliente ante fallos de base de datos
- **Logging detallado**: Trazabilidad completa para debugging

---

## v0.2.0 – 2025-01-31

**Descripción:** Panel de Administración completo con funcionalidades avanzadas, testing integrado, seguridad robusta y experiencia de usuario mejorada.

---

### 🛡️ Panel de Administración Completo

#### 🔒 Seguridad y Autenticación
- **Middleware de admin** (`src/middleware/isAdmin.js`) con validación estricta de permisos
- **Verificación JWT + RLS** usando sistema Supabase existente  
- **Acceso denegado** con mensaje claro para usuarios sin permisos
- **Logging automático** de intentos de acceso no autorizados
- **Validación doble** (token + base de datos) para máxima seguridad

#### 📊 Dashboard y Métricas
- **Estadísticas en tiempo real**: Total usuarios, activos, admins, nuevos del mes
- **Integraciones activas**: Lista visual de plataformas habilitadas
- **Actividad reciente**: Resumen por plataforma con métricas de uso
- **Cards interactivas** con iconos y actualización automática

#### 👥 Gestión Avanzada de Usuarios
- **Lista completa** con información detallada (email, nombre, plan, estado)
- **Búsqueda en tiempo real** por email y nombre con filtros avanzados
- **Filtros por estado**: Solo admins, solo activos, por plan
- **Acciones administrativas**:
  - Promover/Demover administradores con confirmación
  - Activar/Desactivar usuarios temporalmente
  - Cambio de planes (Basic, Pro, Creator Plus)
- **Logging automático** de todas las acciones administrativas

#### 🔌 Testing y Debugging
- **Test de integraciones** desde el panel con output en vivo
- **Selección de plataformas** específicas para testing
- **Ejecución directa** de `npm run integrations:test`
- **Visualización formato terminal** con scroll y sintaxis highlighting

#### ⚙️ Configuración del Sistema
- **Variables de entorno** en tiempo real
- **Estado de integraciones**: Plataformas activas, configuración
- **Features del sistema**: Debug, Shield, ambiente
- **Límites y configuraciones**: Frecuencia de respuesta, tono, etc.

#### 📋 Sistema de Logs Avanzado
- **Visualización de logs** con filtros por tipo y categoría
- **Descarga como archivo** (.txt) para análisis offline
- **Filtros disponibles**: Info, Warning, Error, Integration, Shield
- **Formato terminal** con timestamps y metadatos

### 🎨 Interfaz de Usuario Mejorada

#### 📱 Design System Completo
- **Navegación por pestañas** (Dashboard, Usuarios, Integraciones, Config, Logs)
- **Design system consistente** con variables CSS y tokens
- **Responsive design** optimizado para móviles y tablets
- **Estados de loading** con spinners y feedback visual
- **Notificaciones toast** para todas las acciones

#### 🖥️ Componentes UI Avanzados
- **Cards de estadísticas** con iconos y métricas actualizadas
- **Tablas responsivas** con acciones inline por fila
- **Badges de estado** visual (activo/inactivo, plan, rol admin)
- **Botones con estados** (loading, disabled, confirmación)
- **Terminal output** con syntax highlighting para logs

### 🛠️ Herramientas de Desarrollo

#### 📝 Script de Configuración
- **Setup automático** (`npm run admin:setup`) para crear administradores
- **Interfaz interactiva** que solicita email, nombre y password
- **Validación de datos** y manejo de usuarios existentes
- **Verificación automática** de permisos después de creación
- **Lista de admins** (`npm run admin:list`) para auditoría

#### 🧪 Tests Unitarios Completos
- **Middleware testing** (`tests/unit/middleware/isAdmin.test.js`) - 11 tests
  - Validación de tokens, permisos de admin, usuarios inactivos
  - Manejo de errores y casos edge
- **API endpoints testing** (`tests/unit/routes/admin.test.js`) - 13 tests
  - Dashboard, gestión de usuarios, integraciones, logs
  - Mocking completo de Supabase y dependencias externas
- **Cobertura 100%** de funcionalidades críticas

### 📂 Archivos Creados/Modificados

#### Backend
- `src/middleware/isAdmin.js` - Middleware de validación admin
- `src/routes/admin.js` - 8 endpoints del panel de administración
- `src/index.js` - Registro de rutas admin

#### Frontend
- `public/admin.html` - Interfaz principal del panel (5 secciones)
- `public/css/admin.css` - Sistema de estilos responsive (800+ líneas)
- `public/js/admin.js` - Lógica JavaScript completa (600+ líneas)

#### Scripts y Configuración
- `scripts/setup-admin.js` - Script interactivo de configuración
- `package.json` - Comandos `admin:setup` y `admin:list`

#### Testing
- `tests/unit/middleware/isAdmin.test.js` - Tests del middleware (11 casos)
- `tests/unit/routes/admin.test.js` - Tests de endpoints (13 casos)

#### Documentación
- `ADMIN_PANEL_README.md` - Guía completa de uso y configuración

### 🔧 API Endpoints Implementados

```javascript
GET    /api/admin/dashboard                    // Estadísticas generales
GET    /api/admin/users                       // Lista de usuarios con filtros
POST   /api/admin/users/:id/toggle-admin      // Cambiar estado admin
POST   /api/admin/users/:id/toggle-active     // Activar/desactivar usuario
POST   /api/admin/integrations/test           // Ejecutar test de integraciones
GET    /api/admin/config                      // Configuración del sistema
GET    /api/admin/logs                        // Logs con filtros
GET    /api/admin/logs/download               // Descargar logs como .txt
```

### 🎯 Validación Funcional Completa

- ✅ **Acceso restringido** solo para usuarios admin verificado
- ✅ **Dashboard interactivo** con métricas en tiempo real
- ✅ **Gestión de usuarios** con promover/demover admin funcional
- ✅ **Test de integraciones** ejecutándose desde el panel
- ✅ **Sistema de logs** con visualización y descarga
- ✅ **Tests unitarios** pasando al 100% (24/24 tests)

### 🚀 Listo para Producción

El panel está completamente funcional y listo para:
- ✅ **Desarrollo local** → `http://localhost:3000/admin.html`
- ✅ **Deploy en Vercel/Netlify** → Funciona donde funcione el API principal
- ✅ **Uso inmediato** → Un comando (`npm run admin:setup`) para empezar

---

## v0.1.0 – 2025-08-07

**Descripción:** Migración masiva con sistema completo de autenticación multi-tenant, integraciones sociales, frontend, CLI y panel de administración funcional.

---

### 🚀 Funcionalidades Principales

#### 🔐 Autenticación y Multi-Tenancy
- Autenticación con Supabase (email/password y magic link).
- Gestión de sesiones JWT segura.
- Recuperación de contraseñas vía magic link.
- RLS (Row Level Security) en Supabase para garantizar aislamiento entre usuarios.
- Organización automática al registrar nuevos usuarios.
- CLI de gestión de usuarios (`users:list`, `users:create`, `users:delete`, etc).

#### 🌐 Integraciones Sociales (esqueletos listos)
- Soporte multi-plataforma para:
  - Twitter (completo)
  - Instagram (modo revisión manual)
  - Facebook
  - Discord
  - Twitch
  - Reddit
  - TikTok
  - Bluesky
- Clase base `MultiTenantIntegration.js` para lógica compartida.
- Workers programados (polling / WebSocket) por plataforma.
- Sistema de flags por entorno (`ENABLED_TWITTER=true`, etc).
- CLI de diagnóstico (`integrations:health`, `integrations:status`).

#### 🖥️ Frontend (React 19 + Tailwind 4)
- Sistema de login / registro / recuperación de contraseña.
- Selector de tema (claro, oscuro, automático).
- Página de dashboard con datos de usuario.
- Conexión segura al backend vía Bearer token.
- Entorno configurable (`REACT_APP_USE_MAGIC_LINK`, etc).

#### 🛠️ Panel de Administración
- Página exclusiva para usuarios admin (`/admin/users`).
- Lista de usuarios con:
  - Email
  - Plan actual
  - Estado de admin
  - Fecha de alta
  - Nº de integraciones activas
- Acciones disponibles:
  - Cambiar plan
  - Resetear contraseña

---

### 🧪 Testing

- 100% cobertura para el sistema de autenticación y CLI.
- Tests unitarios para Supabase auth, recovery y servicios.
- Tests de integración de endpoints protegidos.
- Verificaciones de seguridad en frontend y backend.

---

### 🧰 Infraestructura y Configuración

- `.env.example` actualizado con todas las variables necesarias.
- `.gitignore` configurado para evitar fugas de secrets o archivos locales.
- Scripts npm actualizados:
  - `npm run integrations:health`
  - `npm run frontend:install`
  - `npm run frontend:start`
