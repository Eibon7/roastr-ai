# Plan: Issue #945 - Migrar endpoints de Billing (Polar) a Zod

**Prioridad:** 🟥 P0 - Crítico  
**Labels:** enhancement, high-priority, backend, billing, Security  
**AC Count:** 7 (≥3 → Plan completo requerido)

---

## Estado Actual

**Endpoints afectados:**
- `POST /api/polar/checkout`
- `POST /api/polar/webhook`

**Validación actual:**
- Usando `express-validator` (inconsistente con estándar del proyecto)
- Sin validación estricta de estructura de eventos Polar
- Sin validación de firma de webhooks
- Riesgo de event spoofing (dinero real involucrado)

**Problema crítico:**
- Estos endpoints manejan dinero real
- Datos corruptos → activación incorrecta de suscripciones
- Event spoofing → planes activados sin pagar
- **Zod es obligatorio para seguridad**

---

## Objetivos

1. **Migrar validación de express-validator a Zod**
2. **Crear esquemas Zod para eventos Polar**
3. **Validar estructura de eventos externos**
4. **Validar firma de webhook (si disponible)**
5. **Eliminar express-validator de estos endpoints**
6. **Tests unitarios + integración**
7. **NO breaking changes en API contracts**

---

## Pasos de Implementación

### 1. Análisis Pre-Implementación
- [ ] Leer archivos existentes:
  - `src/routes/polarWebhook.js`
  - `src/routes/checkout.js` (si existe)
  - Buscar otros endpoints Polar
- [ ] Revisar documentación Polar:
  - Estructura de eventos (checkout.created, subscription.created, etc.)
  - Validación de firma (webhook signature)
  - Tipos de datos (product_id, price_id, customer_email, etc.)
- [ ] Verificar Zod instalado: `package.json` (v3.25.76 según issue)

### 2. Crear Esquemas Zod
- [ ] Crear `src/validators/zod/billing.schema.js`:
  ```javascript
  const { z } = require('zod');

  // Checkout schema
  const checkoutSchema = z.object({
    product_id: z.string().uuid(),
    price_id: z.string().uuid(),
    customer_email: z.string().email(),
    metadata: z.record(z.any()).optional()
  });

  // Webhook event types (enum)
  const polarEventTypes = z.enum([
    'checkout.created',
    'checkout.completed',
    'subscription.created',
    'subscription.updated',
    'subscription.cancelled',
    'payment.succeeded',
    'payment.failed'
  ]);

  // Webhook schema (base)
  const webhookSchema = z.object({
    event_type: polarEventTypes,
    data: z.object({}).passthrough(), // Validar según event_type
    signature: z.string().optional(),
    timestamp: z.string().datetime().optional()
  });

  // Specific event schemas
  const subscriptionCreatedSchema = z.object({
    event_type: z.literal('subscription.created'),
    data: z.object({
      subscription_id: z.string().uuid(),
      customer_id: z.string().uuid(),
      product_id: z.string().uuid(),
      price_id: z.string().uuid(),
      status: z.enum(['active', 'trialing', 'past_due', 'canceled']),
      current_period_start: z.string().datetime(),
      current_period_end: z.string().datetime()
    })
  });

  // ... (más event schemas según Polar docs)
  ```

- [ ] Exportar esquemas + helpers:
  ```javascript
  module.exports = {
    checkoutSchema,
    webhookSchema,
    subscriptionCreatedSchema,
    // ... otros eventos
    validateCheckout,
    validateWebhook
  };
  ```

### 3. Crear Helpers de Validación
- [ ] Crear helper para formatear errores Zod:
  ```javascript
  function formatZodError(error) {
    return error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }));
  }
  ```

- [ ] Crear middleware de validación:
  ```javascript
  function validateZodSchema(schema) {
    return (req, res, next) => {
      try {
        const validated = schema.parse(req.body);
        req.validatedData = validated;
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: 'Validation failed',
            details: formatZodError(error)
          });
        }
        next(error);
      }
    };
  }
  ```

### 4. Actualizar Routes
- [ ] Modificar `src/routes/polarWebhook.js`:
  - Eliminar `express-validator` imports
  - Importar esquemas Zod: `const { webhookSchema, validateWebhook } = require('../validators/zod/billing.schema');`
  - Reemplazar validación:
    ```javascript
    // Antes:
    router.post('/webhook', [
      body('event_type').notEmpty(),
      body('data').isObject()
    ], handler);

    // Después:
    router.post('/webhook', validateZodSchema(webhookSchema), handler);
    ```

- [ ] Modificar `src/routes/checkout.js` (si existe):
  - Similar proceso
  - Validar `product_id`, `price_id`, `customer_email`
  - Usar `validateZodSchema(checkoutSchema)`

### 5. Validación de Firma (Webhook Security)
- [ ] Investigar Polar webhook signature:
  - Header: `X-Polar-Signature` (verificar docs)
  - Algoritmo: HMAC-SHA256 (verificar docs)
- [ ] Implementar validación:
  ```javascript
  function verifyPolarSignature(req) {
    const signature = req.headers['x-polar-signature'];
    const secret = process.env.POLAR_WEBHOOK_SECRET;
    
    if (!signature || !secret) {
      throw new Error('Missing signature or secret');
    }

    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
  ```

- [ ] Añadir middleware de firma antes de validación Zod

### 6. Tests Unitarios
- [ ] Crear `tests/unit/validators/billing.schema.test.js`:
  - Test esquema checkout válido
  - Test checkout con email inválido
  - Test checkout con product_id no UUID
  - Test webhook con event_type inválido
  - Test webhook con data corrupta
  - Test eventos específicos (subscription.created, payment.succeeded)
  - Test formateo de errores Zod

### 7. Tests de Integración
- [ ] Crear `tests/integration/polarWebhook.test.js`:
  - Mock eventos Polar reales (desde docs)
  - Test POST /api/polar/webhook con evento válido
  - Test POST /api/polar/webhook con evento inválido (400)
  - Test POST /api/polar/webhook sin signature (403 si requerida)
  - Test POST /api/polar/webhook con signature inválida (403)
  - Test POST /api/polar/checkout con datos válidos
  - Test POST /api/polar/checkout con email malformado (400)
  - Verificar que eventos inválidos NO activan suscripciones

### 8. Verificación de Seguridad
- [ ] Ejecutar Security Audit Skill:
  - Verificar NO hardcoded credentials
  - Verificar env vars cargadas desde .env
  - Verificar sanitización de inputs
  - Verificar timing-safe comparison en firma

### 9. Documentación
- [ ] Actualizar `docs/nodes/cost-control.md`:
  - Añadir sección "Validación Zod en Billing"
  - Documentar esquemas Zod
  - Añadir ejemplos de eventos válidos/inválidos
- [ ] Actualizar `API_CONTRACTS.md` (si existe):
  - Especificar estructura de requests/responses
  - Documentar códigos de error (400 para validación)

---

## Agentes Involucrados

### TaskAssessor
- **Trigger:** AC ≥3 (7 AC), P0 crítico
- **Responsabilidad:** Validar completitud del plan
- **Receipt:** `docs/agents/receipts/issue-945-TaskAssessor.md`

### TestEngineer
- **Trigger:** Cambios en src/, tests/, nuevo feature crítico
- **Responsabilidad:**
  - Generar tests unitarios (validators)
  - Generar tests integración (endpoints)
  - Verificar coverage ≥90%
- **Receipt:** `docs/agents/receipts/issue-945-TestEngineer.md`

### Guardian
- **Trigger:** billing, security, P0
- **Responsabilidad:**
  - Auditar seguridad de validación
  - Verificar NO hardcoded secrets
  - Validar firma de webhook
  - Ejecutar `node scripts/guardian-gdd.js --full`
- **Receipt:** `docs/agents/receipts/issue-945-Guardian.md`

---

## Archivos Afectados

### Nuevos
- `src/validators/zod/billing.schema.js` (esquemas Zod)
- `tests/unit/validators/billing.schema.test.js` (tests unitarios)
- `tests/integration/polarWebhook.test.js` (tests integración)

### Modificados
- `src/routes/polarWebhook.js` (migrar a Zod)
- `src/routes/checkout.js` (si existe, migrar a Zod)
- `docs/nodes/cost-control.md` (documentar validación)
- `API_CONTRACTS.md` (si existe, actualizar)

### Eliminados
- Referencias a `express-validator` en endpoints de billing

---

## Validación de Completitud

### Pre-Merge Checklist
- [ ] Tests pasando al 100%
- [ ] Coverage ≥90% en archivos nuevos/modificados
- [ ] 0 comentarios CodeRabbit
- [ ] GDD health ≥87
- [ ] Validación GDD sin errores
- [ ] Todos los AC marcados como completos
- [ ] Receipts de agentes generados
- [ ] Documentación actualizada

### Acceptance Criteria (7)
- [ ] Todos los endpoints de billing usan Zod
- [ ] express-validator eliminado
- [ ] Tests pasando al 100%
- [ ] Validación estricta de eventos externos
- [ ] Eventos inválidos rechazados con 400
- [ ] No breaking changes en API contracts
- [ ] Seguridad mejorada contra event spoofing

### Validation Commands
```bash
# Tests
npm test -- billing
npm test -- polarWebhook
npm run test:coverage

# GDD
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci

# Security
node scripts/guardian-gdd.js --full

# CodeRabbit
npm run coderabbit:review
```

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|-----------|
| Breaking changes en API | Media | Alto | Tests de integración con contratos existentes |
| Event spoofing | Alta (sin fix) | Crítico | Validación de firma HMAC obligatoria |
| Datos corruptos → suscripción incorrecta | Alta (sin fix) | Crítico | Validación Zod estricta + tests exhaustivos |
| Polar API cambia estructura | Baja | Medio | Tests con eventos reales + monitoreo |

---

## Notas de Implementación

### ⚠️ CRÍTICO
- **Dinero real involucrado** → NO skip validación
- **Event spoofing** → Validar firma SIEMPRE
- **Tests exhaustivos** → Cubrir edge cases (email malformado, UUIDs inválidos, etc.)
- **NO hardcoded credentials** → Usar `process.env.POLAR_WEBHOOK_SECRET`

### Patrones de coderabbit-lessons.md aplicables
- **Testing Patterns (#2):** TDD - Tests ANTES de implementación
- **Security (#6):** NO hardcoded credentials, validar env vars
- **Error Handling (#5):** Errores específicos (E_VALIDATION_FAILED), códigos HTTP correctos (400)
- **JSDoc (#3):** Documentar funciones exportadas

---

**Creado:** 2025-11-24  
**Autor:** Orchestrator  
**Status:** Planificado → Implementación siguiente

