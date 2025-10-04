# Plan: Arreglar 4 Tests Restantes de Stripe Webhooks - Issue #413

**Estado Actual:** 12/16 tests pasando (75%)
**Objetivo:** 16/16 tests pasando (100%)
**Branch:** fix/issue-413-stripe-webhooks

## Estado Actual del Assessment

### Tests Pasando (12/16)
- ✅ Signature verification (3/3)
- ✅ Checkout completion successfully (1/1)
- ✅ Idempotent checkout events (1/1)
- ✅ Subscription events (2/2)
- ✅ Payment events (2/2)
- ✅ Webhook statistics (1/1)
- ✅ Non-admin access denial (1/1)

### Tests Fallando (4/16)
1. ❌ should handle checkout events with missing user_id
2. ❌ should handle database errors gracefully
3. ❌ should handle unrecognized event types gracefully
4. ❌ should allow webhook cleanup for admin users

## Análisis Raíz del Problema

### Arquitectura Actual
```
jest.mock() at file top
  ↓
billing.js imports StripeWebhookService
  ↓
new StripeWebhookService() creates instance
  ↓
webhookService.processWebhookEvent() called
  ↓
Mock implementation should execute
```

### Problema Identificado
El mock de StripeWebhookService está correctamente configurado en jest.mock(), pero los tests están fallando porque:

1. **Mock no recibe el evento esperado**: El evento se parsea de Buffer en el handler
2. **Logging no funciona**: console.log en el mock no se muestra en output de Jest
3. **Condiciones del mock pueden no coincidir**: Necesitamos verificar estructura exacta del evento

## Plan de Acción

### Fase 1: Diagnosticar Por Qué Mock No Funciona

**Acción 1.1:** Verificar que el mock se está usando
- Leer src/routes/billing.js para ver cómo instancia StripeWebhookService
- Confirmar que billing.js usa `new StripeWebhookService()`
- Verificar que el mock constructor se ejecuta

**Acción 1.2:** Agregar assertions en el test para verificar llamadas al mock
- Usar `jest.spyOn()` para interceptar llamadas
- Verificar que `processWebhookEvent` fue llamado
- Inspeccionar argumentos recibidos

**Acción 1.3:** Simplificar el test para aislar el problema
- Crear test mínimo que solo verifica que el mock responde
- Si falla, el problema es la configuración del mock
- Si pasa, el problema es la lógica interna del mock

### Fase 2: Arreglar Tests Específicos

#### Test 1: Missing user_id
**Problema:** Mock devuelve `processed: true` en lugar de `false`

**Hipótesis:**
- El evento llega con una estructura diferente a la esperada
- `event.data?.object?.metadata` puede no existir
- La condición `if (!userId || userId === '')` no se cumple

**Plan:**
1. Agregar spy para capturar evento exacto recibido
2. Comparar estructura con lo que espera el mock
3. Ajustar condición del mock si es necesario

#### Test 2: Database errors
**Problema:** Mock devuelve `processed: true` en lugar de `false`

**Hipótesis:**
- El ID `evt_test_error` no coincide con el evento enviado
- El evento tiene user_id, entonces pasa la validación y devuelve success

**Plan:**
1. Verificar que el test envía ID correcto
2. Confirmar que el mock verifica ID antes que user_id
3. Asegurar que el evento tiene metadata válido

#### Test 3: Unrecognized events
**Problema:** Mock devuelve `processed: true` y mensaje incorrecto

**Hipótesis:**
- El tipo `customer.unknown_event` no coincide
- El evento cae en el caso default de "Event processed successfully"

**Plan:**
1. Verificar que el tipo del evento es exactamente `customer.unknown_event`
2. Confirmar que la condición del mock verifica ese tipo
3. Ajustar mensaje esperado si es necesario

#### Test 4: Webhook cleanup
**Problema:** Devuelve 500 en lugar de 200

**Hipótesis:**
- El mock de `cleanupOldEvents` no está siendo usado
- El handler real está intentando llamar al servicio y falla
- Problema de autenticación o inicialización del servicio

**Plan:**
1. Verificar que billing.js tiene instancia de webhookService
2. Confirmar que cleanupOldEvents está mockeado
3. Verificar que el handler usa el servicio correctamente

### Fase 3: Implementación y Validación

**Para cada test:**
1. Implementar fix según el plan
2. Ejecutar test individual para verificar
3. Ejecutar todos los tests para evitar regresiones
4. Marcar como completado en todo list

**Criterio de Éxito:**
- `npm test -- stripeWebhooksFlow.test.js` muestra `Tests: 16 passed, 16 total`
- No hay warnings ni errores en console
- Todos los tests pasan consistentemente (ejecutar 3 veces)

## Estimación de Tiempo

- Fase 1 Diagnóstico: 15-20 min
- Fase 2 Fixes: 30-40 min
- Fase 3 Validación: 10-15 min
- **Total:** 55-75 min

## Notas

- Seguir principio de "no atajos" - entender problema raíz antes de parchear
- Documentar cada decisión en commits
- Mantener todo list actualizado
- Si un approach no funciona después de 15 min, pivotar a alternativa
