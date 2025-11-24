# Plan de Implementación - Issue #948

**Título**: Migrar endpoints de Social Connections a Zod (P1 - Muy Recomendado)  
**Priority**: 🟧 P1 - Muy Recomendado  
**Labels**: enhancement, backend, integrations  
**Assignee**: Back-end Dev + Test Engineer  
**Created**: 2025-11-23

---

## Contexto

Actualmente los endpoints de social connections (Twitter, YouTube, Instagram, etc.) usan `express-validator` para validación de OAuth codes, state tokens y redirect URIs. Esto genera:

- Inconsistencia con el resto del stack (Zod ya instalado v3.25.76)
- Falta de validación estructurada para OAuth flows
- Dificultad para debugging de errores de conexión
- Falta de tipado inferido para TypeScript compatibility

**Migración propuesta**: Reemplazar `express-validator` con **Zod** para todos los endpoints de social connections.

---

## Estado Actual

### Endpoints Afectados

**Verificar existencia de estos endpoints:**

- `POST /api/twitter/connect`
- `POST /api/youtube/connect`
- `POST /api/instagram/connect`
- `POST /api/facebook/connect`
- `POST /api/discord/connect`
- `POST /api/twitch/connect`
- `POST /api/reddit/connect`
- `POST /api/tiktok/connect`
- `POST /api/bluesky/connect`

**Archivos actuales (a verificar):**

- `src/routes/twitter.js` (o `src/integrations/twitter/routes.js`)
- `src/routes/youtube.js`
- `src/routes/instagram.js`
- (similares para otras plataformas)

### Validación Actual

**express-validator pattern** (ejemplo Twitter):

```javascript
const { body, validationResult } = require('express-validator');

router.post(
  '/connect',
  body('code').notEmpty().withMessage('OAuth code is required'),
  body('state').notEmpty().withMessage('State token is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Handle connection...
  }
);
```

### Datos a Validar

Según issue description:

- `code` - OAuth authorization code (string, not empty)
- `state` - CSRF token (string, not empty, matches session)
- `redirect_uri` - Callback URL (optional, valid URL format)
- Headers de autenticación (Authorization header si aplica)

---

## Nodos GDD Relevantes

**Resueltos con `resolve-graph.js`:**

- `social-platforms.md` - 9 plataformas, OAuth flows, authentication patterns
- `queue-system.md` - FetchCommentsWorker interaction
- `multi-tenant.md` - Organization-scoped configs
- `cost-control.md` - Service key requirements

**Insights clave:**

- Social platforms usan `MultiTenantIntegration` base class
- OAuth credentials en `integration_configs.credentials` (JSONB encrypted)
- Authentication patterns varían: OAuth 1.0a (Twitter), OAuth 2.0 (YouTube, Discord, Twitch), API Key (YouTube read-only)

---

## Agentes Relevantes

- **Backend Developer** - Implementación de schemas Zod, migración de routes
- **Test Engineer** - Tests unitarios + integración, coverage >=90%
- **Guardian** (si aplica) - Auditoría de seguridad OAuth, validación CSRF

---

## Plan de Implementación

### PASO 1: Crear Esquemas Zod (Social Validation)

**Archivo nuevo**: `src/validators/zod/social.schema.js`

**Esquemas a crear:**

```javascript
const { z } = require('zod');

/**
 * OAuth Authorization Code Schema
 * Validates authorization code from OAuth providers
 */
const OAuthCodeSchema = z.object({
  code: z.string().min(1, 'OAuth code is required').max(500, 'OAuth code too long'),
  state: z.string().min(1, 'State token is required').max(200, 'State token too long'),
  redirect_uri: z.string().url('Invalid redirect URI').optional()
});

/**
 * OAuth Connection Request Schema
 * Validates full OAuth connection payload
 */
const OAuthConnectionSchema = z.object({
  platform: z
    .enum([
      'twitter',
      'youtube',
      'instagram',
      'facebook',
      'discord',
      'twitch',
      'reddit',
      'tiktok',
      'bluesky'
    ])
    .describe('Social media platform'),
  code: z.string().min(1, 'OAuth code is required'),
  state: z.string().min(1, 'State token is required'),
  redirect_uri: z.string().url().optional(),
  organization_id: z.string().uuid().optional() // For multi-tenant
});

/**
 * Platform-specific schemas (if needed)
 */
const TwitterConnectSchema = OAuthConnectionSchema.extend({
  platform: z.literal('twitter'),
  oauth_token: z.string().optional(), // OAuth 1.0a specific
  oauth_verifier: z.string().optional()
});

const YouTubeConnectSchema = OAuthConnectionSchema.extend({
  platform: z.literal('youtube'),
  scope: z.string().optional() // Validate scopes
});

// ... (similar para otras plataformas)

module.exports = {
  OAuthCodeSchema,
  OAuthConnectionSchema,
  TwitterConnectSchema,
  YouTubeConnectSchema
  // ... export platform-specific schemas
};
```

**Validación:**

- [ ] Schemas creados en `src/validators/zod/social.schema.js`
- [ ] Exportados correctamente con JSDoc
- [ ] Linter pasando (no unused vars)

---

### PASO 2: Crear Helper para Formatear Errores Zod

**Archivo nuevo**: `src/validators/zod/errorFormatter.js`

```javascript
const { logger } = require('../../utils/logger');

/**
 * Format Zod validation errors for API responses
 * @param {import('zod').ZodError} zodError - Zod validation error
 * @returns {Object} Formatted error response
 */
function formatZodErrors(zodError) {
  const errors = zodError.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  }));

  return {
    success: false,
    errors,
    message: 'Validation failed'
  };
}

/**
 * Express middleware to validate request body with Zod schema
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.validatedBody = validated; // Attach validated data to req
      next();
    } catch (error) {
      if (error.name === 'ZodError') {
        logger.warn('Zod validation failed', { errors: error.errors });
        return res.status(400).json(formatZodErrors(error));
      }
      next(error); // Pass unexpected errors to error handler
    }
  };
}

/**
 * Validate request query params with Zod schema
 * @param {import('zod').ZodSchema} schema - Zod schema
 * @returns {Function} Express middleware
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.query);
      req.validatedQuery = validated;
      next();
    } catch (error) {
      if (error.name === 'ZodError') {
        logger.warn('Query validation failed', { errors: error.errors });
        return res.status(400).json(formatZodErrors(error));
      }
      next(error);
    }
  };
}

module.exports = {
  formatZodErrors,
  validateBody,
  validateQuery
};
```

**Validación:**

- [ ] Helper creado con JSDoc completo
- [ ] Middleware `validateBody` y `validateQuery` exportados
- [ ] Logger usado (no console.log)

---

### PASO 3: Identificar Archivos de Routes Existentes

**Acción:** Buscar rutas actuales para cada plataforma

```bash
# En worktree
find src -name "*twitter*.js" -o -name "*youtube*.js" -o -name "*instagram*.js"
find src/routes -type f -name "*.js" | grep -E "(twitter|youtube|instagram|discord)"
```

**Expected locations:**

- `src/routes/twitter.js`
- `src/routes/youtube.js`
- `src/routes/instagram.js`
- `src/integrations/twitter/routes.js` (alternativo)
- `src/integrations/youtube/routes.js`

**Si no existen**: Crear routes nuevas siguiendo patrón existente.

**Validación:**

- [ ] Archivos de routes identificados
- [ ] Endpoints actuales documentados
- [ ] express-validator imports confirmados

---

### PASO 4: Migrar Endpoints a Zod (Platform by Platform)

#### Patrón de Migración

**ANTES (express-validator):**

```javascript
const { body, validationResult } = require('express-validator');

router.post('/connect', body('code').notEmpty(), body('state').notEmpty(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Handle connection
});
```

**DESPUÉS (Zod):**

```javascript
const { validateBody } = require('../validators/zod/errorFormatter');
const { OAuthConnectionSchema } = require('../validators/zod/social.schema');

router.post('/connect', validateBody(OAuthConnectionSchema), async (req, res) => {
  // req.validatedBody contains validated data
  const { code, state, redirect_uri } = req.validatedBody;
  // Handle connection
});
```

#### Plataformas a Migrar (en orden)

1. **Twitter** (`src/routes/twitter.js` o `src/integrations/twitter/routes.js`)
   - Usar `TwitterConnectSchema` (OAuth 1.0a específico)
   - Validar `oauth_token`, `oauth_verifier`

2. **YouTube** (`src/routes/youtube.js`)
   - Usar `YouTubeConnectSchema`
   - Validar `scope` (comentarios, posting)

3. **Discord** (`src/routes/discord.js`)
   - Usar `OAuthConnectionSchema` genérico
   - Validar `guild_id` si aplica

4. **Instagram, Facebook, Twitch, Reddit, TikTok, Bluesky**
   - Usar `OAuthConnectionSchema` genérico o platform-specific

**Validación por plataforma:**

- [ ] Imports de express-validator eliminados
- [ ] Zod schemas importados
- [ ] Middleware `validateBody` usado
- [ ] Tests actualizados

---

### PASO 5: Tests Unitarios (Zod Schemas)

**Archivo nuevo**: `tests/unit/validators/social.schema.test.js`

```javascript
const {
  OAuthCodeSchema,
  OAuthConnectionSchema,
  TwitterConnectSchema
} = require('../../../src/validators/zod/social.schema');

describe('Social Connection Zod Schemas', () => {
  describe('OAuthCodeSchema', () => {
    it('should validate valid OAuth code', () => {
      const valid = {
        code: 'abc123xyz',
        state: 'csrf_token_12345'
      };
      expect(() => OAuthCodeSchema.parse(valid)).not.toThrow();
    });

    it('should reject empty code', () => {
      const invalid = { code: '', state: 'csrf_token' };
      expect(() => OAuthCodeSchema.parse(invalid)).toThrow('OAuth code is required');
    });

    it('should reject empty state', () => {
      const invalid = { code: 'abc123', state: '' };
      expect(() => OAuthCodeSchema.parse(invalid)).toThrow('State token is required');
    });

    it('should accept optional redirect_uri', () => {
      const valid = {
        code: 'abc123',
        state: 'csrf_token',
        redirect_uri: 'https://example.com/callback'
      };
      expect(() => OAuthCodeSchema.parse(valid)).not.toThrow();
    });

    it('should reject invalid redirect_uri format', () => {
      const invalid = {
        code: 'abc123',
        state: 'csrf_token',
        redirect_uri: 'not-a-url'
      };
      expect(() => OAuthCodeSchema.parse(invalid)).toThrow('Invalid redirect URI');
    });
  });

  describe('OAuthConnectionSchema', () => {
    it('should validate all supported platforms', () => {
      const platforms = [
        'twitter',
        'youtube',
        'instagram',
        'facebook',
        'discord',
        'twitch',
        'reddit',
        'tiktok',
        'bluesky'
      ];

      platforms.forEach((platform) => {
        const valid = {
          platform,
          code: 'abc123',
          state: 'csrf_token'
        };
        expect(() => OAuthConnectionSchema.parse(valid)).not.toThrow();
      });
    });

    it('should reject unsupported platform', () => {
      const invalid = {
        platform: 'linkedin',
        code: 'abc123',
        state: 'csrf_token'
      };
      expect(() => OAuthConnectionSchema.parse(invalid)).toThrow();
    });
  });

  describe('TwitterConnectSchema', () => {
    it('should validate Twitter OAuth 1.0a flow', () => {
      const valid = {
        platform: 'twitter',
        code: 'abc123',
        state: 'csrf_token',
        oauth_token: 'twitter_token',
        oauth_verifier: 'verifier_123'
      };
      expect(() => TwitterConnectSchema.parse(valid)).not.toThrow();
    });

    it('should reject non-twitter platform', () => {
      const invalid = {
        platform: 'youtube',
        code: 'abc123',
        state: 'csrf_token'
      };
      expect(() => TwitterConnectSchema.parse(invalid)).toThrow();
    });
  });
});
```

**Coverage Target**: >=90% para `social.schema.js`

**Validación:**

- [ ] Tests unitarios creados
- [ ] Happy path + error cases + edge cases
- [ ] Coverage >=90%
- [ ] Tests pasando 100%

---

### PASO 6: Tests de Integración (Endpoints)

**Archivos a actualizar/crear:**

- `tests/integration/routes/twitter.test.js` (actualizar)
- `tests/integration/routes/youtube.test.js` (actualizar)
- `tests/integration/routes/social-connections.test.js` (nuevo, genérico)

**Patrón de test:**

```javascript
const request = require('supertest');
const express = require('express');
const twitterRoutes = require('../../../src/routes/twitter');

describe('POST /api/twitter/connect (Zod validation)', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/twitter', twitterRoutes);
  });

  it('should accept valid OAuth connection', async () => {
    const response = await request(app).post('/api/twitter/connect').send({
      code: 'valid_oauth_code',
      state: 'csrf_token_12345',
      redirect_uri: 'https://roastr.ai/callback'
    });

    expect(response.status).not.toBe(400); // Validation should pass
  });

  it('should reject missing code', async () => {
    const response = await request(app).post('/api/twitter/connect').send({
      state: 'csrf_token_12345'
    });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'code',
          message: expect.stringContaining('required')
        })
      ])
    );
  });

  it('should reject invalid redirect_uri', async () => {
    const response = await request(app).post('/api/twitter/connect').send({
      code: 'valid_code',
      state: 'csrf_token',
      redirect_uri: 'not-a-valid-url'
    });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'redirect_uri',
          message: expect.stringContaining('Invalid')
        })
      ])
    );
  });
});
```

**Coverage Target**: >=90% para routes afectadas

**Validación:**

- [ ] Tests de integración actualizados para cada plataforma
- [ ] Validation errors verificados (status 400, error structure)
- [ ] No breaking changes en API contracts
- [ ] Tests pasando 100%

---

### PASO 7: Eliminar express-validator de Dependencias

**Acción:**

```bash
npm uninstall express-validator
```

**Verificación:**

```bash
# No debe haber imports de express-validator
grep -r "express-validator" src/
# Expected: Sin resultados (o solo comments)
```

**Validación:**

- [ ] `express-validator` eliminado de `package.json`
- [ ] No imports residuales en código
- [ ] Tests pasando después de desinstalación

---

## Acceptance Criteria

**AC 1: Endpoints de social connections usan Zod**

- [ ] Todos los endpoints (`/connect`) usan schemas Zod
- [ ] Middleware `validateBody` aplicado
- [ ] Validación de OAuth codes, state tokens, redirect_uri

**AC 2: express-validator eliminado**

- [ ] Paquete desinstalado
- [ ] Sin imports en código
- [ ] Sin errores de runtime

**AC 3: Tests pasando al 100%**

- [ ] Tests unitarios (schemas): 100% passing
- [ ] Tests de integración (routes): 100% passing
- [ ] Coverage >=90% en archivos modificados

**AC 4: Validación de OAuth codes**

- [ ] OAuth codes validados (not empty, max length)
- [ ] State tokens validados (CSRF protection)
- [ ] Redirect URIs validados (URL format)
- [ ] Platform-specific fields validados (oauth_token, scope, etc.)

**AC 5: No breaking changes en API contracts**

- [ ] Status codes iguales (400 para validation errors)
- [ ] Response structure compatible (errors array)
- [ ] Frontend no necesita cambios

---

## Archivos Afectados

### Nuevos

- `src/validators/zod/social.schema.js` (schemas Zod)
- `src/validators/zod/errorFormatter.js` (helper para errores)
- `tests/unit/validators/social.schema.test.js` (tests unitarios)

### Modificados

- `src/routes/twitter.js` (o `src/integrations/twitter/routes.js`)
- `src/routes/youtube.js`
- `src/routes/instagram.js`
- `src/routes/facebook.js`
- `src/routes/discord.js`
- `src/routes/twitch.js`
- `src/routes/reddit.js`
- `src/routes/tiktok.js`
- `src/routes/bluesky.js`
- `tests/integration/routes/*.test.js` (actualizar tests existentes)
- `package.json` (remover express-validator)

---

## Riesgos y Mitigaciones

### Riesgo 1: Breaking changes en API contracts

**Mitigación**: Mantener estructura de errores compatible con express-validator

```javascript
// ANTES (express-validator)
{
  errors: [{ msg: 'Invalid value', param: 'code', location: 'body' }];
}

// DESPUÉS (Zod - compatible)
{
  errors: [{ message: 'Invalid value', field: 'code', code: 'invalid_type' }];
}
```

### Riesgo 2: OAuth flows específicos por plataforma

**Mitigación**: Crear schemas específicos (TwitterConnectSchema, YouTubeConnectSchema) en vez de uno genérico

### Riesgo 3: Tests fallando por cambios en validación

**Mitigación**: Ejecutar suite completa antes de PR, verificar >=90% coverage

---

## Validación Final

### Pre-Flight Checklist

- [ ] Tests unitarios pasando 100%
- [ ] Tests de integración pasando 100%
- [ ] Coverage >=90% en archivos nuevos/modificados
- [ ] Linter pasando (no console.logs, no unused vars)
- [ ] GDD nodes actualizados (`social-platforms.md`)
- [ ] "Agentes Relevantes" actualizados en nodos afectados

### Comandos de Verificación

```bash
# Tests
npm test -- tests/unit/validators/social.schema.test.js
npm test -- tests/integration/routes/

# Coverage
npm run test:coverage -- --collectCoverageFrom="src/validators/zod/**"

# Linter
npm run lint

# GDD Validation
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci  # Debe >=87
```

---

## Receipts Generados

**Agentes invocados:**

1. **Backend Developer** - Implementación de schemas Zod, migración routes
   - Receipt: `docs/agents/receipts/cursor-backend-dev-[timestamp].md`

2. **Test Engineer** - Tests unitarios + integración, coverage validation
   - Receipt: `docs/agents/receipts/cursor-test-engineer-[timestamp].md`

3. **Guardian** (si aplica) - Auditoría OAuth security, CSRF validation
   - Receipt: `docs/agents/receipts/cursor-guardian-[timestamp].md`

---

## Referencias

- **Zod Docs**: https://zod.dev/
- **Zod ya instalado**: v3.25.76 (verificar en `package.json`)
- **CodeRabbit Lessons**: `docs/patterns/coderabbit-lessons.md`
- **Social Platforms Node**: `docs/nodes/social-platforms.md`
- **Integration Workflow**: `docs/INTEGRATIONS.md`

---

**Plan creado**: 2025-11-23  
**Autor**: Orchestrator (AI Assistant)  
**Status**: ✅ Ready for Implementation
