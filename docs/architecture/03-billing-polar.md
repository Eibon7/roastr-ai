# GDD Node — Sistema de Billing (Polar) v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Summary

Sistema de billing exclusivo con Polar que gestiona suscripciones, trials, pagos, upgrades/downgrades, cancelaciones, webhooks y límites mensuales. Controla estados de suscripción que determinan si el servicio (Shield, Roasts, Ingestión) está activo o pausado.

---

## 2. Responsibilities

### Funcionales:

- Gestionar 3 planes: Starter, Pro, Plus
- Trials: Starter (30 días), Pro (7 días), Plus (sin trial)
- Checkout y validación de método de pago
- Upgrades/downgrades con prorrateos
- Cancelación con corte inmediato durante trial
- Cancelación programada durante ciclo pagado
- Procesar webhooks de Polar (idempotentes)
- Actualizar límites mensuales (análisis, roasts)
- Detectar límites agotados y pausar servicios

### No Funcionales:

- Idempotencia en webhooks
- State machine determinista
- Trazabilidad de todos los eventos
- Reintentos en fallos de pago (5 días)

---

## 3. Inputs

- **Checkout**: plan seleccionado, método de pago
- **Webhooks Polar**:
  - `subscription_created`
  - `subscription_active`
  - `subscription_canceled`
  - `subscription_updated`
  - `invoice_payment_failed`
  - `invoice_payment_succeeded`
- **Usuario**: acciones de upgrade, downgrade, cancelación
- **Workers**: consumo de análisis y roasts

---

## 4. Outputs

- **Estado de suscripción**: `trialing`, `active`, `paused`, `canceled_pending`, `payment_retry`
- **Límites actualizados**: analysis_remaining, roasts_remaining
- **Eventos de billing**: logged en `billing_events`
- **Workers ON/OFF**: según estado y límites
- **UI**: badges, banners, CTAs según estado

---

## 5. Rules

### Planes v2 (ÚNICOS VÁLIDOS):

```typescript
type PlanId = 'starter' | 'pro' | 'plus';
```

❌ PROHIBIDO: `free`, `basic`, `creator_plus` (legacy v1)

### Límites por Plan:

| Plan    | analysis_limit | roast_limit | accounts_per_platform | sponsors | tone_personal |
| ------- | -------------- | ----------- | --------------------- | -------- | ------------- |
| starter | 1,000          | 5           | 1                     | false    | false         |
| pro     | 10,000         | 1,000       | 2                     | false    | true          |
| plus    | 100,000        | 5,000       | 2                     | true     | true          |

### Trials:

| Plan    | trial_enabled | trial_days |
| ------- | ------------- | ---------- |
| starter | true          | 30         |
| pro     | true          | 7          |
| plus    | false         | 0          |

**⚠️ REGLA CRÍTICA**: Si usuario cancela durante trial → **trial termina INMEDIATAMENTE**

- Estado → `paused`
- Sin servicio (Shield OFF, Roasts OFF, Ingestión OFF)
- No hay cobro
- Workers OFF

### Estados de Suscripción:

```typescript
type SubscriptionState =
  | 'trialing'
  | 'expired_trial_pending_payment'
  | 'payment_retry'
  | 'active'
  | 'canceled_pending'
  | 'paused';
```

### State Machine (Transiciones):

**1. Trial → Active**:

- Cobro OK al final del trial → `active`

**2. Trial → Paused**:

- Cancelación durante trial → `paused` (inmediato)
- Cobro falla tras recobro → `paused`

**3. Active → Canceled_pending**:

- Usuario cancela durante ciclo pagado
- Servicio continúa hasta `current_period_end`

**4. Canceled_pending → Paused**:

- Llega `current_period_end`
- Servicio se detiene

**5. Payment_retry**:

- Cobro falla → recobro hasta 5 días
- Si resuelve → `active`
- Si no resuelve → `paused`

**6. Reactivación**:

- Antes de fin de ciclo → `active` sin nuevo cobro, límites NO reiniciados
- Después de fin de ciclo → checkout nuevo + cobro → `active` con límites reseteados

### Límites Agotados:

**A) analysis_remaining = 0**:

- ❌ Workers de ingestión OFF
- ❌ No se ingiere ningún comentario nuevo
- ❌ No se ejecutan análisis, Shield ni Roasts
- ❌ El sistema completo se detiene para ese usuario
- ✅ UI muestra únicamente el histórico existente
- ✅ Banner: "Has agotado los análisis"

**B) roasts_remaining = 0**:

- ✅ Shield sigue funcionando (mientras haya análisis)
- ❌ No se generan nuevos Roasts (ni auto-approve ni manual)
- ✅ UI muestra: "Límite de roasts alcanzado"

### Webhooks (Mapeo):

| Webhook Polar               | Transición                                       |
| --------------------------- | ------------------------------------------------ |
| `subscription_created`      | → `trialing` (Starter/Pro) o `active` (Plus)     |
| `subscription_active`       | → `active`                                       |
| `subscription_canceled`     | → `canceled_pending`                             |
| `invoice_payment_failed`    | → `payment_retry`                                |
| `invoice_payment_succeeded` | → `active` (reinicia límites)                    |
| `subscription_updated`      | upgrade/downgrade (sin cambiar estado principal) |

**Regla idempotencia**: Todos los webhooks pasan por `billingStateMachine(currentState, event)` puro.

---

## 6. Dependencies

### Servicios Externos:

- **Polar**: Único proveedor de billing v2
- **Supabase**: Tablas `subscriptions`, `subscriptions_usage`, `billing_events`

### SSOT:

- Límites por plan: `plan_settings.analysis_per_month`, `roasts_per_month`, `max_accounts_per_platform`
- Trial días: `plan_settings.trial_days`
- Estados válidos: `subscription_states`

### Workers:

- `BillingUpdate`: Actualiza contadores de uso
- `FetchComments`: Se detiene si `analysis_remaining = 0`
- `GenerateRoast`: Se detiene si `roasts_remaining = 0`

### Nodos Relacionados:

- `02-autenticacion-usuarios.md` (Validación método de pago en signup)
- `04-integraciones.md` (Pausar cuentas según billing)
- `08-workers.md` (Workers ON/OFF según estado)
- `09-panel-usuario.md` (UI de billing)
- `10-panel-administracion.md` (Métricas de billing)

---

## 7. Edge Cases

1. **Usuario agota análisis durante el mes**:
   - Workers de ingestión OFF inmediatamente
   - No se ejecutan análisis, Shield ni Roasts
   - El sistema completo se detiene para ese usuario
   - UI muestra únicamente el histórico existente
   - Banner: "Mejora tu plan para continuar"

2. **Upgrade durante trial Starter → Pro**:
   - Sale de trial Starter
   - Entra en `active` Pro (sin nuevo trial)
   - Límites actualizados inmediatamente

3. **Upgrade a Plus**:
   - Cobro inmediato
   - Nuevo ciclo
   - Suma análisis y roasts restantes a los nuevos límites

4. **Downgrade Pro → Starter**:
   - Si en trial → inmediato
   - Si activo → programado para siguiente ciclo
   - Sponsors se desactivan si baja desde Plus

5. **Tarjeta caducada / robada**:
   - `invoice_payment_failed`
   - Emails de aviso
   - Reintentos 5 días
   - Si no resuelve → `paused`

6. **Reactivación después de cancelación**:
   - Si antes de `current_period_end` → `active` sin cobrar, límites NO reiniciados
   - Si después → checkout nuevo, cobro, límites reseteados

7. **Intento de trial en Plus**:
   - Error 400: "Plus no incluye periodo de prueba"

8. **Cancelación manual por admin**:
   - Workers se detienen
   - Shield OFF, Roasts OFF, Ingestión OFF
   - Usuario puede reactivar desde Billing

---

## 8. Acceptance Criteria

### Planes:

- [ ] Solo 3 planes válidos: `starter`, `pro`, `plus`
- [ ] Límites por plan según SSOT
- [ ] Trials: Starter (30d), Pro (7d), Plus (0d)
- [ ] Trial requiere método de pago válido

### Estados:

- [ ] State machine implementada con 6 estados
- [ ] Transiciones deterministas
- [ ] Webhooks idempotentes
- [ ] Logs de todos los eventos

### Cancelación Trial:

- [ ] Cancelación durante trial → corte inmediato
- [ ] Estado → `paused`
- [ ] Workers OFF
- [ ] Sin servicio

### Cancelación Ciclo Pagado:

- [ ] Estado → `canceled_pending`
- [ ] Servicio continúa hasta `current_period_end`
- [ ] Al llegar fecha → `paused`

### Límites:

- [ ] analysis_remaining = 0 → Ingestión OFF
- [ ] roasts_remaining = 0 → Roasts OFF (Shield sigue si hay análisis)
- [ ] UI muestra badges y banners correctos

### Webhooks:

- [ ] `subscription_created` → `trialing` o `active`
- [ ] `subscription_active` → `active`
- [ ] `subscription_canceled` → `canceled_pending`
- [ ] `invoice_payment_failed` → `payment_retry`
- [ ] `invoice_payment_succeeded` → `active` + reinicio límites
- [ ] `subscription_updated` → upgrade/downgrade

### Reactivación:

- [ ] Antes fin ciclo → sin cobro, límites NO reiniciados
- [ ] Después fin ciclo → checkout + cobro + límites reseteados

---

## 9. Test Matrix

### Unit Tests (Vitest):

- ✅ State machine (transiciones)
- ✅ Cálculo de límites restantes
- ✅ Lógica de upgrade/downgrade
- ✅ Validación de planes válidos
- ❌ NO testear: Polar SDK directamente

### Integration Tests (Supabase Test):

- ✅ Webhook `subscription_created` actualiza BD
- ✅ Webhook `subscription_active` cambia estado
- ✅ Webhook `invoice_payment_failed` inicia recobro
- ✅ Webhook `invoice_payment_succeeded` reinicia límites
- ✅ Límites agotados → workers OFF
- ✅ Cancelación durante trial → pausa inmediata
- ✅ Cancelación durante ciclo → `canceled_pending`
- ✅ Reactivación antes/después de fin ciclo

### E2E Tests (Playwright):

- ✅ Signup con checkout Polar (mock)
- ✅ Trial activo → uso normal
- ✅ Cancelación trial → pérdida de acceso
- ✅ Upgrade plan → límites actualizados
- ✅ Límite agotado → banner en UI
- ✅ Reactivación → acceso restaurado

---

## 10. Implementation Notes

### Polar SDK Setup:

```typescript
// apps/backend-v2/src/lib/polarClient.ts
import { Polar } from '@polar-sh/sdk';

export const polar = new Polar({
  accessToken: process.env.POLAR_API_KEY!
});
```

### State Machine (Pura):

```typescript
// apps/backend-v2/src/services/billingStateMachine.ts
export function billingStateMachine(
  currentState: SubscriptionState,
  event: PolarWebhookEvent
): SubscriptionState {
  switch (event.type) {
    case 'subscription_created':
      return event.plan === 'plus' ? 'active' : 'trialing';

    case 'subscription_active':
      return 'active';

    case 'subscription_canceled':
      return 'canceled_pending';

    case 'invoice_payment_failed':
      return 'payment_retry';

    case 'invoice_payment_succeeded':
      return 'active';

    default:
      return currentState;
  }
}
```

### Webhooks Controller:

```typescript
// apps/backend-v2/src/routes/webhooks/polar.ts
import express from 'express';
import { billingStateMachine } from '../../services/billingStateMachine';

router.post('/polar', async (req, res) => {
  const event = req.body;

  // Verificar firma
  if (!verifyPolarSignature(event, req.headers['polar-signature'])) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Procesar evento (idempotente)
  const subscription = await getSubscription(event.subscription_id);
  const newState = billingStateMachine(subscription.state, event);

  await updateSubscription(event.subscription_id, {
    state: newState
    // ... otros campos
  });

  // Log
  await logBillingEvent(event);

  res.json({ received: true });
});
```

### Límites Check:

```typescript
// apps/backend-v2/src/services/billingService.ts
export async function hasAnalysisAvailable(userId: string): Promise<boolean> {
  const usage = await getUsage(userId);
  return usage.analysis_remaining > 0;
}

export async function hasRoastsAvailable(userId: string): Promise<boolean> {
  const usage = await getUsage(userId);
  return usage.roasts_remaining > 0;
}
```

### Referencias:

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 3)
- SSOT: `docs/SSOT/roastr-ssot-v2.md` (secciones 1, 2)
- Polar Docs: https://docs.polar.sh/
