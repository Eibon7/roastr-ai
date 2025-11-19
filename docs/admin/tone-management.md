# Tone Management Guide - Dynamic Roast Tone Configuration

**Issue:** #876  
**Created:** 2025-11-18  
**Version:** 1.0.0

---

## 🎯 Overview

El sistema de configuración dinámica de tonos permite gestionar los tonos de roast desde el panel admin sin necesidad de modificar código ni hacer deploy. Los tonos se almacenan en base de datos con soporte multiidioma (ES/EN) y se cargan dinámicamente durante la generación de roasts.

### Key Features

- ✅ Configuración dinámica (editar sin código)
- ✅ Soporte multiidioma (ES/EN, extensible)
- ✅ Cache inteligente (5 minutos TTL)
- ✅ Validación de constraints (al menos 1 activo)
- ✅ Admin-only access (seguro)
- ✅ Ordenamiento customizable (drag & drop)
- ✅ Backward compatible (nombres mantenidos)

---

## 📊 Database Schema

### Tabla: `roast_tones`

```sql
CREATE TABLE roast_tones (
  id UUID PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,           -- Identificador (ej: 'flanders')
  display_name JSONB NOT NULL,                -- {"es": "Flanders", "en": "Light"}
  description JSONB NOT NULL,                 -- Descripción multiidioma
  intensity INTEGER NOT NULL CHECK (1-5),     -- Intensidad 1 (ligero) - 5 (salvaje)
  personality TEXT NOT NULL,                  -- Personalidad del tono
  resources TEXT[] NOT NULL,                  -- Recursos permitidos
  restrictions TEXT[] NOT NULL,               -- Restricciones CRÍTICAS
  examples JSONB NOT NULL,                    -- Ejemplos multiidioma
  active BOOLEAN DEFAULT true,                -- Tono disponible
  is_default BOOLEAN DEFAULT false,           -- Tono por defecto (1 solo)
  sort_order INTEGER DEFAULT 0,               -- Orden de visualización
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
```

### Constraints y Validaciones

| Constraint | Descripción |
|------------|-------------|
| `valid_name` | Solo caracteres alfanuméricos, guiones y underscores |
| `valid_display_name` | JSONB object válido |
| `valid_description` | JSONB object válido |
| `valid_examples` | JSONB array válido |
| `intensity CHECK` | Valor entre 1 y 5 |
| `ensure_at_least_one_active_tone()` | Al menos 1 tono activo (trigger) |
| `idx_roast_tones_default` | Solo 1 tono default (unique index WHERE is_default = true) |

---

## 🔧 Backend API

### Base URL

```
/api/admin/tones
```

### Authentication

Todos los endpoints requieren:
- ✅ JWT válido (`Authorization: Bearer <token>`)
- ✅ Usuario con `is_admin = true`

### Endpoints

#### 1. Listar todos los tonos

```http
GET /api/admin/tones
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-here",
      "name": "flanders",
      "display_name": { "es": "Flanders", "en": "Light" },
      "description": { "es": "Tono amable...", "en": "Gentle wit..." },
      "intensity": 2,
      "personality": "Educado, irónico...",
      "resources": ["Ironía marcada", "Double entendre"],
      "restrictions": ["NO insultos directos", "NO vulgaridad"],
      "examples": [
        {
          "es": { "input": "...", "output": "..." },
          "en": { "input": "...", "output": "..." }
        }
      ],
      "active": true,
      "is_default": true,
      "sort_order": 1,
      "created_at": "2025-11-18T...",
      "updated_at": "2025-11-18T..."
    }
  ]
}
```

#### 2. Obtener tono específico

```http
GET /api/admin/tones/:id
```

**Respuesta:**
```json
{
  "success": true,
  "data": { ...tone_object }
}
```

**Errores:**
- `404` - Tone not found

#### 3. Crear nuevo tono

```http
POST /api/admin/tones
Content-Type: application/json

{
  "name": "nuevo_tono",
  "display_name": {
    "es": "Nuevo Tono",
    "en": "New Tone"
  },
  "description": {
    "es": "Descripción en español",
    "en": "Description in English"
  },
  "intensity": 3,
  "personality": "Directo, inteligente, con humor...",
  "resources": [
    "Sarcasmo directo",
    "Ironía evidente"
  ],
  "restrictions": [
    "NO insultos personales",
    "NO discriminación"
  ],
  "examples": [
    {
      "es": {
        "input": "Ejemplo de comentario",
        "output": "Ejemplo de roast"
      },
      "en": {
        "input": "Example comment",
        "output": "Example roast"
      }
    }
  ],
  "active": true,
  "is_default": false,
  "sort_order": 4
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": { ...created_tone }
}
```

**Errores:**
- `400` - Validation failed
- `409` - Tone name already exists

#### 4. Actualizar tono

```http
PUT /api/admin/tones/:id
Content-Type: application/json

{
  "intensity": 4,
  "active": false
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": { ...updated_tone }
}
```

**Errores:**
- `400` - Validation failed
- `404` - Tone not found
- `409` - Tone name already exists

#### 5. Eliminar tono

```http
DELETE /api/admin/tones/:id
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Tone deleted successfully"
}
```

**Errores:**
- `400` - Cannot delete last active tone
- `404` - Tone not found

#### 6. Activar tono

```http
POST /api/admin/tones/:id/activate
```

**Respuesta:**
```json
{
  "success": true,
  "data": { ...activated_tone }
}
```

#### 7. Desactivar tono

```http
POST /api/admin/tones/:id/deactivate
```

**Respuesta:**
```json
{
  "success": true,
  "data": { ...deactivated_tone }
}
```

**Errores:**
- `400` - Cannot deactivate last active tone

#### 8. Reordenar tonos

```http
PUT /api/admin/tones/reorder
Content-Type: application/json

{
  "orderArray": [
    { "id": "uuid-1", "sort_order": 1 },
    { "id": "uuid-2", "sort_order": 2 },
    { "id": "uuid-3", "sort_order": 3 }
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": [ ...reordered_tones ]
}
```

---

## 💾 Cache System

### Cache Configuration

| Parameter | Value |
|-----------|-------|
| **TTL** | 5 minutos |
| **Storage** | En memoria (singleton service) |
| **Invalidation** | Automática en POST/PUT/DELETE |
| **Localization** | Por idioma (ES/EN) |

### Cache Behavior

```javascript
// First call - fetches from DB
const tones = await toneService.getActiveTones('es');
// Cache populated: { cache: [...], cacheExpiry: Date.now() + 300000 }

// Subsequent calls within 5min - returns from cache
const tones2 = await toneService.getActiveTones('es');
// No DB query, instant response

// After 5min - cache expired
const tones3 = await toneService.getActiveTones('es');
// Fetches from DB again, repopulates cache

// After any POST/PUT/DELETE - cache invalidated immediately
await toneService.updateTone(id, { intensity: 4 });
// cache = null, cacheExpiry = null
```

### Multi-Instance Considerations

**Current implementation:** En memoria (singleton)  
**Limitation:** No compartido entre instancias  
**Workaround:** 5min TTL es aceptable (config cambia poco)  
**Future:** Considerar Redis si se necesita cache compartido

---

## 🎨 Frontend UI (Pendiente)

### Admin Panel Page

**URL:** `/admin/roast-tones`

**Componentes:**
- `TonesList.jsx` - Lista de tonos con filtros y acciones
- `ToneEditor.jsx` - Editor multiidioma con validaciones

**Features:**
- ✅ Tabla de tonos (activos/inactivos)
- ✅ Filtros: activo/inactivo, idioma
- ✅ Búsqueda por nombre
- ✅ Drag & drop reordering
- ✅ Botones: Activar/Desactivar, Editar, Eliminar
- ✅ Modal/página de edición con tabs ES/EN

---

## 🔄 Integration with Roast Generation

### Flow

```
User requests roast
    ↓
RoastPromptBuilder.buildCompletePrompt()
    ↓
buildBlockA(language) [ASYNC]
    ↓
ToneConfigService.getActiveTones(language)
    ↓
[CACHE HIT] → Return cached tones
    OR
[CACHE MISS] → Fetch from DB → Cache → Return
    ↓
Generate dynamic tones text in Block A
    ↓
Block A + Block B + Block C → Complete Prompt
    ↓
OpenAI API generates roast
```

### Code Example

```javascript
// src/lib/prompts/roastPrompt.js

async buildBlockA(language = 'es') {
  // Load active tones from DB (with cache)
  const tones = await this.toneService.getActiveTones(language);

  // Generate dynamic tones text
  const tonesText = tones.map((tone, i) => `
${i + 1}. ${tone.display_name.toUpperCase()} (Intensidad: ${tone.intensity}/5)
   Descripción: ${tone.description}
   Personalidad: ${tone.personality}
   Recursos permitidos:
   ${tone.resources.map(r => `- ${r}`).join('\n   ')}
   
   Restricciones CRÍTICAS:
   ${tone.restrictions.map(r => `- ${r}`).join('\n   ')}
   
   Ejemplo:
   Input: "${tone.examples[0].input}"
   Output: "${tone.examples[0].output}"
  `).join('\n');

  return `...[resto del prompt]

🎭 SISTEMA DE TONOS DE ROASTR:

Tienes ${tones.length} tonos disponibles:

${tonesText}

...[resto del prompt]`;
}
```

---

## 📝 Management Best Practices

### Creating New Tones

**DO:**
- ✅ Proporcionar nombres descriptivos (ES/EN)
- ✅ Definir intensidad apropiada (1-5)
- ✅ Incluir al menos 2-3 recursos
- ✅ Incluir al menos 2-3 restricciones
- ✅ Añadir 2-3 ejemplos por idioma
- ✅ Probar el tono antes de activar

**DON'T:**
- ❌ Crear tonos sin restricciones
- ❌ Usar intensidades extremas sin justificación
- ❌ Omitir ejemplos (críticos para IA)
- ❌ Crear tonos duplicados/similares

### Editing Existing Tones

**Safe Changes:**
- ✅ Ajustar intensidad (+/- 1)
- ✅ Añadir recursos/restricciones
- ✅ Mejorar descripciones
- ✅ Añadir ejemplos

**Risky Changes:**
- ⚠️ Cambiar nombre (puede romper referencias)
- ⚠️ Eliminar restricciones (puede generar contenido inapropiado)
- ⚠️ Cambiar intensidad dramáticamente (+/- 2+)

### Testing Tones

1. **Crear tono inactivo:** Probar sin afectar producción
2. **Generar test roasts:** Usar comentarios de prueba
3. **Validar output:** Verificar que cumple intensidad y restricciones
4. **Activar:** Solo después de validación exitosa

---

## 🔍 Troubleshooting

### Problem: Tono no aparece en lista

**Causa:** Tono inactivo (`active = false`)  
**Solución:** Activar tono desde admin panel o API

### Problem: No puedo desactivar tono

**Causa:** Es el último tono activo  
**Solución:** Activar otro tono primero, luego desactivar este

### Problem: Cache no se actualiza

**Causa:** TTL de 5min no expirado  
**Solución:** Esperar 5min o invalidar cache manualmente

### Problem: Error "Tone name already exists"

**Causa:** Nombre duplicado  
**Solución:** Usar nombre único (ej: `tono_custom_v2`)

---

## 📊 Monitoring

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Active tones count | Tonos activos en sistema | < 1 (critical) |
| Cache hit rate | % requests servidas desde cache | < 80% (warning) |
| Tone load latency | Tiempo de carga desde DB | > 500ms (warning) |
| Tone update frequency | Updates por día | > 50 (unusual) |

### Logs

**Location:** `src/services/toneConfigService.js`

**Events Logged:**
- Tone CRUD operations (info)
- Cache invalidations (info)
- Database errors (error)
- Validation failures (warn)

---

## 🔐 Security

### Access Control

- ✅ Admin authentication required (JWT + `is_admin = true`)
- ✅ CSRF protection (if enabled in admin routes)
- ✅ Rate limiting (admin endpoints)
- ✅ Input validation (sanitization)

### Data Validation

- ✅ Name format (alphanumeric + hyphens)
- ✅ Intensity range (1-5)
- ✅ JSONB structure validation
- ✅ At least 1 active tone (database trigger)
- ✅ Only 1 default tone (unique index)

---

## 🚀 Future Enhancements

### Planned (Not in Scope)

- [ ] Analytics: Qué tono se usa más
- [ ] Versioning: Historial de cambios por tono
- [ ] Preview: Probar tono antes de activar
- [ ] A/B testing: Experimentar con variaciones
- [ ] User preferences: Usuarios eligen tono favorito
- [ ] Más idiomas: PT, FR, DE, IT, etc.
- [ ] Per-organization tones: Tonos customizados por org
- [ ] AI-suggested improvements: Sugerencias de mejora

---

## 📚 Related Documentation

- **Issue:** #876 (Dynamic Roast Tone Configuration System)
- **Related Issue:** #872 (Documentación de tonos hardcodeados)
- **API Spec:** `src/routes/admin/tones.js`
- **Service Spec:** `src/services/toneConfigService.js`
- **Database Schema:** `database/migrations/030_roast_tones_table.sql`
- **Integration:** `src/lib/prompts/roastPrompt.js`

---

**Maintained by:** Backend Developer  
**Review Frequency:** Monthly or on feature changes  
**Last Updated:** 2025-11-18  
**Version:** 1.0.0

