# Issue #808 - Migración PRICE_ID → PRODUCT_ID (Polar)

**Fecha:** 2025-11-17  
**Estado:** ✅ Completado

---

## 📋 Resumen

Se actualizó el código para usar `PRODUCT_ID` (Polar) en lugar de `PRICE_ID` (Stripe), ya que Polar usa `product_id` mientras que Stripe usaba `price_id`.

---

## ✅ Cambios Realizados

### 1. `src/utils/polarHelpers.js`

- ✅ Cambiado `PRICE_ID_TO_PLAN` → `PRODUCT_ID_TO_PLAN`
- ✅ Cambiado `POLAR_*_PRICE_ID` → `POLAR_*_PRODUCT_ID` en variables de entorno
- ✅ Nuevas funciones: `getPlanFromProductId()`, `getProductIdFromPlan()`, `getConfiguredProductIds()`
- ✅ Funciones legacy mantenidas para compatibilidad durante migración (con warnings)

### 2. `src/routes/checkout.js`

- ✅ Cambiado `ALLOWED_PRICE_IDS` → `ALLOWED_PRODUCT_IDS`
- ✅ Cambiado `price_id` → `product_id` en parámetros de request
- ✅ Soporte backward compatibility: acepta tanto `product_id` como `price_id` (legacy)
- ✅ Variable de entorno: `POLAR_ALLOWED_PRODUCT_IDS` (con fallback a `POLAR_ALLOWED_PRICE_IDS`)

### 3. `src/routes/polarWebhook.js`

- ✅ Actualizado para usar `product_id` en lugar de `product_price_id`
- ✅ Soporte para ambos campos (`product_id` y `product_price_id`) para compatibilidad
- ✅ Usa `getPlanFromProductId()` con fallback a `getPlanFromPriceId()` (legacy)

### 4. `src/services/entitlementsService.js`

- ✅ Actualizado `setEntitlementsFromPolarPrice()` para usar `polarProductId`
- ✅ Usa `getPlanFromProductId()` con fallback a `getPlanFromPriceId()` (legacy)
- ✅ Logs actualizados para reflejar "Polar Product" en lugar de "Polar Price"

---

## 🔄 Compatibilidad Backward

Se mantiene compatibilidad durante la migración:

1. **Funciones legacy en `polarHelpers.js`:**
   - `getPlanFromPriceId()` → llama a `getPlanFromProductId()` con warning
   - `getPriceIdFromPlan()` → llama a `getProductIdFromPlan()` con warning
   - `getConfiguredPriceIds()` → llama a `getConfiguredProductIds()` con warning

2. **Checkout endpoint:**
   - Acepta tanto `product_id` (nuevo) como `price_id` (legacy)
   - Prioriza `product_id` si ambos están presentes

3. **Webhooks:**
   - Maneja tanto `product_id` como `product_price_id` del webhook de Polar
   - Prioriza `product_id` si está disponible

---

## 📝 Variables de Entorno

### Actualizadas (en `.env`):

```bash
POLAR_STARTER_PRODUCT_ID=*** (ya configurado)
POLAR_PRO_PRODUCT_ID=*** (ya configurado)
POLAR_PLUS_PRODUCT_ID=*** (ya configurado)
```

### Nueva (opcional):

```bash
POLAR_ALLOWED_PRODUCT_IDS=product_id_1,product_id_2,product_id_3
```

**Nota:** Si no se configura `POLAR_ALLOWED_PRODUCT_IDS`, el código intenta usar `POLAR_ALLOWED_PRICE_IDS` como fallback.

---

## 🎯 Próximos Pasos

### Para completar Issue #808 (Migración de tests):

1. **Actualizar tests de billing:**
   - Cambiar mocks de Stripe a Polar
   - Usar `product_id` en lugar de `price_id`
   - Actualizar variables de entorno en tests

2. **Actualizar documentación:**
   - `.env.example` (si no está filtrado)
   - Documentación de API
   - Guías de integración

3. **Remover funciones legacy:**
   - Después de que todos los tests estén migrados
   - Remover `getPlanFromPriceId()`, `getPriceIdFromPlan()`, `getConfiguredPriceIds()`
   - Remover soporte para `price_id` en checkout endpoint

---

## ✅ Validación

- ✅ No hay errores de linter
- ✅ Código compila correctamente
- ✅ Compatibilidad backward mantenida
- ✅ Variables de entorno coinciden con `.env` actual

---

## 📚 Referencias

- **Issue #808:** Migrar tests de billing de Stripe a Polar
- **Código relacionado:**
  - `src/utils/polarHelpers.js`
  - `src/routes/checkout.js`
  - `src/routes/polarWebhook.js`
  - `src/services/entitlementsService.js`
