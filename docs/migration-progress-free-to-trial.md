# Migración 'free' → 'starter_trial' - Progress Report

**Fecha:** 2025-11-08
**PR:** #756
**Branch:** `claude/work-on-issues-011CUu8p8q5FGKti8WseVqbw`

---

## ✅ Fase 1: Core Services - COMPLETADA

### Archivos Migrados (13 archivos)

| Archivo | Referencias | Status |
|---------|-------------|--------|
| authService.js | 4 | ✅ |
| subscriptionService.js | 2 | ✅ |
| workerNotificationService.js | 1 | ✅ |
| stripeWebhookService.js | 3 | ✅ |
| modelAvailabilityService.js | 2 | ✅ |
| userIntegrationsService.js | 8 | ✅ |
| requirePlan.js | 4 | ✅ |
| inputValidation.js | 2 | ✅ |
| roastGeneratorEnhanced.js | 9 | ✅ |
| monitoring.js | 1 | ✅ |
| modelAvailability.js (routes) | 2 | ✅ |
| planLimitsService.js | 3 | ✅ (previo) |
| **planService.js** | CRÍTICO | ✅ ELIMINADO 'free', AGREGADO 'starter_trial' |

**Total migrado:** ~40 referencias

---

## ⚠️ Fase 2: Archivos Adicionales Detectados - PENDIENTE

**Total de referencias restantes:** 76

### Archivos Críticos Pendientes

#### Alta Prioridad

1. **src/workers/BillingWorker.js** - 13+ referencias
   - Downgrades a 'free'
   - Default plan assignments
   - Trial expirations

2. **src/routes/user.js** - 9+ referencias
   - User plan logic
   - Entitlements
   - Plan switches

3. **src/routes/plan.js** - 4 referencias
   - Plan definitions
   - Plan fallbacks

4. **src/routes/auth.js** - 1 referencia
   - `validPlans` array

#### Media Prioridad

5. **src/utils/polarHelpers.js** - 2 referencias
   - Polar billing system (alternativo a Stripe)
   - Price ID mappings

6. **src/routes/polarWebhook.js** - 2 referencias
   - Polar webhooks
   - Downgrades

7. **src/routes/revenue.js** - 1 referencia
   - Revenue filtering (`.neq('plan', 'free')`)

#### Baja Prioridad (Config/CLI)

8. **src/config/planMappings.js**
9. **src/config/tierMessages.js**
10. **src/config/supabase.js** (mocks)
11. **src/cli/user-manager.js**

---

## 📋 Cambios Realizados

### Plan 'starter_trial' - Nueva Definición

```javascript
starter_trial: {
  id: 'starter_trial',
  name: 'Starter Trial',
  price: 0,
  currency: 'eur',
  duration: {
    days: 30,
    type: 'fixed',      // Fixed trial period
    renewalType: 'manual' // Must upgrade manually
  },
  limits: {
    roastsPerMonth: 10,
    commentsPerMonth: 1000,  // ⬆️ Upgrade from 100
    platformIntegrations: 1
  },
  features: {
    basicSupport: true,
    shield: true,            // ⬆️ Enabled during trial
    // Resto: false
  }
}
```

**Diferencias clave vs antiguo 'free':**
- ✅ Shield habilitado en trial
- ✅ 1000 comments/month (vs 100)
- ✅ Trial type: 'fixed' (no rolling)
- ✅ Renewal: 'manual' (debe upgrade)

---

## 🎯 Modelo de Negocio Documentado

**Archivo:** `docs/TRIAL-MODEL.md`

### Flujos Core

1. **Signup** → `starter_trial` automático (30 días)
2. **Trial expiry** → Acceso UI ✅ / Procesamiento ❌
3. **Early upgrade** → Trial se cancela inmediatamente
4. **Cancellation** → Acceso hasta fin de período, luego read-only
5. **Failed payment** → Mismo comportamiento que expiry

### Comportamiento Post-Expiry

- ✅ Puede acceder a la plataforma
- ✅ Puede ver histórico (roasts, analytics)
- ❌ NO se analizan comentarios
- ❌ NO se generan roasts
- ❌ NO funciona Shield

---

## 🧪 Testing

### Tests Ejecutándose

```bash
npm test
```

**Estado:** En progreso
**Archivos de test afectados:** TBD

### Tests Esperados

- ✅ Default plan es `starter_trial`
- ✅ No existe plan 'free' en PLAN_FEATURES
- ✅ Fallbacks usan `starter_trial`
- ✅ Model preferences incluyen `starter_trial`

---

## 📊 Próximos Pasos

### Opción A: Migración Completa (Recomendado)

Migrar los 76 archivos restantes para eliminar TODA referencia a 'free':

1. **BillingWorker.js** (crítico)
2. **routes/user.js** (crítico)
3. **routes/plan.js**
4. **routes/auth.js**
5. **polarHelpers.js** + **polarWebhook.js** (si Polar está activo)
6. Config files (planMappings, tierMessages)

**Estimación:** 2-3 horas adicionales

### Opción B: Migración Parcial

Mantener algunos 'free' legacy para compatibilidad hacia atrás:

- Migrar solo archivos críticos (BillingWorker, user routes)
- Dejar config files con soporte legacy
- Agregar mapping `'free' → 'starter_trial'` en planMappings.js

**Estimación:** 1 hora adicional

### Opción C: Pause y Validar

- Validar tests actuales
- Decidir estrategia basado en resultados
- Potencialmente dividir en múltiples PRs

---

## 🚨 Riesgos Identificados

1. **BillingWorker.js sin migrar:** Puede asignar 'free' en downgrades
2. **routes/user.js sin migrar:** Entitlements pueden usar 'free'
3. **Polar system:** Si está activo, puede crear inconsistencias
4. **Tests:** Pueden fallar por referencias a plan inexistente

---

## 📝 Notas

- No hay usuarios existentes con 'free' plan (confirmado por usuario)
- Modelo es trial de 30 días, luego pago obligatorio
- Sin plan 'free' permanente en el sistema
- Comportamiento post-expiry: acceso UI pero sin procesamiento

---

**Actualizado:** 2025-11-08 16:01 UTC
