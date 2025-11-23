# Plan de Implementación - Issue #926

**Título:** [Coverage] Fase 1.3: Tests para Config Files (0% → 90%+)  
**Fecha:** 2025-01-27  
**Estado:** En progreso

---

## Objetivo

Añadir tests para archivos de configuración que actualmente tienen 0% de cobertura:
- `src/config/index.js` (0% - 2 statements)
- `src/config/tierMessages.js` (0% - 23 statements)

**Impacto esperado:** +0.5% cobertura global

---

## Estado Actual

### Archivos a Cubrir

1. **`src/config/index.js`**
   - 2 statements
   - Exporta objeto `config` con:
     - `openai`: apiKey, model
     - `perspective`: apiKey
     - `toxicity`: threshold
     - `billing.stripe`: secretKey, webhookSecret, priceLookupKeys, URLs

2. **`src/config/tierMessages.js`**
   - 23 statements
   - Exporta:
     - `tierMessages`: objeto con mensajes por tier
     - `getTierLimitMessage()`: función helper
     - `getFeatureMessage()`: función helper
     - `getUpgradeCta()`: función helper
     - `getPlanChangeMessage()`: función helper
     - `formatUsageWarning()`: función helper

### Cobertura Actual
- `index.js`: 0%
- `tierMessages.js`: 0%

---

## Pasos de Implementación

### Paso 1: Tests para `src/config/index.js`

**Archivo:** `tests/unit/config/index.test.js`

**Tests a implementar:**
1. ✅ Módulo se carga sin errores
2. ✅ Exporta objeto `config` con estructura correcta
3. ✅ `config.openai` tiene `apiKey` y `model`
4. ✅ `config.perspective` tiene `apiKey`
5. ✅ `config.toxicity` tiene `threshold` (0.7)
6. ✅ `config.billing.stripe` tiene todas las propiedades requeridas
7. ✅ `config.billing.stripe.priceLookupKeys` tiene todos los tiers
8. ✅ Valores por defecto cuando env vars no están definidas
9. ✅ Valores desde env vars cuando están definidas

**Cobertura objetivo:** ≥90%

### Paso 2: Tests para `src/config/tierMessages.js`

**Archivo:** `tests/unit/config/tierMessages.test.js`

**Tests a implementar:**

#### 2.1 Estructura de `tierMessages`
1. ✅ Exporta objeto `tierMessages`
2. ✅ Tiene secciones: `analysis`, `roast`, `platform`, `features`, `planChange`, `upgradeCtas`
3. ✅ Cada sección tiene estructura correcta

#### 2.2 `getTierLimitMessage()`
1. ✅ Retorna mensaje correcto para tier válido
2. ✅ Retorna mensaje por defecto para tier inválido
3. ✅ Maneja diferentes `messageType` (limit_exceeded, near_limit, upgrade_cta)
4. ✅ Retorna `limit_exceeded` por defecto si `messageType` no existe

#### 2.3 `getFeatureMessage()`
1. ✅ Retorna mensaje correcto para feature válido
2. ✅ Retorna mensaje por defecto para feature inválido
3. ✅ Maneja diferentes `messageType`

#### 2.4 `getUpgradeCta()`
1. ✅ Retorna CTA correcto para upgrade específico (currentTier → targetTier)
2. ✅ Retorna CTA por defecto para tier sin upgrade específico
3. ✅ Retorna CTA enterprise para tier más alto
4. ✅ Retorna CTA por defecto para tier inválido

#### 2.5 `getPlanChangeMessage()`
1. ✅ Retorna mensaje correcto para upgrade success/processing/failed
2. ✅ Retorna mensaje correcto para downgrade scheduled/usage_exceeds/cancelled
3. ✅ Retorna mensaje por defecto para status inválido

#### 2.6 `formatUsageWarning()`
1. ✅ Retorna warning `error` cuando percentage >= 100
2. ✅ Retorna warning `warning` cuando percentage >= 80
3. ✅ Retorna warning `info` cuando percentage >= 60
4. ✅ Retorna `null` cuando percentage < 60
5. ✅ Formato correcto de mensajes

**Cobertura objetivo:** ≥90%

### Paso 3: Validación

1. ✅ Ejecutar `npm test` (0 failures)
2. ✅ Ejecutar `npm run test:coverage` (verificar ≥90% para ambos archivos)
3. ✅ Verificar que Coverage Source es 'auto' en nodos GDD
4. ✅ Actualizar nodos GDD si aplica

---

## Agentes Relevantes

- **TestEngineer**: Implementación de tests
- **Guardian**: Validación de estructura y exports (opcional, tests simples)

---

## Archivos Afectados

**Nuevos:**
- `tests/unit/config/index.test.js`
- `tests/unit/config/tierMessages.test.js`

**Modificados:**
- Ninguno (solo tests nuevos)

---

## Validación Requerida

### Pre-Flight Checklist
- [ ] Tests pasando (0 failures)
- [ ] Cobertura ≥90% para ambos archivos
- [ ] Tests validan estructura y valores
- [ ] Tests validan exports correctos
- [ ] Coverage Source: auto (NO manual)

### Comandos de Validación

```bash
# Tests
npm test -- tests/unit/config/index.test.js tests/unit/config/tierMessages.test.js

# Cobertura
npm run test:coverage -- --collectCoverageFrom='src/config/index.js' --collectCoverageFrom='src/config/tierMessages.js'

# GDD (si aplica)
node scripts/validate-gdd-runtime.js --full
```

---

## Referencias

- `docs/coverage-improvement-priorities.md` - Estrategia completa
- `docs/TESTING-GUIDE.md` - Guía de testing
- `tests/unit/config/tones.test.js` - Ejemplo de tests de config
- `tests/unit/config/environment-validation.test.js` - Ejemplo de tests de config

---

## Notas

- Archivos de configuración son triviales de testear
- Quick win para subir cobertura rápidamente
- No requiere mocks complejos
- Tests deben validar estructura y valores, no lógica compleja

