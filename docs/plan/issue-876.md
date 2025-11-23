# Plan de Implementación - Issue #876

**Título:** feat: Dynamic Roast Tone Configuration System (Admin Panel)

**Fecha Creación:** 2025-11-18

**Complejidad:** Medium (12-16 horas estimadas)

**Priority:** P2 (Enhancement - no bloqueante)

---

## 🎯 Objetivo

Convertir los 3 tonos de roast (Flanders, Balanceado, Canalla) de hardcodeado en código a configuración dinámica en base de datos, gestionable desde panel admin.

**Transformación:**

- ❌ **ANTES:** Tonos hardcodeados en `roastPrompt.js` (#872)
- ✅ **DESPUÉS:** Tabla `roast_tones` en DB + API Admin + Panel UI

**Beneficio Principal:** Editar/añadir/reordenar tonos sin tocar código ni hacer deploy

---

## 📋 Contexto GDD

**Nodos cargados:**

- `roast.md` - Sistema de generación de roasts (actualmente hardcodeado)
- `persona.md` - Configuración de personalidad (campos en `users`)
- `multi-tenant.md` - RLS + aislamiento por organización

**Impacto:**

- Nodo `roast` necesita actualización (carga de tonos desde DB)
- Nodo `multi-tenant` relevante si tonos son por organización (SCOPE: global, no por org)
- `persona` no impactado (tonos son sistema-wide, no personalizados por usuario)

---

## 🏗️ Estado Actual

**Tonos Actuales (Hardcodeados):**

| Tono         | Nombre ES  | Nombre EN | Intensidad | Ubicación        |
| ------------ | ---------- | --------- | ---------- | ---------------- |
| `flanders`   | Flanders   | Light     | 2/5        | `roastPrompt.js` |
| `balanceado` | Balanceado | Balanced  | 3/5        | `roastPrompt.js` |
| `canalla`    | Canalla    | Savage    | 4/5        | `roastPrompt.js` |

**Limitaciones Actuales:**

- ❌ Cambiar tono requiere modificar código
- ❌ Añadir nuevo tono requiere deploy
- ❌ No hay A/B testing de tonos
- ❌ No se puede desactivar tono temporalmente
- ❌ No hay orden customizable

---

## 📐 Arquitectura Propuesta

### 1. Base de Datos

**Tabla:** `roast_tones`

**Campos:**

```sql
id UUID PRIMARY KEY
name VARCHAR(50) UNIQUE NOT NULL           -- 'flanders', 'balanceado', 'canalla'
display_name JSONB NOT NULL                -- {"es": "Flanders", "en": "Light"}
description JSONB NOT NULL                 -- {"es": "Tono amable...", "en": "Gentle wit..."}
intensity INTEGER NOT NULL (1-5)
personality TEXT NOT NULL
resources TEXT[] NOT NULL                  -- ["Ironía marcada", "Double entendre"]
restrictions TEXT[] NOT NULL               -- ["NO insultos directos", "NO vulgaridad"]
examples JSONB NOT NULL                    -- [{"es": {...}, "en": {...}}]
active BOOLEAN DEFAULT true
is_default BOOLEAN DEFAULT false           -- Solo uno puede ser default
sort_order INTEGER DEFAULT 0
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
created_by UUID REFERENCES users(id)
```

**Constraints:**

- ✅ Al menos 1 tono activo (trigger)
- ✅ Solo 1 default (unique index WHERE is_default = true)
- ✅ JSONB validation (jsonb_typeof check)

### 2. Backend

**Servicio:** `src/services/toneConfigService.js`

**Funcionalidades:**

- `getActiveTones(language)` - Devuelve tonos activos localizados + cache 5min
- `getAllTones()` - Admin: todos los tonos (activos + inactivos)
- `getToneById(id)` - Un tono específico
- `createTone(data)` - Crear nuevo tono
- `updateTone(id, data)` - Editar tono existente
- `deleteTone(id)` - Eliminar tono (valida >= 1 activo)
- `activateTone(id)` - Activar tono
- `deactivateTone(id)` - Desactivar tono (valida >= 1 activo)
- `reorderTones(orderArray)` - Reordenar tonos (sort_order)
- `invalidateCache()` - Limpiar cache (POST/PUT/DELETE)

**Cache:**

- En memoria (5 min TTL)
- Invalida al guardar/editar/eliminar
- Considera Redis si multi-instancia

**API Endpoints:** `src/routes/admin/tones.js`

```
GET    /api/admin/tones          - Listar todos
GET    /api/admin/tones/:id      - Ver uno
POST   /api/admin/tones          - Crear
PUT    /api/admin/tones/:id      - Editar
DELETE /api/admin/tones/:id      - Eliminar
POST   /api/admin/tones/:id/activate    - Activar
POST   /api/admin/tones/:id/deactivate  - Desactivar
PUT    /api/admin/tones/reorder  - Reordenar (sort_order)
```

**Autenticación:**

- Middleware `requireAdmin` (solo admin)
- Validación plan en middleware si aplica

### 3. Frontend

**Página:** `/admin/roast-tones`

**Componentes:**

- `TonesList.jsx` - Tabla con tonos (activos/inactivos)
  - Filtros: activo/inactivo, idioma
  - Búsqueda por nombre
  - Drag & drop para reordenar
  - Botones: Activar/Desactivar, Editar, Eliminar
  - Botón "+ Nuevo Tono"

- `ToneEditor.jsx` - Modal o página separada
  - Pestañas: 🇪🇸 Español | 🇬🇧 English
  - Campos:
    - Identificador interno (name)
    - Nombre (ES/EN)
    - Intensidad (slider 1-5)
    - Descripción (ES/EN)
    - Personalidad (textarea)
    - Recursos permitidos (lista editable)
    - Restricciones CRÍTICAS (lista editable)
    - Ejemplos (ES/EN) - input/output pairs
    - Activo (checkbox)
    - Default (radio)
  - Validaciones:
    - ✅ Nombre (ambos idiomas) requerido
    - ✅ Intensidad 1-5
    - ✅ Al menos 1 recurso y 1 restricción
    - ✅ Al menos 1 ejemplo por idioma
    - ✅ No desactivar TODOS los tonos

### 4. Integración con Roast Generation

**Archivo:** `src/services/roastPromptTemplate.js`

**Cambio en `buildBlockA()`:**

```javascript
// ANTES (hardcodeado):
const tonesText = `
1. FLANDERS (Intensidad: 2/5)
   ...
`;

// DESPUÉS (dinámico desde DB):
async buildBlockA(language = 'es') {
  // Cargar tonos desde DB (con cache)
  const tones = await toneConfigService.getActiveTones(language);

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

  return `Eres Roastr, un sistema de roast generation para Roastr.ai.

🎭 SISTEMA DE TONOS DE ROASTR:

Tienes ${tones.length} tonos disponibles:

${tonesText}

IMPORTANTE: Estos tonos son los ÚNICOS en el sistema.
...`;
}
```

**Cache Invalidation:**

- Al guardar/editar/eliminar → `toneConfigService.invalidateCache()`
- Block A se regenera en siguiente request (cache de OpenAI no afectado)

---

## 📝 Acceptance Criteria (12 AC)

### Backend (5 AC)

- [ ] **AC1:** Tabla `roast_tones` creada con schema completo
- [ ] **AC2:** API admin funcional (CRUD + activate/deactivate)
- [ ] **AC3:** Integración con `roastPrompt.js` (carga desde DB)
- [ ] **AC4:** Cache funcional (5min TTL, invalidación al cambiar)
- [ ] **AC5:** Migración inicial con 3 tonos actuales ejecutada

### Frontend (3 AC)

- [ ] **AC6:** Panel admin en `/admin/roast-tones` operativo
- [ ] **AC7:** Editor multiidioma (ES/EN) funcional
- [ ] **AC8:** Solo accesible para admin

### Validaciones (2 AC)

- [ ] **AC9:** NO permitir desactivar todos los tonos
- [ ] **AC10:** Soporte completo ES/EN en todos los campos

### Testing (1 AC)

- [ ] **AC11:** Al menos 15 tests pasando (unit + integration)

### Docs (1 AC)

- [ ] **AC12:** Documentación actualizada

---

## 🗂️ Archivos Afectados

### Nuevos Archivos

```
database/migrations/XXX_roast_tones_table.sql
src/services/toneConfigService.js
src/routes/admin/tones.js
src/routes/admin/index.js (mount tones router)
frontend/src/pages/admin/RoastTones.jsx
frontend/src/components/admin/TonesList.jsx
frontend/src/components/admin/ToneEditor.jsx
tests/unit/services/toneConfigService.test.js
tests/integration/admin-tones-api.test.js
tests/e2e/admin-tones-ui.test.js
docs/admin/tone-management.md
```

### Archivos Modificados

```
src/services/roastPromptTemplate.js (buildBlockA dinámico)
src/index.js (mount admin router si no existe)
docs/nodes/roast.md (mencionar sistema dinámico)
docs/test-evidence/issue-876/summary.md (test evidence)
```

---

## 🔄 Workflow Paso a Paso

### FASE 0: Setup (COMPLETO ✅)

1. ✅ Worktree creado: `roastr-ai-worktrees/issue-876`
2. ✅ .issue_lock configurado
3. ✅ GDD nodos cargados (roast, persona, multi-tenant)
4. ✅ coderabbit-lessons.md leído
5. ✅ Plan creado (este documento)

### FASE 1: Backend - Database (2h)

1. Crear migración `database/migrations/XXX_roast_tones_table.sql`
   - Tabla completa con todos los campos
   - Constraints (al menos 1 activo, 1 default, JSONB validation)
   - Trigger `ensure_at_least_one_active_tone()`
   - Índices (active, sort_order, is_default)
2. Script de migración inicial: seed 3 tonos actuales
   - flanders (intensidad 2, default)
   - balanceado (intensidad 3)
   - canalla (intensidad 4)
3. Ejecutar migración
4. Validar schema

### FASE 2: Backend - Service (2h)

1. Crear `src/services/toneConfigService.js`
   - Implementar cache en memoria (5min TTL)
   - Métodos: getActiveTones, getAllTones, getToneById, createTone, updateTone, deleteTone, activateTone, deactivateTone, reorderTones, invalidateCache
   - Localization helper: `localizeArray(tones, language)`
2. Escribir tests unitarios
   - Cache funcionando
   - Localización ES/EN
   - Validaciones
3. Ejecutar tests

### FASE 3: Backend - API Routes (2h)

1. Crear `src/routes/admin/tones.js`
   - Implementar 8 endpoints
   - Middleware `requireAdmin` (usar existente o crear)
   - Validaciones con Joi/Zod
   - Error handling (códigos específicos)
2. Mount router en `src/index.js` o `src/routes/admin/index.js`
3. Escribir tests de integración
   - CRUD completo
   - Validaciones (no desactivar todos)
   - Auth (solo admin)
4. Ejecutar tests

### FASE 4: Backend - Integration con Roast (1h)

1. Modificar `src/services/roastPromptTemplate.js`
   - Hacer `buildBlockA()` async
   - Cargar tonos desde toneConfigService
   - Generar texto dinámico
2. Validar backward compatibility
   - Nombres de tonos actuales (flanders, balanceado, canalla) mantenidos
   - Users existentes no notan cambios
3. Escribir tests
   - roastPrompt con tonos de DB
   - Cache invalidation
4. Ejecutar tests

### FASE 5: Frontend - Página Principal (2h)

1. Crear `frontend/src/pages/admin/RoastTones.jsx`
   - Layout base
   - Integración con API (fetch tonos)
   - Routing
2. Crear `frontend/src/components/admin/TonesList.jsx`
   - Tabla de tonos
   - Filtros (activo/inactivo, idioma)
   - Búsqueda
   - Botones: Activar/Desactivar, Editar, Eliminar
   - Botón "+ Nuevo Tono"
3. Drag & drop para reordenar (react-beautiful-dnd o similar)
4. Validar UI responsive

### FASE 6: Frontend - Editor (3h)

1. Crear `frontend/src/components/admin/ToneEditor.jsx`
   - Modal o página separada
   - Pestañas ES/EN
   - Formulario completo:
     - name, display_name (ES/EN), description (ES/EN)
     - intensity (slider)
     - personality (textarea)
     - resources (lista editable con add/remove)
     - restrictions (lista editable con add/remove)
     - examples (ES/EN - input/output pairs, add/remove)
     - active (checkbox), is_default (radio)
2. Validaciones frontend
   - Nombres requeridos (ES/EN)
   - Intensidad 1-5
   - Al menos 1 recurso, 1 restricción, 1 ejemplo por idioma
   - No desactivar todos los tonos (validar antes de submit)
3. Integración con API (POST/PUT)
4. Feedback visual (success/error)

### FASE 7: Testing (2h)

1. Tests unitarios (toneConfigService)
   - Cache TTL
   - Localization
   - Validaciones
2. Tests de integración (API)
   - CRUD completo
   - Auth (solo admin)
   - Validaciones (no desactivar todos)
3. Tests E2E (Playwright)
   - Crear nuevo tono
   - Editar tono
   - Activar/desactivar
   - Reordenar
   - Eliminar
4. Ejecutar test suite completo
5. Coverage >= 90%

### FASE 8: Documentation (1h)

1. Actualizar `docs/nodes/roast.md`
   - Sección "Dynamic Tone System"
   - Referencia a DB
2. Crear `docs/admin/tone-management.md`
   - Guía completa de gestión de tonos
   - Screenshots
3. Actualizar `roast-tone-system.md` (si existe)
4. README: sección Admin Panel

### FASE 9: Validation (1h)

1. GDD validations:
   ```bash
   node scripts/validate-gdd-runtime.js --full
   node scripts/score-gdd-health.js --ci  # >= 87
   ```
2. Tests pasando:
   ```bash
   npm test
   npm run test:coverage  # >= 90%
   ```
3. CodeRabbit review:
   ```bash
   npm run coderabbit:review
   # OBJETIVO: 0 comentarios
   ```
4. Manual testing:
   - Crear tono nuevo
   - Editar tono
   - Activar/desactivar
   - Reordenar
   - Eliminar
   - Generar roast con nuevo tono

### FASE 10: PR & Receipts (30min)

1. Generar agent receipts:
   - `docs/agents/receipts/cursor-backend-[timestamp].md`
   - `docs/agents/receipts/cursor-frontend-[timestamp].md`
   - `docs/agents/receipts/cursor-test-engineer-[timestamp].md`
2. Commit con mensaje estándar:

   ```
   feat(roast): Dynamic Tone Configuration System (#876)

   ADDED:
   - roast_tones table with multiidioma support (ES/EN)
   - toneConfigService with 5min cache
   - Admin API (8 endpoints) for tone CRUD
   - Admin Panel UI: TonesList + ToneEditor
   - Drag & drop reordering
   - Integration with roastPromptTemplate (buildBlockA dinámico)

   CHANGED:
   - roastPromptTemplate.buildBlockA() now async + loads from DB
   - 3 initial tones migrated from hardcoded to DB

   TESTS:
   - 15+ tests (unit + integration + E2E) passing
   - Coverage >= 90%

   DOCS:
   - Updated roast.md (Dynamic Tone System)
   - Created tone-management.md
   ```

3. Push & create PR
4. Esperar CodeRabbit review
5. Fix issues si aplica
6. Esperar aprobación usuario

---

## 🚨 Consideraciones Críticas

### Backward Compatibility

- ✅ Mantener nombres de tonos actuales (`flanders`, `balanceado`, `canalla`)
- ✅ Users existentes no deben notar cambios
- ✅ Default tone: `flanders` (intensidad 2)

### Performance

- ✅ Cache de 5min en memoria (aceptable para config que cambia poco)
- ⚠️ Si multi-instancia → considerar Redis
- ✅ Block A regenerado solo al cambiar tono (cache OpenAI no afectado)

### Security

- ✅ Solo admin puede editar (validar en backend Y frontend)
- ✅ Sanitizar inputs (prevenir injection)
- ✅ Validar JSONB structure
- ✅ RLS si tonos son por organización (SCOPE: global, no por org)

### Idiomas

- ✅ Empezar con ES/EN
- ✅ Arquitectura preparada para más idiomas (JSONB escalable)

### Quality Standards

- ✅ 0 comentarios CodeRabbit
- ✅ Tests 100% passing
- ✅ Coverage >= 90%
- ✅ GDD health >= 87

---

## 🎯 Agentes Relevantes

**Backend Developer:**

- Migration
- toneConfigService
- API routes
- Integration con roastPrompt

**Frontend Developer:**

- RoastTones page
- TonesList component
- ToneEditor component

**Test Engineer:**

- Unit tests
- Integration tests
- E2E tests

**Guardian:**

- Security review (admin-only access)
- Validation de constraints

**Documentation Agent:**

- Update roast.md
- Create tone-management.md

---

## ⏱️ Estimación

**Total:** 12-16 horas

| Fase                                | Horas           |
| ----------------------------------- | --------------- |
| FASE 0: Setup                       | 0.5h (COMPLETO) |
| FASE 1: Backend - Database          | 2h              |
| FASE 2: Backend - Service           | 2h              |
| FASE 3: Backend - API Routes        | 2h              |
| FASE 4: Backend - Integration       | 1h              |
| FASE 5: Frontend - Página Principal | 2h              |
| FASE 6: Frontend - Editor           | 3h              |
| FASE 7: Testing                     | 2h              |
| FASE 8: Documentation               | 1h              |
| FASE 9: Validation                  | 1h              |
| FASE 10: PR & Receipts              | 0.5h            |

**Próximos pasos:** Iniciar FASE 1 (Backend - Database)

---

**Plan creado:** 2025-11-18
**Issue:** #876
**Worktree:** `/Users/emiliopostigo/roastr-ai-worktrees/issue-876`
**Branch:** `feature/issue-876-dynamic-tone-system`
