# Issue: Implementar Persona Setup Flow (3 Campos Encriptados + Embeddings)

**Prioridad:** P1 (Alta - Core feature de personalización)
**Estimación:** 8-10 horas
**Estado Actual:** 50% completado (data model OK, service layer faltante)
**Documentación:** [docs/flows/persona-setup.md](../flows/persona-setup.md)

---

## 🎯 ¿Qué es este flujo?

**Persona Setup** es el corazón de la personalización de Roastr. Este flujo permite al usuario definir su "identidad digital" en 3 dimensiones:

1. **"Lo que me define"** - Pasiones, valores, identidad (ej: "Soy desarrollador apasionado por open source")
2. **"Lo que no tolero"** - Líneas rojas, triggers (ej: "No tolero la discriminación")
3. **"Lo que me da igual"** - Neutralidad (ej: "Me da igual el fútbol")

**¿Para qué sirve?**
- El motor de roast generation usa estos datos para **personalizar respuestas** según la personalidad del usuario
- Genera **embeddings semánticos** con OpenAI para matching inteligente
- Permite roasts más **contextualizados y relevantes**

**Importancia:** Sin Persona, los roasts son genéricos. Con Persona, son personalizados y reflejan la voz del usuario.

**Seguridad:**
- Datos **encriptados en DB** con AES-256-GCM (IV único por campo)
- Solo el usuario puede acceder a su persona (RLS policies)
- Embeddings NO revelan contenido original

**Tecnologías clave:**
- AES-256-GCM encryption (crypto module Node.js)
- OpenAI `text-embedding-3-small` (1536 dimensiones)
- pgvector para búsqueda semántica (opcional)
- Plan-based access control

**Business Logic:**
- Free: Sin acceso (0 campos)
- Starter: 2 campos (identity + intolerance)
- Pro/Plus: 3 campos completos

---

## 📋 Descripción Técnica

Implementar sistema de configuración de Persona con 3 campos encriptados que alimentan el motor de roast generation:

1. **"Lo que me define"** - Identidad, pasiones, valores
2. **"Lo que no tolero"** - Líneas rojas, triggers
3. **"Lo que me da igual"** - Neutralidad, indiferencia

**Features clave:**
- Encriptación AES-256-GCM para campos sensibles
- Generación de embeddings con OpenAI `text-embedding-3-small` (1536 dimensiones)
- Access control basado en plan:
  - Free: Sin acceso (0 campos)
  - Starter: 2 campos ("Lo que me define" + "Lo que no tolero")
  - Pro/Plus: 3 campos completos

**Estado actual:**
- ✅ Tabla `user_personas` existe en schema (según assessment)
- ✅ Columnas con encriptación definidas
- ❌ `PersonaService.js` no existe
- ❌ Endpoint `/api/persona` no implementado
- ❌ Embedding generation logic faltante

---

## ✅ Checklist Técnico

### 1. Backend: PersonaService Implementation

- [ ] **Crear `src/services/PersonaService.js`**

  **Métodos requeridos:**
  - [ ] `getPersona(userId)` → retorna persona desencriptada
  - [ ] `updatePersona(userId, fields)` → encripta y guarda
  - [ ] `deletePersona(userId)` → elimina datos (GDPR)
  - [ ] `generateEmbeddings(text)` → llamada a OpenAI
  - [ ] `encryptField(plaintext)` → AES-256-GCM encryption
  - [ ] `decryptField(ciphertext)` → AES-256-GCM decryption

  **Configuración de encriptación:**
  ```javascript
  const crypto = require('crypto');
  const ENCRYPTION_KEY = Buffer.from(process.env.PERSONA_ENCRYPTION_KEY, 'hex'); // 32 bytes
  const ALGORITHM = 'aes-256-gcm';

  function encryptField(plaintext) {
    if (!plaintext) return null;

    const iv = crypto.randomBytes(16); // IV único por campo
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag(); // 16 bytes de auth tag

    // Formato: iv (16) + tag (16) + encrypted data
    const combined = Buffer.concat([iv, tag, encrypted]);
    return combined.toString('base64');
  }

  function decryptField(ciphertext) {
    if (!ciphertext) return null;

    const combined = Buffer.from(ciphertext, 'base64');

    const iv = combined.subarray(0, 16);
    const tag = combined.subarray(16, 32);
    const encrypted = combined.subarray(32);

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  }
  ```

- [ ] **Implementar embedding generation**
  ```javascript
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async function generateEmbeddings(text) {
    if (!text || text.trim().length === 0) {
      return null;
    }

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
      });

      return response.data[0].embedding; // Array de 1536 floats
    } catch (error) {
      logger.error('Error generating embeddings:', error);
      throw new Error('Failed to generate embeddings');
    }
  }
  ```

- [ ] **Implementar plan-based access control**
  ```javascript
  const PLAN_LIMITS = {
    free: { fields: 0, maxCharsPerField: 0 },
    starter: { fields: 2, maxCharsPerField: 500 }, // identity + intolerance
    pro: { fields: 3, maxCharsPerField: 1000 },    // all 3 fields
    plus: { fields: 3, maxCharsPerField: 1000 }
  };

  function validatePersonaAccess(userPlan, fields) {
    const limits = PLAN_LIMITS[userPlan];

    if (fields.identity && limits.fields < 1) {
      throw new Error('Plan Free no permite configurar Persona');
    }

    if (fields.tolerance && limits.fields < 3) {
      throw new Error('Plan Starter no permite campo "Lo que me da igual"');
    }

    // Validar longitud
    for (const [key, value] of Object.entries(fields)) {
      if (value && value.length > limits.maxCharsPerField) {
        throw new Error(`Campo "${key}" excede límite de ${limits.maxCharsPerField} caracteres`);
      }
    }

    return true;
  }
  ```

### 2. Backend: Database Schema Verification

- [ ] **Verificar tabla `user_personas` existe**
  ```bash
  node scripts/verify-supabase-tables.js
  ```

- [ ] **Si NO existe, crear tabla:**
  ```sql
  CREATE TABLE user_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    identity_encrypted TEXT,           -- "Lo que me define" (encriptado)
    intolerance_encrypted TEXT,        -- "Lo que no tolero" (encriptado)
    tolerance_encrypted TEXT,          -- "Lo que me da igual" (encriptado)
    identity_embedding VECTOR(1536),   -- Embedding de identity (pgvector)
    intolerance_embedding VECTOR(1536),
    tolerance_embedding VECTOR(1536),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
  );

  -- Índice para búsqueda de embeddings
  CREATE INDEX idx_user_personas_identity_embedding
    ON user_personas USING ivfflat (identity_embedding vector_cosine_ops);

  CREATE INDEX idx_user_personas_intolerance_embedding
    ON user_personas USING ivfflat (intolerance_embedding vector_cosine_ops);

  -- RLS Policy
  ALTER TABLE user_personas ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage their own persona"
    ON user_personas FOR ALL
    USING (auth.uid() = user_id);
  ```

- [ ] **Verificar extensión pgvector habilitada en Supabase:**
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```

### 3. Backend: API Endpoints

- [ ] **Crear `GET /api/persona`**
  - [ ] Validar usuario autenticado
  - [ ] Obtener persona de DB
  - [ ] Desencriptar campos
  - [ ] NO retornar embeddings (solo campos de texto)
  - [ ] Retornar:
    ```json
    {
      "identity": "Soy desarrollador apasionado...",
      "intolerance": "No tolero la discriminación...",
      "tolerance": "Me da igual el fútbol..."
    }
    ```

- [ ] **Crear `POST /api/persona`**
  - [ ] Validar usuario autenticado
  - [ ] Obtener plan de usuario (desde `polar_subscriptions`)
  - [ ] Validar acceso según plan (usar `validatePersonaAccess()`)
  - [ ] Encriptar campos
  - [ ] Generar embeddings para cada campo
  - [ ] Upsert en DB (CONFLICT ON user_id DO UPDATE)
  - [ ] Rate limit: 10 updates/hora (prevent abuse)

- [ ] **Crear `PUT /api/persona`** (alias de POST para REST semántica)

- [ ] **Crear `DELETE /api/persona`**
  - [ ] Validar usuario autenticado
  - [ ] Eliminar registro de DB
  - [ ] Logging de eliminación (GDPR compliance)
  - [ ] Retornar 204 No Content

### 4. Frontend: Persona Setup UI

- [ ] **Crear componente `PersonaSetupForm`**

  **Campos:**
  - [ ] Textarea "Lo que me define" (placeholder, max chars según plan)
  - [ ] Textarea "Lo que no tolero" (placeholder, max chars según plan)
  - [ ] Textarea "Lo que me da igual" (disabled si plan Free/Starter)
  - [ ] Botón "Guardar" con loading state
  - [ ] Mensaje de confirmación tras guardar

  **Validaciones frontend:**
  - [ ] Mostrar contador de caracteres (ej: "250/500")
  - [ ] Deshabilitar campos según plan
  - [ ] Mostrar mensaje "Upgrade a Pro para desbloquear" si plan insuficiente
  - [ ] Prevenir submit si excede límites

- [ ] **Implementar función `savePersona()`**
  ```javascript
  async function savePersona(identity, intolerance, tolerance) {
    setLoading(true);

    try {
      const response = await fetch('/api/persona', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ identity, intolerance, tolerance })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      showNotification('✅ Persona actualizada correctamente');
    } catch (error) {
      showNotification('❌ ' + error.message);
    } finally {
      setLoading(false);
    }
  }
  ```

- [ ] **Implementar función `loadPersona()`** para cargar datos existentes

### 5. Integration con Roast Generation

- [ ] **Actualizar `RoastGeneratorEnhanced.js`** (o servicio equivalente)

  - [ ] Cargar persona del usuario antes de generar roast
  - [ ] Inyectar campos persona en prompt template
  - [ ] Usar embeddings para matching semántico (opcional, Phase 2)

  **Ejemplo de inyección en prompt:**
  ```javascript
  async function generateRoast(userId, comment) {
    const persona = await PersonaService.getPersona(userId);

    const promptWithPersona = `
    Tu tarea es generar un roast personalizado.

    CONTEXTO DEL USUARIO:
    - Lo que le define: ${persona.identity || 'No especificado'}
    - Lo que NO tolera: ${persona.intolerance || 'No especificado'}
    - Lo que le da igual: ${persona.tolerance || 'No especificado'}

    COMENTARIO A ROASTEAR: ${comment}

    Genera un roast que refleje la personalidad del usuario...
    `;

    return await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: promptWithPersona }]
    });
  }
  ```

### 6. Testing

- [ ] **Tests unitarios para `PersonaService.js`**
  - [ ] Test: `encryptField()` → `decryptField()` retorna texto original
  - [ ] Test: `encryptField()` con mismo texto 2 veces → ciphertexts diferentes (IV único)
  - [ ] Test: `generateEmbeddings()` retorna array de 1536 elementos
  - [ ] Test: `validatePersonaAccess()` rechaza plan Free intentando guardar
  - [ ] Test: `validatePersonaAccess()` rechaza plan Starter intentando guardar "tolerance"

- [ ] **Tests de integración para endpoints**
  - [ ] Test: `POST /api/persona` con plan Pro → 200 + datos guardados encriptados
  - [ ] Test: `POST /api/persona` con plan Free → 403 Forbidden
  - [ ] Test: `POST /api/persona` excediendo límite caracteres → 400 Bad Request
  - [ ] Test: `GET /api/persona` retorna datos desencriptados correctamente
  - [ ] Test: `DELETE /api/persona` → 204 + registro eliminado de DB

- [ ] **Tests E2E del flujo completo**
  - [ ] Usuario con plan Pro → Completa formulario → Guarda → Recarga página → Datos persisten
  - [ ] Usuario con plan Free intenta guardar → Mensaje de error
  - [ ] Usuario genera roast → Roast refleja datos de persona

- [ ] **Tests de seguridad**
  - [ ] Verificar que datos en DB están encriptados (NO legibles en plain text)
  - [ ] Verificar que embeddings NO revelan contenido original
  - [ ] Test SQL injection en campos de persona
  - [ ] Test XSS en campos de persona

### 7. Documentación

- [ ] Actualizar `docs/flows/persona-setup.md` con:
  - [ ] Código completo de encriptación/desencriptación
  - [ ] Ejemplos de llamadas a API
  - [ ] Tabla de límites por plan actualizada

- [ ] Actualizar `docs/nodes/persona.md`:
  - [ ] Actualizar cobertura de tests
  - [ ] Añadir PersonaService a "Agentes Relevantes"
  - [ ] Documentar integración con roast generation

- [ ] Actualizar `CLAUDE.md`:
  - [ ] Añadir env var `PERSONA_ENCRYPTION_KEY` (32 bytes hex)
  - [ ] Documentar que se usa OpenAI embeddings
  - [ ] NO incluir key real (solo placeholder)

- [ ] Crear script de generación de encryption key:
  ```bash
  # scripts/generate-persona-key.js
  const crypto = require('crypto');
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Add to .env:');
  console.log(`PERSONA_ENCRYPTION_KEY=${key}`);
  ```

---

## 🔗 Dependencias

**Bloqueantes (debe resolverse antes):**
- ✅ Issue Login & Registration (requiere auth)
- ✅ Issue Payment (Polar) (requiere plan para access control)

**Desbloqueadas por esta issue:**
- Issue Roasting Control (personalización basada en persona)
- Issue Global State (incluye `persona` en estado global)

---

## 🎯 Criterios de Aceptación

Esta issue se considera **100% completa** cuando:

1. ✅ `PersonaService.js` implementado con encriptación + embeddings
2. ✅ Tabla `user_personas` creada con extensión pgvector
3. ✅ Endpoints `/api/persona` (GET/POST/DELETE) implementados
4. ✅ Frontend con formulario funcional y validaciones por plan
5. ✅ Integration con roast generation (prompt inyecta persona)
6. ✅ **TODOS los tests pasando al 100%** (incluye tests de seguridad)
7. ✅ Datos en DB encriptados correctamente (verificado manualmente)
8. ✅ Documentación actualizada
9. ✅ Pre-Flight Checklist ejecutado
10. ✅ CI/CD passing

---

## 📊 Métricas de Éxito

| Métrica | Valor Actual | Objetivo | Estado |
|---------|--------------|----------|--------|
| Tests pasando | N/A | 100% | ⏳ Pendiente |
| Cobertura persona module | 70% | ≥90% | ⏳ Pendiente |
| Tiempo de implementación | 0h | ≤10h | ⏳ Pendiente |
| Encriptación funcionando | ❌ | ✅ | ⏳ Pendiente |

---

## 📝 Notas de Implementación

**Seguridad:**
- `PERSONA_ENCRYPTION_KEY` debe ser 32 bytes (256 bits) en hex
- NUNCA loggear campos desencriptados
- Usar IV único por campo (NO reutilizar)
- Auth tag GCM previene tampering

**Performance:**
- Embeddings generation: ~200ms por campo (no bloqueante)
- Cachear embeddings (solo regenerar si texto cambia)
- Índice ivfflat para búsquedas rápidas (si se implementa similarity search)

**GDPR:**
- `DELETE /api/persona` debe eliminar completamente
- Logging de eliminaciones (audit trail)
- Usuario puede exportar datos (incluir en data export endpoint)

**UX:**
- Mostrar tooltip explicando cada campo
- Ejemplos de placeholder: "Soy apasionado por la tecnología..."
- Guardar automático cada 30 segundos (draft mode, opcional)

---

**Siguiente paso tras completar:** Implementar Issue Roasting Control - P2
