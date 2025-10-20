# Plan: System Flows Review & Optimization

**Created:** 2025-10-19
**Type:** Enhancement + Documentation
**Priority:** P1 (Core User Experience)
**Estimated Effort:** 3-5 days
**Assessment:** `docs/assessment/flows-review.md`

---

## Objetivo

Revisar y optimizar los flujos principales del sistema Roastr para garantizar coherencia funcional, claridad de UX y consistencia en la gestión de estado entre frontend, backend y Polar (payments).

---

## Estado Actual

Según el assessment completo (`docs/assessment/flows-review.md`):

### Completitud por Flujo

| Flujo | Completitud | Estado | Prioridad |
|-------|-------------|--------|-----------|
| Login/Registro | 80% | 🟢 Funcional, needs docs | P2 |
| Payment (Polar) | 30% | 🔴 Missing integration | P0 |
| Persona Setup | 50% | 🟡 Partial implementation | P1 |
| Roasting Control | 60% | 🟡 Architecture exists, no endpoints | P1 |
| Level Configuration | 20% | 🔴 Conceptually defined only | P1 |
| Global State Schema | 0% | 🔴 Undocumented | P2 |

### Gaps Críticos

1. **Polar Payment Integration (P0)**
   - No `polarService.js` implementation
   - Missing webhook handlers
   - No subscription sync with database
   - Trial period logic undefined

2. **Persona Service (P1)**
   - No dedicated `/api/persona/*` endpoints
   - Validation rules incomplete
   - Plan-based feature restrictions not enforced

3. **Level Configuration Service (P1)**
   - No user-configurable roast intensity levels
   - Shield thresholds hardcoded
   - Missing database schema for configs

---

## Nodos GDD Afectados

### Directamente Afectados

1. **billing** (`docs/nodes/billing.md`)
   - Current: Stripe integration (70% coverage)
   - Needs: Polar migration + subscription sync
   - Action: **ENHANCE** with Polar service

2. **persona** (`docs/nodes/persona.md`)
   - Current: Data model complete (70% coverage)
   - Needs: API endpoints + service layer
   - Action: **ENHANCE** with persona service

3. **roast** (`docs/nodes/roast.md`)
   - Current: Generation system complete (0% coverage - needs tests)
   - Needs: Control endpoints + level config
   - Action: **ENHANCE** with control API

4. **guardian** (`docs/nodes/guardian.md`)
   - Current: Governance layer (50% coverage)
   - Needs: Monitor flow changes
   - Action: **MONITOR** changes to critical domains

5. **multi-tenant** (`docs/nodes/multi-tenant.md`)
   - Current: RLS policies complete (70% coverage)
   - Needs: Session management docs
   - Action: **DOCUMENT** authentication flow

### Dependencias Cross-Node

```
multi-tenant (auth/session)
    ↓
billing (subscription state)
    ↓
persona (user preferences)
    ↓
roast (generation with levels)
    ↓
guardian (shield levels)
```

---

## Fases de Implementación

### FASE 1: Documentación Foundation (Día 1 - 4-6 horas)

**Objetivo:** Establecer documentación base para todos los flujos

#### Tareas

1. **Flujo de Login/Registro**
   - Crear `docs/flows/login-registration.md`
   - Diagrama Mermaid: Frontend → API → Supabase Auth → JWT → RLS
   - Documentar token refresh strategy
   - Error handling paths (invalid credentials, expired tokens)
   - Multi-tenant session isolation

2. **Flujo de Payment (Polar)**
   - Crear `docs/flows/payment-polar.md`
   - Diagrama Mermaid: Frontend → Polar Checkout → Webhooks → Supabase → Plan Sync
   - Document trial period logic (30 días Starter)
   - Subscription states (active, trial, past_due, canceled)
   - Plan upgrade/downgrade flow

3. **Flujo de Persona Setup**
   - Crear `docs/flows/persona-setup.md`
   - Diagrama Mermaid: Setup Wizard → API → Encryption → Embeddings → Persistence
   - Document 3-component system (lo que me define, lo que no tolero, lo que me da igual)
   - Plan-based field restrictions (Free=none, Starter=2 fields, Pro=3 fields)
   - Validation rules (300 char limit, encryption)

4. **Flujo de Roasting Control**
   - Crear `docs/flows/roasting-control.md`
   - Diagrama Mermaid: UI Toggle → API → Database → Workers → Platform Actions
   - Document enable/disable state propagation
   - Real-time worker synchronization
   - Error handling (workers offline, platform API failures)

5. **Flujo de Level Configuration**
   - Crear `docs/flows/level-configuration.md`
   - Diagrama Mermaid: UI Settings → API → Validation → Database → Roast Engine
   - Document roast levels (1-5: suave, neutral, moderado, agresivo, caústico)
   - Document shield levels (tolerante, balanceado, estricto)
   - Plan-based restrictions (Free=fixed, Pro=3 levels, Plus=5 levels)

6. **Global State Schema**
   - Crear `docs/flows/global-state.md`
   - Diagrama de estado completo (frontend ↔ backend ↔ Polar ↔ Supabase)
   - Document state synchronization mechanisms
   - Conflict resolution strategy
   - Real-time updates (WebSockets vs polling)

#### Criterios de Éxito

- ✅ 6 archivos markdown creados en `docs/flows/`
- ✅ Todos los diagramas Mermaid renderizables
- ✅ Estado actual documentado (sin implementación todavía)
- ✅ Gaps identificados para Fase 2

#### Agentes

- **Documentation Agent** - Lead (crear diagramas + contenido)
- **Orchestrator** - Coordinación y validación

---

### FASE 2: Critical Gaps - Polar Integration (Día 2-3 - 8-12 horas)

**Objetivo:** Implementar integración completa con Polar (payment provider)

#### Background

**Current State:** Sistema usa Stripe en código pero Polar está en business model
**Decision:** Migrar de Stripe → Polar como Merchant of Record (MoR)
**Why Polar:**
- MoR simplifica compliance (EU VAT, US sales tax)
- Unified billing para suscripciones + one-time purchases
- Better developer experience con modern API

#### Tareas

1. **Polar Service Implementation**
   - Crear `src/services/polarService.js`
   - API client configuration (Polar API key, environment)
   - Methods:
     - `createCheckoutSession(userId, plan)` → checkout URL
     - `getSubscription(polarSubscriptionId)` → subscription details
     - `cancelSubscription(polarSubscriptionId)` → cancellation
     - `updateSubscription(polarSubscriptionId, newPlan)` → upgrade/downgrade
     - `createCustomerPortalSession(userId)` → portal URL

2. **Webhook Handler Implementation**
   - Crear `src/webhooks/polarWebhooks.js`
   - Signature verification (Polar webhook secret)
   - Event handlers:
     - `checkout.completed` → activate subscription
     - `subscription.updated` → sync plan changes
     - `subscription.canceled` → downgrade to free
     - `payment.succeeded` → update subscription status
     - `payment.failed` → mark as past_due
   - Idempotency (track event IDs in `polar_webhook_events` table)

3. **Database Schema**
   - Crear `database/migrations/add_polar_subscriptions.sql`
   - Table: `polar_subscriptions`
     ```sql
     CREATE TABLE polar_subscriptions (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id UUID REFERENCES users(id) ON DELETE CASCADE,
       polar_subscription_id VARCHAR(255) UNIQUE NOT NULL,
       polar_customer_id VARCHAR(255) NOT NULL,
       plan VARCHAR(50) NOT NULL, -- free, starter, pro, plus
       status VARCHAR(20) NOT NULL, -- active, trial, past_due, canceled
       trial_end_date TIMESTAMPTZ,
       current_period_start TIMESTAMPTZ NOT NULL,
       current_period_end TIMESTAMPTZ NOT NULL,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW(),
       CONSTRAINT polar_subscriptions_plan_check CHECK (plan IN ('free', 'starter', 'pro', 'plus')),
       CONSTRAINT polar_subscriptions_status_check CHECK (status IN ('active', 'trial', 'past_due', 'canceled'))
     );
     CREATE INDEX idx_polar_subscriptions_user ON polar_subscriptions(user_id);
     CREATE INDEX idx_polar_subscriptions_polar_id ON polar_subscriptions(polar_subscription_id);
     ```
   - Table: `polar_webhook_events` (idempotency tracking)
     ```sql
     CREATE TABLE polar_webhook_events (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       event_id VARCHAR(255) UNIQUE NOT NULL,
       event_type VARCHAR(100) NOT NULL,
       processed_at TIMESTAMPTZ DEFAULT NOW(),
       created_at TIMESTAMPTZ DEFAULT NOW()
     );
     CREATE INDEX idx_polar_webhook_events_id ON polar_webhook_events(event_id);
     ```

4. **Trial Period Logic**
   - Implement 30-day trial for Starter plan
   - Auto-downgrade to Free if trial expires without payment
   - Grace period: 3 days after trial_end_date before downgrade
   - Email notifications:
     - Trial starts: "Welcome to your 30-day trial"
     - Trial ends in 7 days: "Your trial is ending soon"
     - Trial ended: "Your trial has ended, please subscribe"
     - Downgraded: "Your account has been downgraded to Free"

5. **Plan Sync with Supabase**
   - Function: `syncPolarSubscriptionToSupabase(polarSubscriptionId)`
   - Updates `users.plan` based on Polar subscription status
   - Updates `organizations.plan_id` for org-scoped plans
   - Updates `users.subscription_status` (active, trial, past_due, canceled)
   - Atomic transaction to prevent inconsistencies

6. **Cost Control Integration**
   - Connect `src/services/costControl.js` to Polar subscription state
   - Enforce plan limits based on `polar_subscriptions.plan`
   - Throttle requests when approaching plan limits
   - Hard limit at 100% usage (with 10% grace period for Pro+)

#### API Endpoints

```javascript
// Create Polar checkout session
router.post('/api/billing/polar/checkout', async (req, res) => {
  const { plan } = req.body; // 'starter', 'pro', 'plus'
  const userId = req.user.id;

  const checkoutUrl = await polarService.createCheckoutSession(userId, plan);
  res.json({ success: true, checkoutUrl });
});

// Polar webhook receiver
router.post('/api/billing/polar/webhooks', async (req, res) => {
  const event = req.body;
  const signature = req.headers['polar-signature'];

  // Verify signature
  if (!polarService.verifyWebhookSignature(event, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Check idempotency
  const { data: existingEvent } = await supabase
    .from('polar_webhook_events')
    .select('id')
    .eq('event_id', event.id)
    .single();

  if (existingEvent) {
    return res.json({ received: true, idempotent: true });
  }

  // Process event
  await polarWebhooks.handleEvent(event);

  // Track event
  await supabase.from('polar_webhook_events').insert({
    event_id: event.id,
    event_type: event.type
  });

  res.json({ received: true, processed: true });
});

// Get current subscription
router.get('/api/billing/polar/subscription', async (req, res) => {
  const userId = req.user.id;

  const { data: subscription } = await supabase
    .from('polar_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  res.json({ success: true, subscription });
});

// Cancel subscription
router.post('/api/billing/polar/cancel', async (req, res) => {
  const userId = req.user.id;

  const { data: subscription } = await supabase
    .from('polar_subscriptions')
    .select('polar_subscription_id')
    .eq('user_id', userId)
    .single();

  if (!subscription) {
    return res.status(404).json({ error: 'No active subscription' });
  }

  await polarService.cancelSubscription(subscription.polar_subscription_id);
  res.json({ success: true });
});
```

#### Criterios de Éxito

- ✅ `polarService.js` implementado con todos los métodos
- ✅ Webhooks procesando eventos correctamente
- ✅ Database migrations aplicadas
- ✅ Trial period logic funcionando
- ✅ Plan sync with Supabase operativo
- ✅ Integration tests passing (checkout, webhooks, cancellation)

#### Agentes

- **Backend Developer** - Lead (implementation)
- **Test Engineer** - Integration tests
- **Documentation Agent** - API docs

#### Tests

```javascript
// tests/integration/polar-integration.test.js
describe('Polar Payment Integration', () => {
  test('creates checkout session for Starter plan', async () => {
    const checkoutUrl = await polarService.createCheckoutSession(testUser.id, 'starter');
    expect(checkoutUrl).toMatch(/^https:\/\/checkout.polar.sh\//);
  });

  test('processes checkout.completed webhook', async () => {
    const event = {
      id: 'evt_test_123',
      type: 'checkout.completed',
      data: {
        subscription_id: 'sub_test_123',
        customer_id: 'cus_test_123',
        plan: 'starter',
        trial_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    };

    await polarWebhooks.handleEvent(event);

    const { data: subscription } = await supabase
      .from('polar_subscriptions')
      .select('*')
      .eq('polar_subscription_id', 'sub_test_123')
      .single();

    expect(subscription.plan).toBe('starter');
    expect(subscription.status).toBe('trial');
  });

  test('downgrades to free after trial expires', async () => {
    // Create trial subscription expiring today
    await supabase.from('polar_subscriptions').insert({
      user_id: testUser.id,
      polar_subscription_id: 'sub_trial_expired',
      polar_customer_id: 'cus_test',
      plan: 'starter',
      status: 'trial',
      trial_end_date: new Date(Date.now() - 1000), // 1 second ago
      current_period_start: new Date(),
      current_period_end: new Date()
    });

    // Run trial expiration job
    await runTrialExpirationJob();

    const { data: subscription } = await supabase
      .from('polar_subscriptions')
      .select('*')
      .eq('polar_subscription_id', 'sub_trial_expired')
      .single();

    expect(subscription.plan).toBe('free');
    expect(subscription.status).toBe('canceled');
  });
});
```

---

### FASE 3: Persona Service + Level Configuration (Día 3-4 - 8-12 horas)

**Objetivo:** Implementar servicios para gestión de persona y configuración de niveles

#### Tareas

##### 3.1 Persona Service Implementation

1. **Service Creation**
   - Crear `src/services/personaService.js`
   - Methods:
     - `getPersona(userId)` → decrypt and return persona fields
     - `updateIdentity(userId, text, plan)` → encrypt, generate embedding, update
     - `updateIntolerance(userId, text, plan)` → encrypt, generate embedding, update
     - `updateTolerance(userId, text, plan)` → encrypt, generate embedding, update (Pro+ only)
     - `validatePersonaField(text, fieldType)` → validate length, content
     - `checkPlanAccess(plan, fieldType)` → enforce plan restrictions

2. **Encryption Integration**
   - Use `crypto.createCipheriv('aes-256-gcm')` for encryption
   - Store key in `process.env.PERSONA_ENCRYPTION_KEY`
   - Format: `iv + tag + ciphertext` → Base64

3. **OpenAI Embeddings Integration**
   - Use `text-embedding-3-small` model (1536 dimensions)
   - Generate embeddings after successful update
   - Background job to avoid blocking user response
   - Retry logic: 3 attempts with exponential backoff

4. **Plan-Based Restrictions**
   - Free: NO access to any persona fields
   - Starter: Access to "lo que me define" + "lo que no tolero" (2 fields)
   - Pro: Access to all 3 fields
   - Plus: Access to all 3 fields + custom style prompt (admin-configured)

5. **API Endpoints**
   ```javascript
   // Get persona
   router.get('/api/persona', async (req, res) => {
     const userId = req.user.id;
     const persona = await personaService.getPersona(userId);
     res.json({ success: true, persona });
   });

   // Update identity
   router.put('/api/persona/identity', async (req, res) => {
     const userId = req.user.id;
     const { text } = req.body;
     const { data: user } = await supabase.from('users').select('plan').eq('id', userId).single();

     // Check plan access
     if (!personaService.checkPlanAccess(user.plan, 'identity')) {
       return res.status(403).json({ error: 'Plan upgrade required' });
     }

     await personaService.updateIdentity(userId, text, user.plan);
     res.json({ success: true });
   });

   // Update intolerance
   router.put('/api/persona/intolerance', async (req, res) => {
     const userId = req.user.id;
     const { text } = req.body;
     const { data: user } = await supabase.from('users').select('plan').eq('id', userId).single();

     if (!personaService.checkPlanAccess(user.plan, 'intolerance')) {
       return res.status(403).json({ error: 'Plan upgrade required' });
     }

     await personaService.updateIntolerance(userId, text, user.plan);
     res.json({ success: true });
   });

   // Update tolerance (Pro+ only)
   router.put('/api/persona/tolerance', async (req, res) => {
     const userId = req.user.id;
     const { text } = req.body;
     const { data: user } = await supabase.from('users').select('plan').eq('id', userId).single();

     if (!personaService.checkPlanAccess(user.plan, 'tolerance')) {
       return res.status(403).json({ error: 'Pro plan or higher required' });
     }

     await personaService.updateTolerance(userId, text, user.plan);
     res.json({ success: true });
   });
   ```

##### 3.2 Level Configuration Service

1. **Service Creation**
   - Crear `src/services/levelConfigService.js`
   - Methods:
     - `getRoastLevel(userId)` → get current roast intensity (1-5)
     - `setRoastLevel(userId, level, plan)` → update roast intensity
     - `getShieldLevel(userId)` → get current shield sensitivity
     - `setShieldLevel(userId, level, plan)` → update shield sensitivity
     - `validateLevel(level, type, plan)` → validate level within plan limits

2. **Database Schema**
   - Crear `database/migrations/add_roast_config.sql`
   - Table: `user_roast_config`
     ```sql
     CREATE TABLE user_roast_config (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
       roast_level INTEGER NOT NULL DEFAULT 3, -- 1=suave, 2=neutral, 3=moderado, 4=agresivo, 5=caústico
       shield_level VARCHAR(20) NOT NULL DEFAULT 'balanceado', -- tolerante, balanceado, estricto
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW(),
       CONSTRAINT user_roast_config_roast_level_check CHECK (roast_level BETWEEN 1 AND 5),
       CONSTRAINT user_roast_config_shield_level_check CHECK (shield_level IN ('tolerante', 'balanceado', 'estricto'))
     );
     CREATE INDEX idx_user_roast_config_user ON user_roast_config(user_id);
     ```

3. **Level Definitions**

   **Roast Levels (1-5):**
   - Level 1 (Suave): Ironía sutil, humor ligero, sin palabrotas
   - Level 2 (Neutral): Sarcasmo moderado, humor balanceado
   - Level 3 (Moderado): Sarcasmo directo, algo picante (DEFAULT)
   - Level 4 (Agresivo): Muy directo, sin filtros, palabrotas permitidas
   - Level 5 (Caústico): Máximo nivel, humor negro, extremadamente directo

   **Shield Levels (3 opciones):**
   - Tolerante: Solo bloquea críticos (τ_shield = 0.85)
   - Balanceado: Bloquea altos y críticos (τ_shield = 0.70) (DEFAULT)
   - Estricto: Bloquea medios+ (τ_shield = 0.50)

4. **Plan-Based Restrictions**
   - Free: Fixed levels (roast=3, shield=balanceado)
   - Starter: Choose from 3 levels (1, 3, 5)
   - Pro: Choose from 5 levels (1, 2, 3, 4, 5)
   - Plus: Full customization + custom thresholds

5. **API Endpoints**
   ```javascript
   // Get config
   router.get('/api/levels', async (req, res) => {
     const userId = req.user.id;
     const config = await levelConfigService.getConfig(userId);
     res.json({ success: true, config });
   });

   // Set roast level
   router.put('/api/levels/roast', async (req, res) => {
     const userId = req.user.id;
     const { level } = req.body; // 1-5
     const { data: user } = await supabase.from('users').select('plan').eq('id', userId).single();

     if (!levelConfigService.validateLevel(level, 'roast', user.plan)) {
       return res.status(403).json({ error: 'Level not available in your plan' });
     }

     await levelConfigService.setRoastLevel(userId, level, user.plan);
     res.json({ success: true });
   });

   // Set shield level
   router.put('/api/levels/shield', async (req, res) => {
     const userId = req.user.id;
     const { level } = req.body; // 'tolerante', 'balanceado', 'estricto'
     const { data: user } = await supabase.from('users').select('plan').eq('id', userId).single();

     if (!levelConfigService.validateLevel(level, 'shield', user.plan)) {
       return res.status(403).json({ error: 'Level not available in your plan' });
     }

     await levelConfigService.setShieldLevel(userId, level, user.plan);
     res.json({ success: true });
   });
   ```

6. **Integration with Roast Engine**
   - Update `src/services/roastEngine.js` to read `user_roast_config`
   - Map roast_level to prompt parameters:
     ```javascript
     const levelMapping = {
       1: { intensity: 'suave', profanity: false, temperature: 0.6 },
       2: { intensity: 'neutral', profanity: false, temperature: 0.7 },
       3: { intensity: 'moderado', profanity: true, temperature: 0.8 },
       4: { intensity: 'agresivo', profanity: true, temperature: 0.9 },
       5: { intensity: 'caústico', profanity: true, temperature: 1.0 }
     };
     ```
   - Map shield_level to τ_shield threshold in Shield service

#### Criterios de Éxito

- ✅ `personaService.js` implementado con encryption + embeddings
- ✅ `levelConfigService.js` implementado con validations
- ✅ Database migrations aplicadas
- ✅ API endpoints funcionando
- ✅ Plan-based restrictions enforced
- ✅ Integration with roast engine operational
- ✅ Unit tests passing (encryption, validation, plan access)

#### Agentes

- **Backend Developer** - Lead (implementation)
- **Test Engineer** - Unit + integration tests
- **UX Designer** - UI mockups for persona setup wizard
- **Documentation Agent** - API docs + user guide

#### Tests

```javascript
// tests/unit/services/personaService.test.js
describe('Persona Service', () => {
  test('encrypts and decrypts identity correctly', async () => {
    const original = 'Soy desarrollador sarcástico';
    await personaService.updateIdentity(testUser.id, original, 'starter');

    const persona = await personaService.getPersona(testUser.id);
    expect(persona.identity).toBe(original);
  });

  test('generates embeddings for identity', async () => {
    await personaService.updateIdentity(testUser.id, 'Test identity', 'starter');

    const { data: user } = await supabase
      .from('users')
      .select('lo_que_me_define_embedding')
      .eq('id', testUser.id)
      .single();

    expect(user.lo_que_me_define_embedding).toBeDefined();
    expect(user.lo_que_me_define_embedding).toHaveLength(1536);
  });

  test('enforces plan restrictions for tolerance field', async () => {
    await expect(
      personaService.updateTolerance(testUser.id, 'Test tolerance', 'starter')
    ).rejects.toThrow('Pro plan required');
  });
});

// tests/unit/services/levelConfigService.test.js
describe('Level Config Service', () => {
  test('validates roast level within plan limits', () => {
    expect(levelConfigService.validateLevel(1, 'roast', 'free')).toBe(false); // Free can't change
    expect(levelConfigService.validateLevel(3, 'roast', 'starter')).toBe(true); // Starter can use 1,3,5
    expect(levelConfigService.validateLevel(2, 'roast', 'starter')).toBe(false); // Level 2 not available in Starter
    expect(levelConfigService.validateLevel(4, 'roast', 'pro')).toBe(true); // Pro has all levels
  });

  test('sets roast level and updates database', async () => {
    await levelConfigService.setRoastLevel(testUser.id, 5, 'pro');

    const config = await levelConfigService.getConfig(testUser.id);
    expect(config.roast_level).toBe(5);
  });
});
```

---

### FASE 4: Roasting Control + Estado Global (Día 4-5 - 6-8 horas)

**Objetivo:** Implementar control de roasting y documentar estado global

#### Tareas

##### 4.1 Roasting Control Endpoint

1. **API Implementation**
   ```javascript
   // Enable/disable roasting
   router.post('/api/roasting/toggle', async (req, res) => {
     const userId = req.user.id;
     const { enabled } = req.body; // true/false

     // Update user settings
     const { data: user, error } = await supabase
       .from('users')
       .update({ roasting_enabled: enabled })
       .eq('id', userId)
       .select()
       .single();

     if (error) {
       return res.status(500).json({ error: 'Failed to update setting' });
     }

     // Notify workers of state change
     await workerNotificationService.notifyRoastingToggle(userId, enabled);

     res.json({ success: true, roasting_enabled: enabled });
   });

   // Get roasting status
   router.get('/api/roasting/status', async (req, res) => {
     const userId = req.user.id;

     const { data: user } = await supabase
       .from('users')
       .select('roasting_enabled')
       .eq('id', userId)
       .single();

     res.json({ success: true, roasting_enabled: user.roasting_enabled });
   });
   ```

2. **Worker Notification Service**
   - Update `src/services/workerNotificationService.js`
   - Method: `notifyRoastingToggle(userId, enabled)`
   - Mechanism: Publish message to Redis channel `roasting:toggle:${userId}`
   - Workers subscribe to channel and update in-memory cache

3. **State Propagation Flow**
   ```
   UI Toggle (Enable/Disable)
       ↓
   POST /api/roasting/toggle
       ↓
   Update users.roasting_enabled (Supabase)
       ↓
   Publish to Redis (roasting:toggle:userId)
       ↓
   Workers receive notification
       ↓
   Workers update local cache
       ↓
   GenerateReplyWorker checks cache before processing
   ```

4. **Database Schema**
   - Add column to `users` table (migration):
     ```sql
     ALTER TABLE users ADD COLUMN roasting_enabled BOOLEAN DEFAULT TRUE;
     CREATE INDEX idx_users_roasting_enabled ON users(id, roasting_enabled) WHERE roasting_enabled = TRUE;
     ```

##### 4.2 Global State Documentation

1. **State Schema Definition**
   - Create `docs/flows/global-state.md`
   - Define complete state tree:
     ```typescript
     interface GlobalUserState {
       // Authentication
       auth: {
         userId: string;
         token: string;
         refreshToken: string;
         expiresAt: Date;
       };

       // Subscription
       subscription: {
         plan: 'free' | 'starter' | 'pro' | 'plus';
         status: 'active' | 'trial' | 'past_due' | 'canceled';
         trial_days_remaining: number | null;
         current_period_end: Date;
       };

       // Persona
       persona: {
         identity: string | null;
         intolerance: string | null;
         tolerance: string | null; // Pro+ only
       };

       // Roasting
       roasting: {
         enabled: boolean;
         roast_level: 1 | 2 | 3 | 4 | 5;
         shield_level: 'tolerante' | 'balanceado' | 'estricto';
       };

       // Usage
       usage: {
         monthly_roasts_used: number;
         monthly_roasts_limit: number;
         remaining_roasts: number;
       };
     }
     ```

2. **Synchronization Mechanisms**
   - **Frontend State Management:** Use React Context or Zustand
   - **Backend State:** Database as single source of truth
   - **Real-time Updates:** WebSockets (Socket.IO) for critical changes
   - **Polling Fallback:** Every 30 seconds for non-WebSocket clients

3. **Conflict Resolution Strategy**
   - **Last Write Wins (LWW):** For user preferences (roast_level, shield_level)
   - **Optimistic Locking:** For subscription changes (version field)
   - **Event Sourcing:** For usage tracking (append-only log)
   - **Manual Resolution:** For critical conflicts (show UI prompt)

4. **State Persistence**
   - **localStorage:** Auth tokens, non-sensitive preferences
   - **sessionStorage:** Temporary UI state (wizard progress)
   - **Database:** All sensitive data (persona, subscription)
   - **Redis Cache:** Frequently accessed data (plan limits, feature flags)

#### Criterios de Éxito

- ✅ Roasting toggle endpoint funcionando
- ✅ State propagation to workers operational
- ✅ Global state schema documented
- ✅ Synchronization mechanisms defined
- ✅ Integration tests passing (toggle, state sync)

#### Agentes

- **Backend Developer** - Lead (implementation)
- **Front-end Dev** - State management UI
- **Documentation Agent** - State schema docs

#### Tests

```javascript
// tests/integration/roasting-control.test.js
describe('Roasting Control', () => {
  test('disables roasting for user', async () => {
    const response = await request(app)
      .post('/api/roasting/toggle')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ enabled: false });

    expect(response.status).toBe(200);
    expect(response.body.roasting_enabled).toBe(false);

    // Verify database update
    const { data: user } = await supabase
      .from('users')
      .select('roasting_enabled')
      .eq('id', testUser.id)
      .single();

    expect(user.roasting_enabled).toBe(false);
  });

  test('notifies workers when roasting disabled', async () => {
    const notifySpy = jest.spyOn(workerNotificationService, 'notifyRoastingToggle');

    await request(app)
      .post('/api/roasting/toggle')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ enabled: false });

    expect(notifySpy).toHaveBeenCalledWith(testUser.id, false);
  });

  test('GenerateReplyWorker skips disabled users', async () => {
    // Disable roasting
    await supabase
      .from('users')
      .update({ roasting_enabled: false })
      .eq('id', testUser.id);

    // Create job for disabled user
    const job = await queueService.add('generate_reply', {
      userId: testUser.id,
      commentId: testComment.id
    });

    // Process job
    const worker = new GenerateReplyWorker();
    await worker.processJob(job);

    // Verify no roast generated
    const { data: roasts } = await supabase
      .from('responses')
      .select('*')
      .eq('comment_id', testComment.id);

    expect(roasts).toHaveLength(0);
  });
});
```

---

### FASE 5: Testing & Validation (Día 5 - 4-6 horas)

**Objetivo:** Ejecutar tests completos y validación GDD

#### Tareas

1. **Unit Tests**
   - `tests/unit/services/polarService.test.js` (Polar API calls)
   - `tests/unit/services/personaService.test.js` (Encryption, embeddings)
   - `tests/unit/services/levelConfigService.test.js` (Validation, plan access)
   - `tests/unit/webhooks/polarWebhooks.test.js` (Event handling)

2. **Integration Tests**
   - `tests/integration/polar-integration.test.js` (Checkout, webhooks, sync)
   - `tests/integration/persona-integration.test.js` (Setup wizard, embeddings)
   - `tests/integration/roasting-control.test.js` (Toggle, worker sync)
   - `tests/integration/level-config-integration.test.js` (Level changes, roast engine)

3. **E2E Tests (Playwright)**
   - Login flow (session management, token refresh)
   - Payment flow (Polar checkout, subscription activation)
   - Persona setup wizard (3-step form, validation)
   - Roasting control (toggle, real-time update)
   - Level configuration (slider UI, immediate apply)

4. **GDD Validation**
   - Run `node scripts/validate-gdd-runtime.js --full`
   - Update coverage in affected nodes:
     - `docs/nodes/billing.md` → Update with Polar integration
     - `docs/nodes/persona.md` → Update with service endpoints
     - `docs/nodes/roast.md` → Update with control endpoints
   - Generate health report: `node scripts/score-gdd-health.js --ci`
   - Target health score: ≥87 (current threshold)

5. **Guardian Scan**
   - Run `node scripts/guardian-gdd.js --full`
   - Verify no CRITICAL violations (pricing, auth_policies)
   - Document SENSITIVE changes (ai_models, public_contracts)
   - Generate audit log case file

#### Criterios de Éxito

- ✅ All unit tests passing (coverage ≥80%)
- ✅ All integration tests passing
- ✅ E2E tests passing in Playwright
- ✅ GDD health score ≥87
- ✅ Guardian scan SAFE or SENSITIVE (no CRITICAL)
- ✅ All affected nodes updated with new coverage

#### Agentes

- **Test Engineer** - Lead (execute all tests)
- **Orchestrator** - Coordinate GDD validation
- **Documentation Agent** - Update node coverage

---

## Dependencias de Archivos

### Archivos a Crear

#### Documentación (Fase 1)
1. `docs/flows/login-registration.md` - Login/registration flow diagram + docs
2. `docs/flows/payment-polar.md` - Polar integration flow diagram + docs
3. `docs/flows/persona-setup.md` - Persona setup wizard flow diagram + docs
4. `docs/flows/roasting-control.md` - Roasting enable/disable flow diagram + docs
5. `docs/flows/level-configuration.md` - Level config flow diagram + docs
6. `docs/flows/global-state.md` - Global state schema + sync mechanisms

#### Services (Fase 2-3)
7. `src/services/polarService.js` - Polar API client
8. `src/webhooks/polarWebhooks.js` - Polar webhook handlers
9. `src/services/personaService.js` - Persona management (encryption, embeddings)
10. `src/services/levelConfigService.js` - Level configuration management

#### Database Migrations (Fase 2-3)
11. `database/migrations/add_polar_subscriptions.sql` - Polar subscription tables
12. `database/migrations/add_roast_config.sql` - User roast config table

#### Tests (Fase 5)
13. `tests/unit/services/polarService.test.js` - Unit tests for Polar service
14. `tests/unit/services/personaService.test.js` - Unit tests for Persona service
15. `tests/unit/services/levelConfigService.test.js` - Unit tests for Level Config service
16. `tests/integration/polar-integration.test.js` - Integration tests for Polar flow
17. `tests/integration/persona-integration.test.js` - Integration tests for Persona flow
18. `tests/integration/roasting-control.test.js` - Integration tests for Roasting control
19. `tests/integration/level-config-integration.test.js` - Integration tests for Level config
20. `tests/e2e/flows/login-registration.spec.js` - E2E test for login/registration
21. `tests/e2e/flows/payment-polar.spec.js` - E2E test for Polar checkout
22. `tests/e2e/flows/persona-setup.spec.js` - E2E test for Persona wizard
23. `tests/e2e/flows/roasting-control.spec.js` - E2E test for Roasting toggle
24. `tests/e2e/flows/level-configuration.spec.js` - E2E test for Level config UI

### Archivos a Modificar

#### Nodos GDD (Fase 5)
1. `docs/nodes/billing.md` - Update with Polar integration details
2. `docs/nodes/persona.md` - Update with service endpoints + API
3. `docs/nodes/roast.md` - Update with control endpoints + level config
4. `docs/nodes/multi-tenant.md` - Update with session management docs

#### Services (Fase 2-4)
5. `src/services/costControl.js` - Connect to Polar subscription state
6. `src/services/roastEngine.js` - Integrate level config
7. `src/services/workerNotificationService.js` - Add roasting toggle notification

#### API Routes (Fase 2-4)
8. `src/index.js` - Add new endpoints for Polar, Persona, Levels, Roasting Control

#### Configuration (Fase 2)
9. `.env.example` - Add Polar API keys + Persona encryption key

---

## Validación Pre-Merge

### Checklist Obligatorio

- [ ] **Pre-Flight Checklist** ejecutado (`docs/QUALITY-STANDARDS.md`)
- [ ] **Tests pasando al 100%** (unit + integration + E2E)
- [ ] **GDD health score ≥87** (threshold temporal hasta 2025-10-31)
- [ ] **Guardian scan SAFE o SENSITIVE** (no CRITICAL violations)
- [ ] **CodeRabbit review: 0 comentarios** (CERO, no "casi cero")
- [ ] **Documentación actualizada** (nodos GDD + API docs)
- [ ] **Sin conflictos con main** (rebase si necesario)
- [ ] **CI/CD passing** (todos los jobs verdes en GitHub Actions)

---

## Riesgos y Mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Polar API breaking changes | Baja | Alto | Pin API version, monitor changelog |
| Embedding generation failures | Media | Medio | Retry logic + fallback (skip embeddings) |
| State sync conflicts | Media | Medio | Implement conflict resolution UI |
| Performance degradation (encryption) | Baja | Medio | Cache decrypted values, use worker threads |
| Plan restriction bypasses | Baja | Alto | Server-side validation on ALL endpoints |
| Trial period edge cases | Media | Bajo | Comprehensive E2E tests for trial expiration |

---

## Agentes Asignados

### Por Fase

**Fase 1 (Documentation):**
- **Documentation Agent** - Lead (crear diagramas + contenido)
- **Orchestrator** - Coordinación y validación

**Fase 2 (Polar Integration):**
- **Backend Developer** - Lead (implementation)
- **Test Engineer** - Integration tests
- **Documentation Agent** - API docs

**Fase 3 (Persona + Levels):**
- **Backend Developer** - Lead (implementation)
- **Test Engineer** - Unit + integration tests
- **UX Designer** - UI mockups
- **Documentation Agent** - API docs + user guide

**Fase 4 (Control + State):**
- **Backend Developer** - Lead (implementation)
- **Front-end Dev** - State management UI
- **Documentation Agent** - State schema docs

**Fase 5 (Testing + Validation):**
- **Test Engineer** - Lead (execute all tests)
- **Orchestrator** - Coordinate GDD validation
- **Documentation Agent** - Update node coverage

---

## Criterios de Éxito Global

### Must Have
- ✅ All 6 flows documented with diagrams
- ✅ Polar integration functional (checkout, webhooks, sync)
- ✅ Persona service operational (3 fields + encryption + embeddings)
- ✅ Level config endpoints working (roast + shield levels)
- ✅ Roasting control toggle operational
- ✅ Global state schema defined
- ✅ All integration tests passing
- ✅ GDD nodes updated
- ✅ GDD health ≥87
- ✅ Guardian scan SAFE/SENSITIVE

### Should Have
- ✅ E2E tests for critical flows (login, payment, persona)
- ✅ Conflict resolution strategy documented
- ✅ Plan-based restrictions enforced
- ✅ UI mockups for key flows

### Nice to Have
- ⏳ Real-time state sync with WebSockets
- ⏳ Performance benchmarks for encryption/embeddings
- ⏳ User journey analytics hooks
- ⏳ A/B testing framework for flow optimization

---

## Timeline Estimado

| Fase | Duración | Bloqueante | Dependencias |
|------|----------|------------|--------------|
| Fase 1: Documentation | 4-6 horas | No | None |
| Fase 2: Polar Integration | 8-12 horas | **SÍ (P0)** | Fase 1 completa |
| Fase 3: Persona + Levels | 8-12 horas | No | Fase 1 completa |
| Fase 4: Control + State | 6-8 horas | No | Fase 2-3 completas |
| Fase 5: Testing + Validation | 4-6 horas | **SÍ (Quality Gate)** | Todas las fases completas |

**Total:** 30-44 horas (~3.75-5.5 días de trabajo efectivo)

---

## Notas Adicionales

### Lecciones de CodeRabbit Aplicadas

Antes de implementar, consultar `docs/patterns/coderabbit-lessons.md`:

1. **ESLint & Code Style**
   - ✅ Usar semicolons siempre
   - ✅ Preferir `const` sobre `let`
   - ✅ Usar `logger.js` en lugar de `console.log`

2. **Testing Patterns**
   - ✅ Write tests BEFORE implementation (TDD)
   - ✅ Cover happy path + error cases + edge cases
   - ✅ Minimum 3 test cases per function

3. **GDD Documentation**
   - ✅ NEVER modify `**Coverage:**` manually
   - ✅ Always use `**Coverage Source:** auto`
   - ✅ Update "Agentes Relevantes" when invoking agent

4. **Security**
   - ✅ NO hardcoded credentials
   - ✅ NO env var examples in public docs
   - ✅ Validate env vars at startup

5. **Error Handling**
   - ✅ Specific error codes (E_TIMEOUT, E_VALIDATION, etc.)
   - ✅ Retry logic for transient errors
   - ✅ Log errors with context

### Integration Workflow Checklist

Antes de implementar platform integrations (si aplica):

1. ✅ Read `docs/INTEGRATIONS.md` FIRST
2. ✅ Verify naming conventions (Service file, class name, env vars)
3. ✅ Check for existing implementation (grep codebase)
4. ✅ Follow Phase 2 checklist (implementation)
5. ✅ Update documentation (INTEGRATIONS.md, nodes/social-platforms.md)

---

**Plan Created:** 2025-10-19
**Author:** Orchestrator Agent
**Assessment Reference:** `docs/assessment/flows-review.md`
**GDD Nodes:** billing, persona, roast, guardian, multi-tenant
