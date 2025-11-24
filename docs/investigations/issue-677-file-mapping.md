# Issue 677 - Mapeo de Archivos Reales vs Definidos

**Fecha:** 2025-10-29
**Propósito:** Corregir violations de coverage integrity mapeando archivos correctos

---

## Resumen

De los 7 nodos con violations, identificamos:

- ✅ **3 nodos** tienen archivos correctos (guardian, multi-tenant ya están bien)
- ⚠️ **6 archivos** están mal definidos o no existen
- ✅ **Encontrados** archivos alternativos que sí existen

## Mapeo por Nodo

### 1. analytics

**Definido en system-map.yaml:**

```yaml
files:
  - src/services/analyticsService.js # ❌ NO EXISTE
```

**Archivos Reales:**

```yaml
files:
  - src/routes/analytics.js # ✅ EXISTE
```

**Acción:** Reemplazar con archivo real

---

### 2. billing

**Definido en system-map.yaml:**

```yaml
files:
  - src/services/billingService.js # ❌ NO EXISTE
  - src/services/stripeService.js # ❌ NO EXISTE
```

**Archivos Reales:**

```yaml
files:
  - src/services/billingInterface.js # ✅ EXISTE
  - src/services/stripeWebhookService.js # ✅ EXISTE
  - src/services/stripeWrapper.js # ✅ EXISTE
  - src/routes/billing.js # ✅ EXISTE
```

**Acción:** Reemplazar con archivos reales

---

### 3. guardian ✅

**Definido en system-map.yaml:**

```yaml
files:
  - scripts/guardian-gdd.js # ✅ EXISTE
  - config/product-guard.yaml # ✅ EXISTE
  - config/guardian-ignore.yaml # ✅ EXISTE
```

**Estado:** Archivos correctos

**Nota:** La violation ocurre porque:

- Los archivos de `scripts/` y `config/` NO se ejecutan en tests
- Por lo tanto NO aparecen en `coverage-summary.json`
- Solución: Estos archivos no necesitan coverage de tests (son configuración/scripts)

**Acción:** Actualizar coverage a `0%` y añadir nota explicativa

---

### 4. multi-tenant ✅

**Definido en system-map.yaml:**

```yaml
files:
  - database/schema.sql # ✅ EXISTE
  - database/migrations/001_add_persona_fields.sql # ✅ EXISTE
  - supabase/migrations/20251017000002_simple_rls.sql # ✅ EXISTE
```

**Estado:** Archivos correctos

**Nota:** La violation ocurre porque:

- Los archivos SQL NO se ejecutan en tests JS/Jest
- Por lo tanto NO aparecen en `coverage-summary.json`
- Solución: Schema SQL no necesita JS coverage (es DDL)

**Acción:** Mantener archivos, actualizar coverage a valor realista basado en tests de RLS

---

### 5. platform-constraints

**Definido en system-map.yaml:**

```yaml
files:
  - src/services/platformConstraints.js # ❌ NO EXISTE
```

**Archivos Reales:**

```yaml
files:
  - src/config/platforms.js # ✅ EXISTE
  - src/config/integrations.js # ✅ EXISTE (configs de plataforma)
```

**Acción:** Reemplazar con archivos reales

---

### 6. tone

**Definido en system-map.yaml:**

```yaml
files:
  - src/services/toneService.js # ❌ NO EXISTE
```

**Archivos Reales:**

```yaml
files:
  - src/config/tones.js # ✅ EXISTE (definiciones de tones)
  - src/config/constants.js # ✅ EXISTE (TONE_MAP, HUMOR_MAP)
```

**Acción:** Reemplazar con archivos reales

---

### 7. trainer

**Definido en system-map.yaml:**

```yaml
status: development
files:
  - src/services/trainerService.js # ❌ NO EXISTE
```

**Estado:** Feature en desarrollo, sin implementación

**Acción:** Marcar como roadmap y remover archivos hasta implementación real

---

## Resumen de Cambios

| Nodo                 | Archivos Definidos | Archivos Reales | Acción                        |
| -------------------- | ------------------ | --------------- | ----------------------------- |
| analytics            | 1 (❌)             | 1 (✅)          | Reemplazar                    |
| billing              | 2 (❌)             | 4 (✅)          | Reemplazar                    |
| guardian             | 3 (✅)             | 3 (✅)          | Actualizar coverage a 0%      |
| multi-tenant         | 3 (✅)             | 3 (✅)          | Mantener, actualizar coverage |
| platform-constraints | 1 (❌)             | 2 (✅)          | Reemplazar                    |
| tone                 | 1 (❌)             | 2 (✅)          | Reemplazar                    |
| trainer              | 1 (❌)             | 0               | Marcar roadmap, remover files |

---

## Por Qué Ocurren las Violations

### Caso 1: Archivos Definidos No Existen

- `system-map.yaml` referencia archivos que nunca se crearon
- Validator no puede calcular coverage → "missing_coverage_data"
- **Solución:** Actualizar con archivos que SÍ existen

### Caso 2: Archivos Existen pero NO tienen Coverage JS

- Archivos de config (`config/*.yaml`, `config/*.js`)
- Archivos SQL (`database/*.sql`, `supabase/migrations/*.sql`)
- Scripts (`scripts/*.js`) que no se ejecutan en tests

**Razón:** `coverage-summary.json` solo incluye archivos ejecutados por Jest

**Solución:**

- Config/SQL: Actualizar coverage a `0%` o valor realista
- Añadir nota: "No aplicable - archivo de configuración/DDL"

### Caso 3: Feature en Desarrollo

- Nodo planificado pero sin implementación
- **Solución:** Marcar `status: roadmap`, remover `files:` hasta implementar

---

## Verificación Post-Corrección

Después de aplicar los cambios:

```bash
# Validar que violations desaparezcan
node scripts/validate-gdd-runtime.js --full

# Verificar health score
node scripts/score-gdd-health.js --ci

# Esperar: 0 coverage integrity violations
```

---

**Próximo paso:** Aplicar cambios a `docs/system-map.yaml`
