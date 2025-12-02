# Sources of Truth (SSOT) — v2

**Versión:** 1.0  
**Fecha:** 2025-12-01  
**Estado:** ✅ Activo  
**Propósito:** Definir el sistema de Single Sources of Truth para la arquitectura v2

---

## 🎯 Definición

**Single Source of Truth (SSOT)** es el principio de que cada parámetro configurable del sistema debe tener una única fuente de verdad, evitando duplicación y valores hardcoded en el código.

---

## 📊 Tipos de Parámetros

### 1. Parámetros Estáticos (Build-time)

**Ubicación:** `apps/backend-v2/src/config/admin-controlled.yaml`

**Cuándo usar:**

- Valores que no cambian en runtime
- Configuración de build/deployment
- Valores por defecto que raramente cambian
- Constantes del sistema

**Ejemplos:**

- Límites máximos de caracteres por plataforma
- Valores por defecto de thresholds
- Listas de tonos soportados
- Configuración de integraciones

### 2. Parámetros Dinámicos (Runtime)

**Ubicación:** Tabla Supabase `admin_settings`

**Cuándo usar:**

- Valores que cambian en runtime sin deploy
- Configuración que se modifica desde Admin Panel
- Thresholds ajustables
- Feature flags
- Límites por plan

**Ejemplos:**

- Shield aggressiveness (0.90, 0.95, 0.98, 1.0)
- Límites de análisis por plan
- Cadencias de respuesta
- Thresholds de toxicidad

---

## 🔄 Prioridad de Carga

El sistema SSOT carga valores en este orden (mayor prioridad primero):

1. **`admin_settings` (Supabase)** - Runtime, dinámico
2. **`admin-controlled.yaml`** - Build-time, estático

**Regla:** Si un valor existe en ambos, `admin_settings` siempre gana.

---

## 📋 Lista de Parámetros Configurables

### Shield

| Parámetro                       | Tipo   | Ubicación      | Descripción                        |
| ------------------------------- | ------ | -------------- | ---------------------------------- |
| `shield.default_aggressiveness` | number | admin_settings | Agresividad por defecto (0.90-1.0) |
| `shield.thresholds.critical`    | number | admin_settings | Threshold crítico (≥0.95)          |
| `shield.thresholds.high`        | number | admin_settings | Threshold alto (≥0.85)             |
| `shield.thresholds.medium`      | number | admin_settings | Threshold medio (≥0.60)            |

### Analysis

| Parámetro                       | Tipo   | Ubicación             | Descripción                            |
| ------------------------------- | ------ | --------------------- | -------------------------------------- |
| `analysis.tweet_max_length`     | number | admin-controlled.yaml | Máximo de caracteres para tweets (280) |
| `analysis.max_analysis_per_day` | number | admin_settings        | Límite diario de análisis por plan     |

### Roasting

| Parámetro                  | Tipo   | Ubicación             | Descripción                                             |
| -------------------------- | ------ | --------------------- | ------------------------------------------------------- |
| `roasting.supported_tones` | array  | admin-controlled.yaml | Tonos soportados: ["flanders", "balanceado", "canalla"] |
| `roasting.max_retries`     | number | admin-controlled.yaml | Intentos máximos de generación (3)                      |

### Plans

| Parámetro                     | Tipo   | Ubicación      | Descripción                 |
| ----------------------------- | ------ | -------------- | --------------------------- |
| `plans.starter.monthly_limit` | number | admin_settings | Límite mensual plan Starter |
| `plans.pro.monthly_limit`     | number | admin_settings | Límite mensual plan Pro     |
| `plans.plus.monthly_limit`    | number | admin_settings | Límite mensual plan Plus    |

---

## 💻 Ejemplos de Lectura desde Backend

### Ejemplo 1: Cargar Settings Completos

```typescript
import { loadSettings } from '@/lib/loadSettings';

// Cargar todos los settings
const settings = await loadSettings();

// Acceder a un valor
const aggressiveness = settings.shield?.default_aggressiveness || 0.95;
```

### Ejemplo 2: Cargar Namespace Específico

```typescript
import { loadSettingsNamespace } from '@/lib/loadSettings';

// Cargar solo settings de Shield
const shieldSettings = await loadSettingsNamespace('shield');

// Acceder directamente
const criticalThreshold = shieldSettings.thresholds?.critical || 0.95;
```

### Ejemplo 3: Cargar Setting Individual

```typescript
import { getSetting } from '@/lib/loadSettings';

// Cargar un setting específico
const maxLength = await getSetting('analysis.tweet_max_length');
// Retorna: 280 (desde YAML o admin_settings)
```

### Ejemplo 4: Con Fallback

```typescript
import { getSetting } from '@/lib/loadSettings';

// Cargar con valor por defecto
const aggressiveness = await getSetting('shield.default_aggressiveness', 0.95);
// Si no existe en SSOT, retorna 0.95
```

---

## 🚫 Reglas de Oro

### ❌ NUNCA

1. **Hardcodear valores** que existen en SSOT

   ```typescript
   // ❌ INCORRECTO
   const threshold = 0.95;

   // ✅ CORRECTO
   const threshold = await getSetting('shield.default_aggressiveness', 0.95);
   ```

2. **Duplicar valores** en múltiples lugares

   ```typescript
   // ❌ INCORRECTO
   const limits = {
     starter: 100, // Hardcoded
     pro: 500 // Hardcoded
   };

   // ✅ CORRECTO
   const limits = await loadSettings('plans');
   ```

3. **Usar valores legacy** de v1

   ```typescript
   // ❌ INCORRECTO
   const settings = await shieldSettingsService.getOrganizationSettings(orgId);

   // ✅ CORRECTO
   const settings = await loadSettings('shield');
   ```

### ✅ SIEMPRE

1. **Cargar desde SSOT** antes de usar cualquier valor configurable
2. **Documentar nuevos parámetros** en este archivo cuando se añadan
3. **Usar fallbacks** solo para valores que realmente no existen en SSOT
4. **Validar tipos** al cargar desde SSOT

---

## 🔧 Añadir Nuevos Parámetros

Cuando necesites añadir un nuevo parámetro configurable:

1. **Decidir tipo:**
   - ¿Cambia en runtime? → `admin_settings`
   - ¿Es estático? → `admin-controlled.yaml`

2. **Añadir a la fuente correspondiente:**
   - Si es `admin_settings`: Crear entrada en BD
   - Si es YAML: Añadir a `admin-controlled.yaml`

3. **Documentar aquí:**
   - Añadir a la tabla de "Lista de Parámetros Configurables"
   - Incluir: nombre, tipo, ubicación, descripción

4. **Actualizar tests:**
   - Añadir test que verifica carga desde SSOT
   - Verificar que no está hardcoded en código

---

## 📚 Referencias

- **Implementación:** `apps/backend-v2/src/lib/loadSettings.ts`
- **Configuración estática:** `apps/backend-v2/src/config/admin-controlled.yaml`
- **Tabla dinámica:** `admin_settings` (Supabase)
- **Reglas Cursor:** `.cursorrules` (sección SSOT)

---

**Última actualización:** 2025-12-01  
**Mantenido por:** Back-end Dev
