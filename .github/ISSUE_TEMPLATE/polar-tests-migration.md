---
name: Migración Tests Stripe → Polar
about: Migrar tests de billing de Stripe a Polar
title: '[Tests] Migrar tests de billing de Stripe a Polar'
labels: 'enhancement,testing,billing'
assignees: ''
---

## 🎯 Objetivo

Migrar todos los tests de billing que actualmente usan Stripe para que funcionen con Polar como proveedor de pagos, manteniendo la cobertura del 100%.

## 📋 Contexto

Actualmente los tests en `tests/unit/routes/billing-coverage-issue502.test.js` están escritos para Stripe. Necesitamos migrarlos a Polar manteniendo la misma cobertura (100%).

**Estado actual:**

- ✅ 73 tests completados con Stripe
- ✅ 100% cobertura alcanzada
- ❌ Tests aún usan mocks de Stripe
- ❌ Variables de entorno son STRIPE\_\*

**Referencias:**

- Documentación completa: `docs/issues/issue-502-polar-tests-migration.md`
- Documentación Polar: `docs/flows/payment-polar.md`
- Issue Polar principal: `docs/issues/issue-payment-polar.md`
- Código actual: `src/routes/billing.js` tiene `TODO:Polar` marcado

## ✅ Checklist de Migración

### 1. Investigación y Setup

- [ ] Revisar documentación de Polar API
- [ ] Identificar diferencias entre Stripe y Polar APIs
- [ ] Configurar variables de entorno para Polar

### 2. Actualización de Mocks

- [ ] Reemplazar `mockBillingController.stripeWrapper` con equivalente Polar
- [ ] Actualizar mocks de customers, prices, checkout, billingPortal
- [ ] Adaptar estructura de respuestas de Polar vs Stripe
- [ ] Actualizar mocks de webhook events para formato Polar

### 3. Actualización de Tests

- [ ] Actualizar variables de entorno (STRIPE*\* → POLAR*\*)
- [ ] Actualizar tests de checkout session creation
- [ ] Actualizar tests de portal session creation
- [ ] Actualizar tests de webhook processing
- [ ] Actualizar tests de subscription management
- [ ] Actualizar validaciones de lookup keys

### 4. Validación

- [ ] Ejecutar todos los tests y verificar que pasan
- [ ] Verificar cobertura sigue siendo 100%
- [ ] Actualizar documentación

## 📁 Archivos Principales

- `tests/unit/routes/billing-coverage-issue502.test.js` ⭐ **Principal**
- `src/routes/billing.js`
- `src/routes/billingFactory.js`
- `.env.example`

## 📚 Referencias

Ver `docs/issues/issue-502-polar-tests-migration.md` para checklist completo y detalles.
