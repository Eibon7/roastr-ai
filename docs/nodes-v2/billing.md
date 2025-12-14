# GDD Node — Billing v2

**Version:** 2.0  
**Status:** ✅ Production  
**Last Updated:** 2025-12-05  
**Owner:** Back-end Dev  
**Priority:** Critical

---

## 1. SSOT References

Este nodo usa los siguientes valores del SSOT:

- `billing_provider` - Proveedor de billing (Polar - no Stripe en v2)
- `subscription_states` - Estados de suscripción (trialing, active, canceled_pending, paused, etc.)
- `billing_state_machine` - Máquina de estados de billing
- `plan_limits` - Límites por plan (analysis_per_month, roasts_per_month, etc.)
- `credit_consumption_rules` - Reglas de consumo de créditos
- `plan_ids` - IDs de planes válidos (starter, pro, plus)
- `plan_capabilities` - Capacidades por plan
- `plan_trials` - Configuración de trials por plan

---

## 2. Dependencies

- [`infraestructura`](./14-infraestructura.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)

- [`infraestructura`](./14-infraestructura.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)

Este nodo depende de los siguientes nodos:

- [`infraestructura`](./14-infraestructura.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)

---

Este nodo depende de los siguientes nodos:

- [`infraestructura.md`](./infraestructura.md)
- [`observabilidad.md`](./observabilidad.md)
- [`ssot-integration.md`](./ssot-integration.md)

### System Dependencies

- **Polar (Billing Provider)**
  - Checkout URL generation
  - Payment processing
  - Subscription management
  - Webhook delivery
  - Prorating calculations

- **Database (Supabase)**
  - Subscription records
  - Usage tracking tables
  - State machine persistence

- **Infrastructure Node**
  - Queue system for async processing
  - Database access patterns
  - Multi-tenant isolation

- **Observability Node**
  - Logging subscription events
  - Tracking state transitions
  - Monitoring payment failures
  - Usage analytics

- **SSOT Integration Node**
  - Plan definitions and limits
  - Subscription state definitions
  - Credit consumption rules
  - Plan capabilities

### Node Dependencies (GDD)

- `infraestructura.md`
- `observabilidad.md`
- `ssot-integration.md`

### Required By

The `billing` node is required by:

- `roasting-engine` — Needs plan limits and credit availability
- `analysis-engine` — Needs plan limits and credit availability
- `shield-engine` — Needs subscription state for service access
- `integraciones-redes-sociales` — Needs plan limits for account limits
- `observabilidad` — Needs billing data for analytics
- `frontend-user-app` — Needs subscription info for UI display
- `frontend-admin` — Needs billing data for admin panel

### Node Dependencies

According to `system-map-v2.yaml`, `billing` depends on:

- [`infraestructura.md`](./infraestructura.md) — Queue system and database
- [`observabilidad.md`](./observabilidad.md) — Logging and metrics
- [`ssot-integration.md`](./ssot-integration.md) — Plan definitions and rules

---

### Internal Dependencies

- [`analysis-engine.md`](./analysis-engine.md)
- [`frontend-admin.md`](./frontend-admin.md)
- [`frontend-user-app.md`](./frontend-user-app.md)
- [`integraciones-redes-sociales.md`](./integraciones-redes-sociales.md)
- [`roasting-engine.md`](./roasting-engine.md)
- [`shield-engine.md`](./shield-engine.md)

Este nodo depende de los siguientes nodos:

- [`infraestructura`](./14-infraestructura.md) - Colas y base de datos
- [`observabilidad`](./observabilidad.md) - Logging y métricas
- [`ssot-integration`](./15-ssot-integration.md) - Planes, límites y reglas

---

## 12. Related Nodes

- infraestructura (depends_on)
- observabilidad (depends_on)
- ssot-integration (depends_on)
- roasting-engine (required_by)
- analysis-engine (required_by)
- shield-engine (required_by)
- integraciones-redes-sociales (required_by)
- frontend-user-app (required_by)
- frontend-admin (required_by)
