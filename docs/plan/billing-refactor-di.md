# Plan: Refactor Billing.js con Dependency Injection - Issue #413

**Fecha:** 2025-10-04
**Branch:** fix/issue-413-stripe-webhooks
**Objetivo:** Refactorizar `src/routes/billing.js` para usar Dependency Injection, permitiendo testing con mocks
**Estado Actual:** 12/16 tests pasando (75%) - 4 tests fallan porque el mock no se ejecuta
**Meta:** 16/16 tests pasando (100%) + >90% cobertura + arquitectura SOLID

---

## 📊 Análisis del Problema Raíz

### Problema Identificado

**El mock de `StripeWebhookService` en los tests NO se ejecuta porque `billing.js` crea instancias de servicios en el momento de importar el módulo (líneas 24-39).**

**Código problemático actual:**

```javascript
// src/routes/billing.js (líneas 24-39)
let stripeWrapper = null;
let queueService = null;
let entitlementsService = null;
let webhookService = null;

if (flags.isEnabled('ENABLE_BILLING')) {
  stripeWrapper = new StripeWrapper(process.env.STRIPE_SECRET_KEY);
  queueService = new QueueService();
  queueService.initialize();
  entitlementsService = new EntitlementsService();
  webhookService = new StripeWebhookService();  // ❌ Hardcoded
} else {
  logger.warn('⚠️ Stripe billing disabled - missing configuration keys');
  entitlementsService = new EntitlementsService();
  webhookService = new StripeWebhookService();  // ❌ Hardcoded
}
```

**Por qué esto impide el testing:**

1. **Timing:** Las instancias se crean cuando Node.js importa el módulo
2. **Jest Hoisting:** `jest.mock()` se ejecuta DESPUÉS de que el módulo ya fue importado
3. **No hay forma de inyectar mocks:** Los tests no pueden reemplazar las instancias reales
4. **Violación SOLID:** Viola el principio de Inversión de Dependencias (DIP)

### Tests Afectados (4/16)

1. ❌ **should handle checkout events with missing user_id**
   - Espera: `processed: false` (mock debería rechazar)
   - Recibe: `processed: true` (servicio real procesa exitosamente)

2. ❌ **should handle database errors gracefully**
   - Espera: `processed: false` con error de DB
   - Recibe: `processed: true` (servicio real no simula error)

3. ❌ **should handle unrecognized event types gracefully**
   - Espera: mensaje "Unrecognized event type"
   - Recibe: "Event processed successfully"

4. ❌ **should allow webhook cleanup for admin users**
   - Espera: 200 con eventos eliminados
   - Recibe: 500 (servicio real no tiene mock de cleanupOldEvents)

### Diagnóstico Completo Realizado

**Tiempo invertido:** 2+ horas de debugging

**Intentos realizados:**
- ✅ Configurar `jest.mock()` correctamente en archivo de test
- ✅ Verificar que el mock devuelve valores correctos
- ✅ Eliminar imports tempranos de StripeWebhookService
- ✅ Cambiar `result.success` para coincidir con expectativas
- ✅ Crear test diagnóstico para confirmar ejecución del mock

**Resultado del diagnóstico:**
- Mock está correctamente configurado
- Mock NO se ejecuta porque billing.js tiene arquitectura no testeable
- **Solución requerida:** Refactorizar con Dependency Injection

---

## 🏗️ Arquitectura Propuesta: Dependency Injection

### Patrón a Implementar: Controller con Factory

**Conceptos clave:**

1. **Separar configuración de lógica:** Crear factory que instancia servicios
2. **Inyectar dependencias:** Pasar servicios como parámetros
3. **Mantener compatibilidad:** No romper código existente en producción

### Nueva Estructura

```
src/routes/
├── billing.js                 # Router con DI (refactorizado)
├── billingController.js       # Lógica de negocio separada (NUEVO)
└── billingFactory.js          # Factory para crear instancias (NUEVO)

tests/
└── integration/
    └── stripeWebhooksFlow.test.js  # Tests con DI (actualizado)
```

### Diseño del Controller

```javascript
// src/routes/billingController.js (NUEVO)
class BillingController {
  constructor({
    stripeWrapper,
    queueService,
    entitlementsService,
    webhookService,
    supabaseClient,
    logger,
    emailService,
    notificationService,
    workerNotificationService
  }) {
    // Inyectar todas las dependencias
    this.stripeWrapper = stripeWrapper;
    this.queueService = queueService;
    this.entitlementsService = entitlementsService;
    this.webhookService = webhookService;
    this.supabaseClient = supabaseClient;
    this.logger = logger;
    this.emailService = emailService;
    this.notificationService = notificationService;
    this.workerNotificationService = workerNotificationService;
  }

  // Métodos de negocio (extraídos de billing.js)
  async handleCheckoutCompleted(session) { /* ... */ }
  async handleSubscriptionUpdated(subscription) { /* ... */ }
  async handleSubscriptionDeleted(subscription) { /* ... */ }
  async handlePaymentSucceeded(invoice) { /* ... */ }
  async handlePaymentFailed(invoice) { /* ... */ }
  async applyPlanLimits(userId, plan, status) { /* ... */ }
  async queueBillingJob(jobType, webhookData) { /* ... */ }
}

module.exports = BillingController;
```

### Diseño del Factory

```javascript
// src/routes/billingFactory.js (NUEVO)
const StripeWrapper = require('../services/stripeWrapper');
const EntitlementsService = require('../services/entitlementsService');
const StripeWebhookService = require('../services/stripeWebhookService');
const QueueService = require('../services/queueService');
const { flags } = require('../config/flags');
const { logger } = require('../utils/logger');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const workerNotificationService = require('../services/workerNotificationService');
const { supabaseServiceClient } = require('../config/supabase');
const BillingController = require('./billingController');

class BillingFactory {
  static createController(dependencies = {}) {
    // Permitir override de dependencias (para tests)
    const {
      stripeWrapper = flags.isEnabled('ENABLE_BILLING')
        ? new StripeWrapper(process.env.STRIPE_SECRET_KEY)
        : null,
      queueService = new QueueService(),
      entitlementsService = new EntitlementsService(),
      webhookService = new StripeWebhookService(),
      supabaseClient = supabaseServiceClient,
      loggerInstance = logger,
      emailServiceInstance = emailService,
      notificationServiceInstance = notificationService,
      workerNotificationServiceInstance = workerNotificationService
    } = dependencies;

    // Inicializar queue si billing está habilitado
    if (flags.isEnabled('ENABLE_BILLING') && queueService) {
      queueService.initialize();
    }

    return new BillingController({
      stripeWrapper,
      queueService,
      entitlementsService,
      webhookService,
      supabaseClient,
      logger: loggerInstance,
      emailService: emailServiceInstance,
      notificationService: notificationServiceInstance,
      workerNotificationService: workerNotificationServiceInstance
    });
  }
}

module.exports = BillingFactory;
```

### Diseño del Router Refactorizado

```javascript
// src/routes/billing.js (REFACTORIZADO)
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');
const BillingFactory = require('./billingFactory');

const router = express.Router();

// Crear controller con DI (permite override en tests)
const billingController = BillingFactory.createController();

// Middleware para verificar billing disponible
const requireBilling = (req, res, next) => {
  if (!flags.isEnabled('ENABLE_BILLING')) {
    return res.status(503).json({
      success: false,
      error: 'Billing temporarily unavailable',
      code: 'BILLING_UNAVAILABLE'
    });
  }
  next();
};

// Endpoints usan el controller
router.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookSecurity({ /* ... */ }),
  async (req, res) => {
    if (!flags.isEnabled('ENABLE_BILLING')) {
      logger.warn('Webhook received but billing is disabled');
      return res.status(503).json({ error: 'Billing temporarily unavailable' });
    }

    const requestId = req.webhookSecurity?.requestId;
    let event;

    try {
      event = JSON.parse(req.body.toString());

      logger.info('Stripe webhook received:', {
        requestId,
        type: event.type,
        id: event.id
      });

      // Usar controller con DI inyectado
      const result = await billingController.webhookService.processWebhookEvent(event, {
        requestId,
        securityContext: req.webhookSecurity
      });

      // ... resto de la lógica
    } catch (error) {
      // ... manejo de errores
    }
  }
);

// Función para permitir override del controller (para tests)
router.setController = (controller) => {
  billingController = controller;
};

module.exports = router;
```

---

## 📋 Plan de Implementación Detallado

### FASE 1: Planning & GDD (30-45 min) ✅ EN PROGRESO

**Objetivo:** Crear plan completo y nodo GDD

#### Tarea 1.1: Crear plan completo ✅ ACTUAL
- [x] Analizar `billing.js` completo (líneas 1-1243)
- [x] Identificar todas las dependencias hardcodeadas
- [x] Diseñar arquitectura DI con Controller + Factory
- [x] Documentar en `docs/plan/billing-refactor-di.md`

#### Tarea 1.2: Crear nodo GDD `docs/nodes/billing.md`
- [ ] Definir propósito del nodo
- [ ] Listar dependencias:
  - `cost-control` (entitlements)
  - `queue-system` (job queueing)
  - `multi-tenant` (RLS, users)
  - `plan-features` (plan config)
- [ ] Definir contratos (inputs/outputs)
- [ ] Mapear agentes relevantes:
  - Task Assessor (assessment)
  - Front-end Dev (si UI billing)
  - Test Engineer (tests)
- [ ] Definir edges a otros nodos

#### Tarea 1.3: Validar grafo de dependencias
- [ ] Ejecutar `node scripts/resolve-graph.js billing`
- [ ] Confirmar que no hay ciclos
- [ ] Verificar que todas las dependencias existen
- [ ] Obtener confirmación del plan antes de proceder

**Criterio de éxito Fase 1:**
- ✅ Plan completo guardado en `docs/plan/billing-refactor-di.md`
- ✅ Nodo `docs/nodes/billing.md` creado y validado
- ✅ Grafo acíclico confirmado
- ✅ Confirmación explícita para proceder a Fase 2

---

### FASE 2: Refactor (1-2 horas)

**Objetivo:** Implementar DI sin romper funcionalidad existente

#### Tarea 2.1: Crear BillingController
- [ ] Crear archivo `src/routes/billingController.js`
- [ ] Definir constructor con inyección de dependencias
- [ ] Extraer métodos de negocio de `billing.js`:
  - `handleCheckoutCompleted` (líneas 756-850)
  - `handleSubscriptionUpdated` (líneas 856-956)
  - `handleSubscriptionDeleted` (líneas 962-1040)
  - `handlePaymentSucceeded` (líneas 1046-1083)
  - `handlePaymentFailed` (líneas 1089-1174)
  - `applyPlanLimits` (líneas 1182-1241)
  - `queueBillingJob` (líneas 602-750)
- [ ] Reemplazar referencias globales con `this.serviceName`
- [ ] Mantener toda la lógica de negocio intacta

#### Tarea 2.2: Crear BillingFactory
- [ ] Crear archivo `src/routes/billingFactory.js`
- [ ] Implementar método `createController(dependencies)`
- [ ] Permitir override de todas las dependencias
- [ ] Mantener lógica de inicialización (flags, queue.initialize())
- [ ] Documentar parámetros opcionales para tests

#### Tarea 2.3: Refactorizar billing.js
- [ ] Importar `BillingFactory` en lugar de servicios
- [ ] Crear controller al inicio: `const billingController = BillingFactory.createController()`
- [ ] Actualizar endpoints para usar `billingController.webhookService`
- [ ] Actualizar llamadas a handlers: `billingController.handleCheckoutCompleted()`
- [ ] Añadir método `router.setController()` para tests
- [ ] Eliminar instanciación directa de servicios (líneas 24-39)
- [ ] Verificar que no hay imports innecesarios

#### Tarea 2.4: Actualizar imports en archivos dependientes
- [ ] Buscar referencias a billing.js: `grep -r "require.*billing" src/`
- [ ] Verificar compatibilidad
- [ ] Ajustar imports si es necesario

**Criterio de éxito Fase 2:**
- ✅ 3 archivos nuevos creados: Controller, Factory, Router refactorizado
- ✅ Lógica de negocio preservada 100%
- ✅ No hay instanciación hardcodeada
- ✅ Compatibilidad hacia atrás mantenida

---

### FASE 3: Testing (1-2 horas)

**Objetivo:** Tests con >90% cobertura usando DI

#### Tarea 3.1: Actualizar tests de integración
- [ ] Modificar `tests/integration/stripeWebhooksFlow.test.js`
- [ ] Crear controller con mocks inyectados:
  ```javascript
  const BillingFactory = require('../../src/routes/billingFactory');
  const MockStripeWebhookService = jest.fn().mockImplementation(() => ({
    processWebhookEvent: jest.fn().mockImplementation(async (event) => {
      // ... mock logic
    }),
    getWebhookStats: jest.fn().mockResolvedValue({...}),
    cleanupOldEvents: jest.fn().mockResolvedValue({...})
  }));

  const billingController = BillingFactory.createController({
    webhookService: new MockStripeWebhookService(),
    stripeWrapper: mockStripeWrapper,
    // ... otros mocks
  });

  app.use('/api/billing', billingRouter);
  billingRouter.setController(billingController);
  ```
- [ ] Ejecutar tests: `npm test -- stripeWebhooksFlow.test.js`
- [ ] Confirmar 16/16 tests pasando (100%)

#### Tarea 3.2: Crear tests unitarios para BillingController
- [ ] Crear `tests/unit/routes/billingController.test.js`
- [ ] Testear cada método de negocio con mocks:
  - `handleCheckoutCompleted`
  - `handleSubscriptionUpdated`
  - `handleSubscriptionDeleted`
  - `handlePaymentSucceeded`
  - `handlePaymentFailed`
  - `applyPlanLimits`
  - `queueBillingJob`
- [ ] Verificar edge cases (errores, datos faltantes, transacciones)
- [ ] Cobertura objetivo: >90% de líneas

#### Tarea 3.3: Tests de BillingFactory
- [ ] Crear `tests/unit/routes/billingFactory.test.js`
- [ ] Testear creación con defaults
- [ ] Testear creación con overrides
- [ ] Verificar inicialización de queue
- [ ] Verificar manejo de flags (ENABLE_BILLING)

#### Tarea 3.4: Coverage report
- [ ] Ejecutar `npm run test:coverage`
- [ ] Confirmar >90% en:
  - `src/routes/billingController.js`
  - `src/routes/billingFactory.js`
  - `src/routes/billing.js`
- [ ] Generar reporte HTML
- [ ] Guardar en `docs/test-evidence/billing-refactor/`

**Criterio de éxito Fase 3:**
- ✅ 16/16 tests integración pasando (100%)
- ✅ Tests unitarios completos para Controller y Factory
- ✅ Cobertura >90% confirmada
- ✅ Reporte de coverage generado

---

### FASE 4: Validación (30 min)

**Objetivo:** Confirmar que no hay regresiones

#### Tarea 4.1: Test suite completo
- [ ] Ejecutar todos los tests: `npm test`
- [ ] Confirmar 0 tests fallando
- [ ] Verificar que no hay warnings de deprecation
- [ ] Revisar logs para confirmar no hay errores inesperados

#### Tarea 4.2: Tests de integración E2E
- [ ] Ejecutar `npm test -- tests/integration/`
- [ ] Confirmar que multi-tenant workflow pasa
- [ ] Confirmar que demo-flow pasa
- [ ] Verificar que otros workflows de billing funcionan

#### Tarea 4.3: Validación manual (si aplicable)
- [ ] Levantar servidor: `npm run dev`
- [ ] Probar endpoint `/api/billing/plans` (GET)
- [ ] Probar webhook endpoint (POST con mock event)
- [ ] Verificar logs en consola

**Criterio de éxito Fase 4:**
- ✅ Test suite completo pasa (0 failures)
- ✅ No hay regresiones detectadas
- ✅ Logs limpios sin errores

---

### FASE 5: Evidencias & Documentación (15 min)

**Objetivo:** Generar evidencias y actualizar spec.md

#### Tarea 5.1: Generar evidencias visuales
- [ ] Capturar screenshots de:
  - Test output (16/16 passing)
  - Coverage report (>90%)
  - Integration tests passing
- [ ] Guardar en `docs/test-evidence/billing-refactor/`
- [ ] Crear archivo `test-report.md` con resumen

#### Tarea 5.2: Actualizar spec.md
- [ ] Añadir sección "Billing Architecture" en spec.md
- [ ] Documentar patrón DI implementado
- [ ] Referenciar nodo `docs/nodes/billing.md`
- [ ] Añadir diagrama de dependencias:
  ```
  billing (router)
    ↓ uses
  billingController
    ↓ depends on
  [stripeWrapper, queueService, entitlementsService, webhookService, ...]
  ```
- [ ] Actualizar tabla de nodos en spec.md

#### Tarea 5.3: Actualizar CLAUDE.md
- [ ] Añadir sección sobre arquitectura billing
- [ ] Documentar cómo crear controladores con DI
- [ ] Añadir ejemplo de testing con DI

#### Tarea 5.4: Crear changelog
- [ ] Crear archivo `docs/test-evidence/billing-refactor/CHANGELOG.md`
- [ ] Documentar:
  - Problema original
  - Solución implementada
  - Tests arreglados (4 tests)
  - Cobertura alcanzada
  - Archivos modificados/creados

**Criterio de éxito Fase 5:**
- ✅ Evidencias guardadas en `docs/test-evidence/billing-refactor/`
- ✅ spec.md actualizado con nueva arquitectura
- ✅ CLAUDE.md actualizado
- ✅ CHANGELOG creado

---

## 🎯 Validación Final

### Checklist Pre-Commit

- [ ] **Tests:** 16/16 pasando en stripeWebhooksFlow.test.js
- [ ] **Coverage:** >90% en billing.js, billingController.js, billingFactory.js
- [ ] **No regresiones:** Test suite completo pasa
- [ ] **GDD:** Nodo `billing.md` creado y validado
- [ ] **Documentación:** spec.md y CLAUDE.md actualizados
- [ ] **Evidencias:** Screenshots y reportes guardados
- [ ] **Código:** Sin linters errors, sin TODOs pendientes

### Preguntas de Validación Respondidas

1. **¿Cuál es el objetivo del refactor?**
   - Implementar Dependency Injection en billing.js para permitir testing con mocks, logrando 16/16 tests pasando y >90% coverage.

2. **¿Por qué NO debemos modificar tests para que pasen sin arreglar el código?**
   - Porque sería ocultar el problema real (arquitectura no testeable) en lugar de arreglarlo. Los tests están revelando un bug arquitectural legítimo.

3. **¿Qué patrón arquitectural vamos a usar?**
   - **Dependency Injection** con patrón **Controller** + **Factory** para separar lógica de negocio de instanciación de servicios.

4. **¿Qué documentación GDD debes crear/actualizar?**
   - `docs/plan/billing-refactor-di.md` (plan)
   - `docs/nodes/billing.md` (nodo GDD)
   - `spec.md` (arquitectura global)
   - `CLAUDE.md` (guías de desarrollo)

5. **¿Cuál es la cobertura mínima de tests?**
   - **>90% de cobertura** con tests unitarios + integración que cubren 100% de los endpoints.

---

## 📊 Estimación de Tiempo

| Fase | Tarea | Tiempo Estimado | Tiempo Real |
|------|-------|-----------------|-------------|
| 1 | Planning & GDD | 30-45 min | ⏱️ En progreso |
| 2 | Refactor | 1-2 horas | - |
| 3 | Testing | 1-2 horas | - |
| 4 | Validación | 30 min | - |
| 5 | Evidencias | 15 min | - |
| **Total** | **3-4.5 horas** | **-** |

---

## 🚦 Criterios de Aceptación

### Issue #413 Completo Cuando:

- [x] Fase 1: Plan completo creado y validado
- [ ] Fase 2: DI implementado en billing.js sin romper código
- [ ] Fase 3: 16/16 tests pasando + >90% coverage
- [ ] Fase 4: Test suite completo pasa sin regresiones
- [ ] Fase 5: Evidencias generadas y docs actualizados
- [ ] **16/16 tests en stripeWebhooksFlow.test.js pasando (100%)**
- [ ] **Cobertura >90% en archivos billing**
- [ ] **Nodo GDD billing.md creado**
- [ ] **spec.md y CLAUDE.md actualizados**
- [ ] **0 shortcuts tomados, calidad de producción**

---

## 🔄 Estrategia de Rollback

**Si algo falla durante el refactor:**

1. **Fase 2:** Si refactor rompe tests → revertir a branch anterior, revisar plan
2. **Fase 3:** Si tests no pasan → verificar mocks inyectados correctamente
3. **Fase 4:** Si hay regresiones → revisar cambios en billing.js línea por línea
4. **Cualquier momento:** Commit frecuente para poder hacer rollback granular

**Comando de rollback:**
```bash
git stash
git checkout fix/issue-413-stripe-webhooks
git reset --hard <commit_id_antes_refactor>
```

---

## 📚 Referencias

- **Issue Original:** #413 - Stripe Webhooks Integration Tests
- **Problema Raíz:** Mocks no se ejecutan por instanciación hardcodeada
- **Patrón SOLID:** Dependency Inversion Principle (DIP)
- **Documentación Jest:** [Manual Mocks](https://jestjs.io/docs/manual-mocks)
- **Documentación DI:** [Dependency Injection in Node.js](https://blog.risingstack.com/dependency-injection-in-node-js/)

---

## ✅ Estado Actual

**Fase Actual:** FASE 1 - Planning & GDD ✅ EN PROGRESO

**Próximo paso:** Crear `docs/nodes/billing.md` y validar grafo

**NO PROCEDER a Fase 2 sin confirmación explícita del plan**
