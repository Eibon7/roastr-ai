# Contenido a Añadir a Issue #741 - Polar Payment Integration

**Nota:** Este contenido debe añadirse a la issue #741 (checklist pre-producción existente)

---

## 💳 Polar Payment Integration (Issues #594 ✅, #808 ✅ → #741)

**Status:** Backend 100% completo (59 tests) | Pending: Frontend + Production setup  
**Estimación Total:** 15-21 horas  
**Prioridad:** P0 (Crítico para monetización)

---

### 1. Frontend Integration (~6-8 horas) 🎨

- [ ] **Instalar Polar SDK**

  ```bash
  npm install @polar-sh/sdk
  ```

- [ ] **Crear componente PolarCheckout** (`src/components/Billing/PolarCheckout.jsx`)
  - Botón "Upgrade to Pro" / "Subscribe"
  - Integración con Polar Checkout SDK
  - Loading states + error handling
  - Redirect a Polar checkout URL

- [ ] **Crear componente PlanSelector** (`src/components/Billing/PlanSelector.jsx`)
  - Cards para Starter (€5), Pro (€15), Plus (€50)
  - Highlight plan actual
  - Features list por plan
  - CTA buttons (Subscribe, Upgrade, Downgrade)
  - Responsive design (mobile stack, desktop 3 columns)

- [ ] **Crear SubscriptionStatus Dashboard** (`src/components/Dashboard/SubscriptionStatus.jsx`)
  - Plan actual + status
  - Fecha renovación (current_period_end)
  - Trial countdown si aplica
  - Link "Manage Subscription"
  - Integración con `GET /api/billing/subscription`

- [ ] **Success/Cancel Pages**
  - `/billing/success?checkout_id={CHECKOUT_ID}` - Confirmación + detalles
  - `/billing/cancel` - Mensaje cancelación + "Try again"
  - Refetch subscription status después de success

- [ ] **Tests Frontend**
  - Tests unitarios (PolarCheckout, PlanSelector, SubscriptionStatus)
  - Tests E2E (Playwright): Upgrade flow + payment completion
  - Manual testing con Polar test mode (todos los planes)

---

### 2. Production Environment (~2-3 horas) 🚀

- [ ] **Configurar Environment Variables en Producción**

  ```bash
  # Polar API (CRITICAL - usar keys de producción)
  POLAR_ACCESS_TOKEN=polar_live_***
  POLAR_WEBHOOK_SECRET=whsec_***

  # URLs (producción)
  POLAR_SUCCESS_URL=https://app.roastr.ai/billing/success?checkout_id={CHECKOUT_ID}
  POLAR_CANCEL_URL=https://app.roastr.ai/billing/cancel

  # Price IDs (obtener de Polar Dashboard - Production)
  POLAR_ALLOWED_PRICE_IDS=price_live_starter_*,price_live_pro_*,price_live_plus_*
  POLAR_STARTER_PRICE_ID=price_live_starter_***
  POLAR_PRO_PRICE_ID=price_live_pro_***
  POLAR_PLUS_PRICE_ID=price_live_plus_***
  ```

- [ ] **Ejecutar Migraciones DB en Producción**

  ```bash
  psql $DATABASE_URL_PROD < database/migrations/027_polar_subscriptions.sql
  psql $DATABASE_URL_PROD < database/migrations/028_polar_webhook_events.sql
  ```

  - Verificar tablas: `SELECT * FROM polar_subscriptions LIMIT 1;`
  - Verificar RLS policies

- [ ] **Registrar Webhook en Polar Dashboard**
  - URL: `https://api.roastr.ai/api/polar/webhook`
  - Events: `order.created`, `subscription.created`, `subscription.updated`, `subscription.canceled`
  - Copiar webhook secret → `POLAR_WEBHOOK_SECRET`
  - Test delivery: Trigger test event desde Polar Dashboard

- [ ] **Smoke Tests en Producción**
  - Test checkout con Polar test mode
  - Verificar webhook delivery en logs
  - Verificar entitlements aplicados correctamente

---

### 3. Monitoring & Observability (~3-4 horas) 📊

- [ ] **Grafana Dashboards - "Polar Billing"**
  - Panel 1: **Checkout Conversions**
    - Checkouts created vs completed
    - Conversion rate %
    - Breakdown por plan (Starter, Pro, Plus)
  - Panel 2: **Webhook Health**
    - Webhooks received (count por event type)
    - Success vs failures
    - Signature errors (security alert)
    - Average processing time
  - Panel 3: **Subscription Lifecycle**
    - Active subscriptions por plan
    - New subscriptions (hoy, semana, mes)
    - Churn rate
    - Trial → Paid conversion %
  - Panel 4: **Revenue Metrics**
    - MRR (Monthly Recurring Revenue)
    - MRR por plan
    - New MRR vs Churned MRR

- [ ] **Queries SQL para Dashboards**

  ```sql
  -- Active subscriptions by plan
  SELECT plan, COUNT(*) as count
  FROM polar_subscriptions
  WHERE status = 'active'
  GROUP BY plan;

  -- Webhook success rate (24h)
  SELECT
    event_type,
    COUNT(*) as total,
    SUM(CASE WHEN processed THEN 1 ELSE 0 END) as processed,
    ROUND(100.0 * SUM(CASE WHEN processed THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
  FROM polar_webhook_events
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY event_type;
  ```

- [ ] **Configurar Alerts (PagerDuty/Slack)**
  - **CRITICAL:**
    - Webhook signature failures > 5/min (potential security issue)
    - Webhook processing errors > 10/5min
    - Database transaction failures
  - **WARNING:**
    - Checkout creation failures > 5/5min
    - Webhook processing time > 5s (p95)
    - Entitlements update failures

- [ ] **Sentry Error Tracking**
  - Tag: `polar_integration`
  - Context: `user_id`, `event_type`, `price_id`
  - Breadcrumbs: Webhook payload (sanitizado)

---

### 4. User Documentation (~2-3 horas) 📚

- [ ] **User Guides**
  - `docs/user/how-to-subscribe.md` - Paso a paso con screenshots
  - `docs/user/manage-subscription.md` - Upgrade, downgrade, cancelar
  - `docs/user/billing-faq.md` - FAQ (¿Qué es Polar?, seguridad, cambios de plan, cancelaciones, facturas)

- [ ] **In-App Help**
  - Tooltips en features: "Available in Pro plan"
  - Trial countdown: "X days left in trial"
  - Modal "Upgrade Required": Feature bloqueado → CTA "Upgrade Now"

- [ ] **Troubleshooting Guide**
  - `docs/user/troubleshooting-billing.md`
    - Payment declined
    - Subscription not activating
    - Wrong plan showing
    - Entitlements not updating
    - Contact support

---

### 5. Final Validation (~2-3 horas) ✅

- [ ] **Pre-Launch Security Checklist**
  - `POLAR_WEBHOOK_SECRET` configurado ✅
  - `POLAR_ALLOWED_PRICE_IDS` configurado ✅
  - HTTPS en producción ✅
  - Rate limiting en `/api/checkout` ✅
  - Webhook signature validation activa ✅

- [ ] **Funcionalidad End-to-End**
  - Checkout flow completo (todos los planes)
  - Webhook processing (todos los eventos)
  - Entitlements aplicados correctamente
  - Trial periods funcionando
  - Upgrade/downgrade funcionando
  - Cancellations funcionando

- [ ] **Performance Benchmarks**
  - Checkout API response time < 500ms
  - Webhook processing < 2s
  - Frontend load time < 1s

- [ ] **Smoke Tests en Producción (4 scenarios)**

  **Test 1: New subscription (Starter)**
  - User clicks "Subscribe to Starter"
  - Completes Polar checkout (test card)
  - Redirected to success page
  - Dashboard shows "Starter plan"
  - Entitlements: 100 analysis/month, 50 roasts/month

  **Test 2: Upgrade (Starter → Pro)**
  - User clicks "Upgrade to Pro"
  - Completes payment
  - Dashboard shows "Pro plan"
  - Entitlements: 1000 analysis/month, 500 roasts/month
  - Pro-rating aplicado correctamente

  **Test 3: Cancellation**
  - User clicks "Cancel Subscription"
  - Confirmation modal
  - Subscription canceled (cancel_at_period_end = true)
  - Access continúa hasta fin de período
  - Email notification enviado

  **Test 4: Webhook Resilience**
  - Trigger test webhook desde Polar Dashboard
  - Verify idempotency (same event twice)
  - Verify signature validation
  - Verify error handling (malformed payload)

- [ ] **Launch Readiness**
  - Database backup antes de launch
  - Rollback plan documentado
  - CS team entrenado en billing support
  - Support channels monitoreados
  - Anuncio preparado (in-app banner + email + social media)

---

## 🎯 Definition of Done (Polar Integration)

- ✅ Users pueden subscribirse a cualquier plan desde frontend
- ✅ Checkout flow funciona en producción (test + real payments)
- ✅ Webhooks procesados correctamente (100% success rate en tests)
- ✅ Entitlements aplicados automáticamente después de payment
- ✅ Upgrade/downgrade con pro-rating correcto
- ✅ Cancellations mantienen acceso hasta fin de período
- ✅ Monitoring dashboards activos con métricas real-time
- ✅ Alerts configurados y funcionando
- ✅ User docs completos (guides + FAQ + troubleshooting)
- ✅ Smoke tests pasando en producción

---

## 📊 Resumen Técnico

**Backend (✅ Completo en #594, #808):**

- `src/routes/checkout.js` (198 líneas) - Checkout API
- `src/routes/polarWebhook.js` (425 líneas) - Webhook handlers
- `src/services/entitlementsService.js` - `setEntitlementsFromPolarPrice()`
- `src/utils/polarHelpers.js` - Price ID mapping
- Migraciones: `027_polar_subscriptions.sql`, `028_polar_webhook_events.sql`
- **Tests:** 59 tests (16 business + 9 security + 16 checkout + 14 entitlements + 4 E2E)
- **Coverage:** ≥90% en todos los módulos Polar

**Referencias:**

- `docs/POLAR-INTEGRATION-SUMMARY.md` - Resumen completo backend
- `docs/flows/payment-polar.md` - Flow documentation
- `docs/POLAR-ENV-VARIABLES.md` - Env vars reference
- Polar Dashboard: https://polar.sh/dashboard
- Polar Docs: https://docs.polar.sh/

---

**Estimación Total:** 15-21 horas  
**Sprint Plan:** Week 1 (Frontend + Prod Env), Week 2 (Monitoring + Docs + Validation)  
**Launch Target:** End of Week 2
