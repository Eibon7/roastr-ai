# Roastr v2 — SSOT (Single Source of Truth)

_Versión inicial — derivada del Spec v2. Cualquier cambio de comportamiento debe pasar por este archivo._

> ⚠️ Regla de oro  
> Si este archivo y el código / GDD discrepan, **este archivo gana**.  
> Si algo no está definido aquí, **no se inventa**: se marca como `TBD` y se abre tarea.
>
> 🚨 **OBLIGATORIO**: Si detectas cualquier discrepancia entre este SSOT y el código/GDD existente,  
> **DEBES comunicarlo INMEDIATAMENTE** para aclarar la situación antes de proceder.

---

## 0. Alcance del SSOT

Este documento define solo:

- Identificadores oficiales (plan IDs, feature flags, tipos, estados, entidades de dominio).
- Reglas de comportamiento que **no se pueden inventar** ni alterar sin actualizar este SSOT.
- Límites funcionales (p.ej. "Starter tiene 1 cuenta por red"), aunque algunos valores numéricos detallados (p.ej. precio exacto) puedan venir de Polar o de otras tablas.

**No contiene:**

- Prompts completos de IA.
- Copys de marketing.
- Textos legales extensos (se referencian por clave).
- Códigos de error exhaustivos.

---

## 1. Planes y Límites

### 1.1 IDs de plan válidos (v2)

```ts
type PlanId = 'starter' | 'pro' | 'plus';
```

No existen otros planes válidos en v2.  
Cualquier referencia a:

- `"free"`
- `"basic"`
- `"creator_plus"`

⇒ es legacy v1 y **no se puede usar en código nuevo**.

### 1.2 Trial por plan

| Plan    | trial_enabled | trial_days |
| ------- | ------------- | ---------: |
| starter | true          |         30 |
| pro     | true          |          7 |
| plus    | false         |          0 |

### 1.3 Límites mensuales funcionales por plan

> Los valores numéricos concretos pueden vivir en DB/config, pero los **ratios y capacidades relativas** son contractuales.

| Plan    | analysis_limit | roast_limit | accounts_per_platform | sponsors_allowed | tone_personal_allowed |
| ------- | -------------- | ----------- | --------------------- | ---------------- | --------------------- |
| starter | 1_000          | 5           | 1                     | false            | false                 |
| pro     | 10_000         | 1_000       | 2                     | false            | true                  |
| plus    | 100_000        | 5_000       | 2                     | true             | true                  |

### 1.4 Capacidades por plan (alto nivel)

- **Starter**
  - Shield básico (mismo motor, mismos thresholds; lo "básico" es marketing).
  - Tonos estándar: Flanders, Balanceado, Canalla.
  - Roastr Persona disponible.
  - Sin tono personal.
  - Sin sponsors.

- **Pro**
  - Shield completo (igual motor, puede tener más controles de UI).
  - Tonos estándar + tono personal (beta).
  - Multi-cuenta: hasta 2 cuentas por red.
  - Roastr Persona disponible.
  - Sin sponsors.

- **Plus**
  - Todo lo de Pro.
  - Sponsors protegidos.
  - (Opcional futuro) prioridad en colas de workers.

> 🔒 Cualquier código que añada capacidades según plan **debe usar estos flags y límites**, no lógicas inventadas.

---

## 2. Billing v2 — Polar

### 2.1 Proveedor

- v2: **Polar** es el único proveedor de billing.
- Stripe queda como **legacy v1**, sin uso en nuevos flujos.

### 2.2 Estados de suscripción

```ts
type SubscriptionState =
  | 'trialing'
  | 'expired_trial_pending_payment' // interno, se puede representar vía campos Polar
  | 'payment_retry'
  | 'active'
  | 'canceled_pending'
  | 'paused';
```

### 2.3 Reglas clave

1. **Trial**
   - Starter: 30 días.
   - Pro: 7 días.
   - Plus: sin trial.
   - Trial siempre exige método de pago válido.
   - Si el usuario cancela durante el trial:
     - El trial se corta **inmediatamente**.
     - Estado → `paused`.
     - Servicio cortado (sin Shield, sin Roasts, sin ingestión).
     - No hay cobro.

2. **Fin de trial**
   - Cobro OK → `active`.
   - Cobro falla → `payment_retry` hasta 5 días.
   - Tras recobro fallido → `paused`.

3. **Active**
   - Servicio completo según plan:
     - Shield ON.
     - Roasts ON (si hay créditos).
     - Ingestión ON (si hay análisis).
   - Cancelación por usuario → `canceled_pending`.
   - Upgrade (p.ej. a Plus) → `active` con nuevo ciclo / prorrateos según Polar.

4. **Canceled_pending**
   - Usuario ha cancelado, pero el ciclo ya está pagado.
   - Servicio se mantiene hasta `current_period_end`.
   - Al llegar la fecha → `paused`.

5. **Paused**
   - Servicio apagado:
     - Sin Shield.
     - Sin Roasts.
     - Sin ingestión.
     - Workers OFF para esa cuenta.
   - UI sigue accesible (billing, histórico, settings).
   - Reactivación:
     - Antes de fin de ciclo (si aplica) → `active` sin nuevo cobro.
     - Después → checkout nuevo + cobro → `active`.

### 2.4 Webhooks Polar (mapeo obligatorio)

```ts
type PolarWebhookEvent =
  | 'subscription_created'
  | 'subscription_active'
  | 'subscription_canceled'
  | 'subscription_updated'
  | 'invoice_payment_failed'
  | 'invoice_payment_succeeded';
```

- `subscription_created` → `trialing` o `active` (Plus).
- `subscription_active` → `active`.
- `subscription_canceled` → `canceled_pending`.
- `invoice_payment_failed` → `payment_retry`.
- `invoice_payment_succeeded` → `active`.
- `subscription_updated` → upgrade/downgrade (sin cambiar estado principal salvo reglas de arriba).

Todos los webhooks deben ser **idempotentes** y pasar por un **billingStateMachine(currentState, event)** puro.

### 2.5 Límites agotados

- `analysis_remaining = 0`:
  - Workers de ingestión OFF para esa cuenta.
  - No se procesa ningún comentario nuevo.
  - Shield OFF, Roasts OFF (porque no hay análisis).
  - UI:
    - Solo muestra **histórico** ya almacenado.
    - No aparecen comentarios nuevos desde redes.
    - Banner de "Has agotado los análisis".

- `roasts_remaining = 0`:
  - Shield sigue funcionando mientras queden análisis.
  - No se generan nuevos Roasts (ni auto-approve ni manual).
  - UI muestra "Límite de roasts alcanzado".

---

## 3. Feature Flags v2

### 3.1 Reglas generales

- Todos los flags dinámicos viven en: `admin_settings.feature_flags`.
- Ningún flag se hardcodea en frontend ni backend.
- Cada flag tiene:
  - `key`
  - `description`
  - `category`
  - `actors` (admin / user / account)
  - `type` (`boolean` | `percent` | `enum`)
  - `defaultValue`
- Cualquier cambio de flags debe registrarse en `admin_logs`.

### 3.2 Flags core permitidos

```ts
type FeatureFlagKey =
  // Auth endpoints control (ROA-406)
  | 'auth_enable_login'
  | 'auth_enable_register'
  | 'auth_enable_magic_link'
  | 'auth_enable_password_recovery'

  // Core producto
  | 'autopost_enabled'
  | 'manual_approval_enabled'
  | 'custom_prompt_enabled'
  | 'sponsor_feature_enabled'
  | 'enable_user_registration'  // DEPRECATED: Use auth_enable_register
  | 'original_tone_enabled'
  | 'nsfw_tone_enabled'

  // Shield / seguridad
  | 'kill_switch_autopost'
  | 'enable_shield'
  | 'enable_roast'
  
  // Ingestion
  | 'ingestion_enabled'

  // UX / UI
  | 'show_two_roast_variants'
  | 'show_transparency_disclaimer'

  // Despliegue / experimentales controlados
  | 'enable_style_validator'
  | 'enable_advanced_tones'
  | 'enable_beta_sponsor_ui';
```

> ❌ Cualquier flag fuera de esta lista se considera **no autorizado**  
> y debe tratarse como bug o requerir actualización previa del SSOT.

### 3.3 Semántica breve de cada flag

**Auth Endpoint Control (ROA-406):**

- `auth_enable_login` (admin):
  - Habilita el endpoint `POST /api/v2/auth/login` (email + password).
  - **Default:** `false` (fail-closed por seguridad)
  - **Ubicación:** `feature_flags.auth_enable_login`
  - **NO tiene fallback** a env vars (SSOT única fuente de verdad)

- `auth_enable_register` (admin):
  - Habilita el endpoint `POST /api/v2/auth/register` (nuevo registro).
  - **Default:** `false` (fail-closed por seguridad)
  - **Ubicación:** `feature_flags.auth_enable_register`
  - **NO tiene fallback** a env vars

- `auth_enable_magic_link` (admin):
  - Habilita el endpoint `POST /api/v2/auth/magic-link` (passwordless).
  - **Default:** `false` (fail-closed por seguridad)
  - **Ubicación:** `feature_flags.auth_enable_magic_link`
  - **NO tiene fallback** a env vars

- `auth_enable_password_recovery` (admin):
  - Habilita el endpoint `POST /api/v2/auth/password-recovery` (reset password).
  - **Default:** `false` (fail-closed por seguridad)
  - **Ubicación:** `feature_flags.auth_enable_password_recovery`
  - **NO tiene fallback** a env vars

**Core Producto:**

- `autopost_enabled` (user/account):
  - Permite auto-approve de roasts.
- `manual_approval_enabled` (user/account):
  - Cuando está ON, los roasts requieren aprobación manual.
- `custom_prompt_enabled` (admin, Plus):
  - Habilita UI de prompt personalizado (post-MVP, no implementar sin tarea).
- `sponsor_feature_enabled` (admin):
  - Habilita módulo de sponsors (solo Plus).
- `enable_user_registration` (admin):
  - **DEPRECATED:** Usar `auth_enable_register` en su lugar.
  - Habilita el endpoint de registro de usuarios (email + password) en Auth v2.
- `original_tone_enabled` (admin):
  - Habilita tono personal (Pro/Plus).
- `nsfw_tone_enabled` (admin):
  - Solo futuro con modelo dedicado, no usar en v2.

**Shield / Seguridad:**

- `kill_switch_autopost` (admin):
  - Apaga todos los autopost, aunque `autopost_enabled` esté ON.
- `enable_shield` (user/account):
  - Enciende/apaga Shield para la cuenta.
- `enable_roast` (user/account):
  - Permite desactivar Roasts y usar solo Shield.

**Ingestion:**

- `ingestion_enabled` (admin/account):
  - Habilita/deshabilita la ingestion de comentarios desde plataformas.
  - Cuando está OFF, el sistema no procesa nuevos comentarios.
  - No afecta histórico ni funcionalidad existente.

**UX / UI:**

- `show_two_roast_variants` (admin):
  - ON → 2 variantes de roast.
  - OFF → 1 variante.
- `show_transparency_disclaimer` (admin):
  - Controla copia de transparencia IA, pero **no puede desactivar** la señalización legal obligatoria en UE para autopost.

**Despliegue / Experimentales:**

- `enable_style_validator` (admin):
  - Activa validador de estilo.
- `enable_advanced_tones` (admin):
  - Reserva para extensiones futuras de tonos.
- `enable_beta_sponsor_ui` (admin):
  - Habilita versiones beta de UI de sponsors.

---

## 4. Gatekeeper (Seguridad / Abuso)

### 12.1 Propósito

Gatekeeper es la primera línea de defensa contra comentarios maliciosos e intentos de prompt injection. Clasifica comentarios y detecta intentos de manipulación antes de que lleguen a los modelos de IA.

### 12.2 Configuración

La configuración de Gatekeeper vive en `admin_settings.gatekeeper.*` (vía SettingsLoader v2).

**Estructura:**

```ts
type GatekeeperConfig = {
  mode: 'multiplicative' | 'additive';
  thresholds: {
    suspicious: number;      // 0.0 - 1.0, default 0.5
    highConfidence: number;   // 0.0 - 1.0, default 0.9
    maxScore: number;         // 0.0 - 1.0, default 1.0
  };
  heuristics: {
    multipleNewlines: number;    // 0.0 - 1.0, default 0.3
    codeBlocks: number;          // 0.0 - 1.0, default 0.4
    unusualLength: number;       // 0.0 - 1.0, default 0.2
    repeatedPhrases: number;     // 0.0 - 1.0, default 0.3
  };
  heuristicsConfig: {
    newlineThreshold: number;           // default 3
    unusualLengthThreshold: number;     // default 1000
    repeatedPhraseCount: number;        // default 2
  };
  patternWeights: {
    instruction_override: number;   // default 1.0
    prompt_extraction: number;      // default 0.9
    role_manipulation: number;      // default 0.9
    jailbreak: number;              // default 1.0
    output_control: number;         // default 0.7
    hidden_instruction: number;     // default 0.7
    priority_override: number;       // default 0.9
    encoding_trick: number;          // default 0.7
  };
};
```

### 12.3 Modos de Operación

- **`multiplicative`** (default): Los pesos se multiplican para calcular score final.
- **`additive`**: Los pesos se suman para calcular score final.

### 12.4 Categorías de Detección

Gatekeeper detecta los siguientes tipos de ataques:

1. **`instruction_override`**: Intentos de ignorar instrucciones del sistema.
2. **`prompt_extraction`**: Intentos de extraer el prompt del sistema.
3. **`role_manipulation`**: Intentos de cambiar el rol del modelo.
4. **`jailbreak`**: Intentos de "romper" las restricciones del modelo.
5. **`output_control`**: Intentos de controlar la salida del modelo.
6. **`hidden_instruction`**: Instrucciones ocultas en el texto.
7. **`priority_override`**: Intentos de cambiar prioridades.
8. **`encoding_trick`**: Trucos de codificación para evadir detección.

### 12.5 Heurísticas

Gatekeeper aplica heurísticas adicionales:

- **`multipleNewlines`**: Detecta múltiples saltos de línea (posible código).
- **`codeBlocks`**: Detecta bloques de código.
- **`unusualLength`**: Detecta textos inusualmente largos o cortos.
- **`repeatedPhrases`**: Detecta frases repetidas (posible spam).

### 12.6 Fail-Safe

Si no hay configuración en `admin_settings`, Gatekeeper usa valores por defecto seguros (fail-closed para seguridad). Los valores por defecto están documentados en `src/services/gatekeeperService.js`.

### 12.7 Hot Reload

La configuración se carga dinámicamente desde SettingsLoader v2 (cache de 1 minuto). Los cambios en `admin_settings` se reflejan automáticamente sin reiniciar el servicio.

**Endpoints admin:**
- `GET /api/v2/admin/settings/gatekeeper` - Obtener configuración actual
- `PATCH /api/v2/admin/settings/gatekeeper` - Actualizar configuración

---

## 5. Shield & Motor de Análisis

### 12.1 Thresholds

Valores numéricos viven en DB/config, pero las **claves** son:

```ts
type Thresholds = {
  roastLower: number; // τ_roast_lower
  shield: number; // τ_shield
  critical: number; // τ_critical
};
```

### 12.2 Weights

```ts
type Weights = {
  lineaRoja: number; // default 1.15
  identidad: number; // default 1.10
  tolerancia: number; // default 0.95 (solo si score_base < τ_shield)

  strike1: number; // 1.10
  strike2: number; // 1.25
  critical: number; // 1.50
};
```

### 12.3 Reglas inmutables de Shield

- Identity attack o amenaza ⇒ **shield_critico** siempre, aunque el score numérico sea bajo.
- `insults_count >= N_DENSIDAD` ⇒ fuerza `shield_critico`.
- Reincidencia:
  - `strikeLevel >= 2` + insultos fuertes ⇒ preferencia por `shield_critico`.
- Tolerancias:
  - Solo pueden **reducir** el score cuando aún no estamos en zona de Shield.
  - Nunca pueden rebajar un caso crítico.

### 12.4 Salidas posibles del motor

```ts
type AnalysisDecision = 'publicar' | 'correctiva' | 'roast' | 'shield_moderado' | 'shield_critico';
```

### 12.5 Reglas de "Correctiva"

- Solo si:
  - `score_final < τ_shield`
  - `score_final >= τ_roast_lower`
  - `insultLevePeroArgumentoValido === true`
  - Sin strikes graves previos.
- Consume 1 crédito de roast.
- Usa tono correctivo institucional, no el tono de humor.

---

## 6. Roastr Persona

### 12.1 Estructura

```ts
type PersonaProfile = {
  identidades: string[]; // "Lo que me define"
  lineasRojas: string[]; // "Lo que no tolero"
  tolerancias: string[]; // "Lo que me da igual"
};
```

- Se almacena como **EncryptedPersona** (AES) en DB.
- Backend nunca usa el texto plano salvo en una capa controlada de normalización.

### 12.2 Reglas

- Persona se usa **solo** en Motor de Análisis (ajuste de score).
- **Nunca** se incluye en prompts de IA.
- No es visible en Panel Admin.
- Se borra inmediatamente al eliminar la cuenta.

---

## 7. Tonos & Roasting

### 12.1 Tonos oficiales

```ts
type RoastTone = 'flanders' | 'balanceado' | 'canalla' | 'personal';
```

- `flanders`: amable, diminutivos, humor blanco.
- `balanceado`: estándar, sarcasmo suave, elegante.
- `canalla`: humor afilado, ironía, sin degradación.
- `personal`: derivado rule-based del estilo del usuario (solo Pro/Plus, beta).

### 12.2 Tono NSFW

- Existe como concepto, pero:
  - `nsfw_tone_enabled` = false por defecto.
  - No se usa hasta tener modelo dedicado y legal aprobado.
  - No se debe integrar en UI ni código productivo v2.

### 12.3 Style Validator

- Rule-based, sin IA.
- No permite:
  - insultos.
  - ataques identitarios.
  - contenido explícito.
  - spam (200+ chars repetidos, 50+ emojis seguidos, 200+ "ja…", etc.).
  - textos vacíos.
  - textos que excedan los límites de plataforma.
  - falsos disclaimers de IA.
- Si bloquea un Roast:
  - El crédito ya está consumido.
  - Debe devolver error claro al usuario.
  - El contenido no se publica.

### 12.4 Disclaimers IA

- Se aplican **solo** cuando:
  - `autoApprove === true`
  - y la región/entorno legal lo exige (UE, etc.).
- Cuando el usuario aprueba manualmente, **no se añade** disclaimer automático.

- Los disclaimers se eligen de un **pool configurable en SSOT**, por tono:

```ts
type DisclaimerPool = {
  tone: RoastTone | 'corrective';
  variants: string[]; // 3–5 por tono
};
```

- El contenido inicial del pool se define en un archivo dedicado: `docs/ssot/disclaimers.yaml`, y nunca se inventa on-the-fly en código.

---

## 8. Integraciones

### 12.1 Redes soportadas en v2 (MVP)

```ts
type SupportedPlatform = 'x' | 'youtube';
```

- X:
  - `twitter-api-v2`.
- YouTube:
  - `googleapis` / Comment API.

### 12.2 Redes planificadas (no implementadas en v2)

Existe intención de integrarlas en el futuro, pero:

- No se pueden considerar "legacy".
- No se pueden exponer en UI v2 ni en código productivo sin tarea explícita.

Lista de redes planificadas:

- instagram
- facebook
- discord
- twitch
- reddit
- tiktok
- bluesky

> Cualquier aparición de estas redes en código v2 debe marcarse como **TODO futuro**, no como legacy.

### 12.3 Otros servicios de terceros

- **Supabase**: DB + Auth + Storage.
- **Redis / Upstash**: colas, rate limiting.
- **OpenAI**: generación de Roasts, fallback de toxicidad si Perspective falla.
- **Google Perspective API**: toxicidad principal.
- **Polar**: billing v2.
- **Resend**: email transaccional v2.
- **SendGrid / Stripe / otras**: solo v1 (legacy), no usarse en nuevos flujos.

### 12.4 Rate Limiting de Autenticación (ROA-359)

**Configuración oficial de rate limits para endpoints de autenticación:**

```ts
type AuthRateLimitConfig = {
  password: {
    windowMs: 900000;      // 15 minutos
    maxAttempts: 5;
    blockDurationMs: 900000; // 15 minutos
  };
  magic_link: {
    windowMs: 3600000;     // 1 hora
    maxAttempts: 3;
    blockDurationMs: 3600000; // 1 hora
  };
  oauth: {
    windowMs: 900000;      // 15 minutos
    maxAttempts: 10;
    blockDurationMs: 900000; // 15 minutos
  };
  password_reset: {
    windowMs: 3600000;     // 1 hora
    maxAttempts: 3;
    blockDurationMs: 3600000; // 1 hora
  };
};
```

**Bloqueo progresivo (escalación):**

```ts
type ProgressiveBlockDurations = [
  900000,      // 15 minutos (1ra infracción)
  3600000,     // 1 hora (2da infracción)
  86400000,    // 24 horas (3ra infracción)
  null         // Permanente (4ta+ infracción, requiere intervención manual)
];
```

**Almacenamiento:**
- **Producción**: Redis/Upstash (preferido)
- **Fallback**: Memoria (solo desarrollo/testing)
- **Keys**: `auth:ratelimit:ip:${authType}:${ip}` y `auth:ratelimit:email:${authType}:${emailHash}`

**Feature Flags:**
- `ENABLE_AUTH_RATE_LIMIT_V2`: Habilita rate limiting v2 (reemplaza v1)
- `ENABLE_RATE_LIMIT`: Habilita rate limiting general (requerido para v2)

### 12.4.1 Auth Error Taxonomy (V2) — ROA-405

**Objetivo:** Contrato estable de errores de Auth para backend + frontend (sin PII, sin detalles internos).

**Tipo base (contrato / referencia):**

```ts
type AuthError = {
  slug: string; // estable (ej. AUTH_INVALID_CREDENTIALS)
  http_status: number;
  retryable: boolean;
  user_message_key: string; // i18n key (NO texto)
  category: 'auth' | 'authz' | 'session' | 'token' | 'account' | 'policy';
};
```

**Slugs soportados (MVP):**

- `AUTH_INVALID_CREDENTIALS`
- `AUTH_EMAIL_NOT_CONFIRMED`
- `AUTH_ACCOUNT_LOCKED`
- `AUTH_DISABLED`
- `AUTH_UNKNOWN` (fail-closed)
- `AUTHZ_INSUFFICIENT_PERMISSIONS`
- `AUTHZ_ROLE_NOT_ALLOWED`
- `AUTHZ_MAGIC_LINK_NOT_ALLOWED`
- `AUTHZ_ADMIN_REQUIRED`
- `SESSION_EXPIRED`
- `SESSION_INVALID`
- `SESSION_REVOKED`
- `TOKEN_EXPIRED`
- `TOKEN_INVALID`
- `TOKEN_MISSING`
- `TOKEN_REVOKED`
- `ACCOUNT_NOT_FOUND`
- `ACCOUNT_SUSPENDED`
- `ACCOUNT_BANNED`
- `ACCOUNT_DELETED`
- `ACCOUNT_EMAIL_ALREADY_EXISTS`
- `POLICY_RATE_LIMITED`
- `POLICY_BLOCKED`
- `POLICY_INVALID_REQUEST`
- `POLICY_NOT_FOUND`

**Contrato de API (error response):**

```json
{
  "success": false,
  "error": {
    "slug": "AUTH_INVALID_CREDENTIALS",
    "retryable": false
  },
  "request_id": "uuid"
}
```

### 12.4.2 Auth Analytics Event (V2) — auth_error_shown

**Event:** `auth_error_shown`  
**Trigger:** cuando un error de Auth se presenta al usuario (frontend).

**Properties:**
- `error_slug` (string)
- `category` (`auth` | `authz` | `session` | `token` | `account` | `policy`)
- `retryable` (boolean)
- `flow` (`login` | `register` | `recovery`)
- `provider` (`supabase`)
- `feature_flag_state` (obj / snapshot de flags relevantes)

### 12.6 Ingestion Rate Limits (ROA-388)

**Configuración oficial de rate limits para ingestion de comentarios:**

```ts
type IngestionRateLimitConfig = {
  global: {
    max: 1000;           // Max ingestions per hour globally
    windowMs: 3600000;   // 1 hour window
  };
  perUser: {
    max: 100;            // Max ingestions per hour per user
    windowMs: 3600000;   // 1 hour window
  };
  perAccount: {
    max: 50;             // Max ingestions per hour per account
    windowMs: 3600000;   // 1 hour window
  };
};
```

**Algoritmo:**
- Sliding window con Redis
- Fail-safe: Bloquea en errores de Redis (no permite bypass)
- Keys: `ingestion:global`, `ingestion:user:{userId}`, `ingestion:account:{accountId}:{platform}`

**Almacenamiento:**
- Redis/Upstash (sorted sets con timestamps)
- TTL automático según windowMs

### 12.5 Abuse Detection Thresholds (ROA-359)

**Configuración oficial de thresholds para detección de abuse patterns:**

```ts
type AbuseDetectionThresholds = {
  multi_ip: number;        // Número de IPs diferentes para mismo email (default: 3)
  multi_email: number;     // Número de emails diferentes para misma IP (default: 5)
  burst: number;           // Intentos en ventana corta (1 minuto) para trigger burst attack (default: 10)
  slow_attack: number;     // Intentos en ventana larga (1 hora) para trigger slow attack (default: 20)
};
```

**Valores por defecto (fallback si SSOT no disponible):**
- `multi_ip`: 3
- `multi_email`: 5
- `burst`: 10
- `slow_attack`: 20

**Almacenamiento:**
- Configuración cargada desde SSOT v2 via `settingsLoaderV2`
- Keys SSOT: `abuse_detection.thresholds.multi_ip`, `abuse_detection.thresholds.multi_email`, etc.
- Fallback seguro si SSOT no disponible

**Feature Flags:**
- `ENABLE_ABUSE_DETECTION`: Habilita detección de abuse patterns (requerido para thresholds)

---

## 9. Workers & Procesos asíncronos

### 12.1 Workers oficiales v2

```ts
type WorkerName =
  | 'FetchComments'
  | 'AnalyzeToxicity'
  | 'GenerateRoast'
  | 'GenerateCorrectiveReply'
  | 'ShieldAction'
  | 'SocialPosting'
  | 'BillingUpdate'
  | 'CursorReconciliation'
  | 'StrikeCleanup';
```

### 12.5 Workers auxiliares (internos)

Estos workers soportan funcionalidades internas y no forman parte del flujo core de roasting:

```ts
type AuxiliaryWorkerName =
  | 'AccountDeletion'      // GDPR: Eliminación de cuentas
  | 'AlertNotification'    // Observabilidad: Notificaciones de alertas
  | 'ExportCleanup'        // GDPR: Limpieza de exports
  | 'GDPRRetention'        // GDPR: Retención y purga de datos (90 días)
  | 'ModelAvailability';   // Infraestructura: Health check de modelos IA
```

**Reglas para workers auxiliares:**
- No consumen créditos de análisis ni roasts.
- Ejecutan en segundo plano con prioridad baja (priority: 5).
- Logs estructurados obligatorios (sin datos sensibles).
- Pueden ser deshabilitados individualmente sin afectar el flujo core.

### 12.2 Tenancy

- Todos los payloads deben incluir `userId` + `accountId`.
- Ningún worker puede tocar datos de otro usuario.

### 12.3 Retries y DLQ

- 5 intentos por job:
  - 1 normal + 3 con backoff creciente + 1 final.
- Si sigue fallando → DLQ.
- La DLQ debe registrar:
  - payload original (sin datos sensibles innecesarios).
  - nº de reintentos.
  - error final.
  - worker.

### 12.4 Logs mínimos por worker

```ts
{
  timestamp,
  worker_name,
  userId,
  accountId,
  platform,
  payload_hash,
  duration_ms,
  success: boolean,
  error_code?: string,
  retry_count: number,
  tokens_used?: number
}
```

---

## 10. GDPR, Retención y Datos

### 12.1 Retención

- Usuarios eliminados → retención máx. 90 días → purga total.
- Ofensores / reincidencia → solo últimos 90 días.
- Logs de motor → 90 días.
- Roastr Persona → borrado inmediato al eliminar cuenta.

### 12.2 Datos que **sí** guardamos

- Datos de cuenta:
  - email, user_id, idioma, plan, estado.
  - cuentas conectadas (X/YouTube).
  - configuraciones por cuenta (auto-approve, tono, shield aggressiveness).
- Persona cifrada.
- Logs mínimos (sin texto crudo):
  - toxicidad numérica.
  - acción tomada.
  - timestamp.
  - tipo de acción del Shield.
- Roasts publicados (solo si el usuario los publica).

### 12.3 Datos que **no** guardamos

- Texto crudo de comentarios interceptados por Shield.
- Imágenes, vídeos, DMs.
- Historial completo de ediciones del usuario.
- Texto completo de prompts a modelos, fuera de lo estrictamente necesario para depuración (y anonimizados cuando proceda).

---

## 11. Infraestructura v2 (Staging / Prod)

### 12.1 Entornos

- `staging` y `production` completamente separados:
  - Supabase separado.
  - Workers separados.
  - Colas separadas.
  - OAuth apps separadas (X, YouTube, Polar, Resend).

### 12.2 Env vars (nombres contractuales)

Ejemplos (no exhaustivo, pero los nombres no deben cambiar):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `PERSPECTIVE_API_KEY`
- `POLAR_API_KEY`
- `POLAR_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `X_CLIENT_ID`
- `X_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `JWT_SECRET`
- `RATE_LIMIT_MAX`
- `RATE_LIMIT_WINDOW`
- `LOG_LEVEL`

> Las env vars se leen **solo** desde un settings loader central, no desperdigadas en el código.

---

## 12. Testing v2 (umbrales mínimos)

### 12.1 Cobertura por categoría

- Lógica de dominio: ≥ 90%.
- Prompt builders: 100%.
- Workers (unit): ≥ 80%.
- Workers (integration flow feliz): 100% escenarios clave.
- API / routes: ≥ 80%.
- Frontend hooks: ≥ 70%.
- UI E2E: flujos críticos cubiertos (login, conectar cuentas, dashboard, detalle de cuenta, settings, billing básico).

### 12.2 Regla de señal

- No se testean cosas sin señal:
  - clicks de botones triviales.
  - estilos CSS.
  - mocks gigantes de IA sin lógica.

---

## 13. Reglas anti-"AI slop"

Para cualquier cambio generado con ayuda de IA:

1. Comparar el diff con el resto del archivo:
   - Comentarios: eliminar los que un humano no habría escrito.
   - Checks defensivos anómalos para esa zona → revisar/recortar.
   - Casts a `any` injustificados → prohibidos.
   - Estilos incoherentes con el archivo → refactor.

2. Antes de cerrar una tarea:
   - Hacer pasada de limpieza manual.
   - Añadir un resumen corto de qué se ha limpiado (en PR description / commit message).

---

## 14. Regla final

> Ningún nuevo comportamiento de Roastr v2 se puede introducir sin:
>
> 1. Estar alineado con este SSOT, **o**
> 2. Modificar explícitamente este SSOT (en PR separado o claramente marcado).

Si Cursor / cualquier agente propone algo que contradice esto, la respuesta correcta es:

- **Detener inmediatamente**,
- **Comunicar la discrepancia al usuario de forma clara**,
- **No proceder** hasta que se aclare la situación,
- Proponer actualización del SSOT o corrección del código según corresponda.

## 15. GDD Health Score (Single Source of Truth)

Esta sección contiene las métricas oficiales del estado documental v2, calculadas exclusivamente a partir de system-map-v2.yaml y docs/nodes-v2.

**IMPORTANTE:**  
Los valores deben ser **dinámicos pero correctos**.  
NO se permiten valores hardcoded.  
Únicamente se actualizan cuando un proceso de auditoría v2 lo ordena manualmente mediante:

```bash
node scripts/compute-health-v2-official.js --update-ssot
```

### 15.1 Métricas Oficiales

| Métrica | Valor | Descripción |
|---------|-------|-------------|
| **System Map Alignment** | 100% | % de nodos en system-map-v2.yaml que tienen documentación en docs/nodes-v2/ |
| **SSOT Alignment** | 100% | % de nodos que usan valores del SSOT correctamente |
| **Dependency Density** | 100% | Nº de dependencias detectadas / nº esperado según system map |
| **Crosslink Score** | 100% | % de dependencias esperadas que están correctamente referenciadas |
| **Narrative Consistency** | 100% | Evalúa si los nodos describen procesos compatibles entre sí (placeholder) |
| **Health Score Final** | **100/100** | Ponderado: System Map (30%) + Dependency Density (20%) + Crosslink (20%) + SSOT Alignment (20%) + Narrative Consistency (10%) |

### 15.2 Detalles de Cálculo

- **Nodos detectados:** 15 de 15
- **Nodos faltantes:** 0
- **Última actualización:** 2025-12-15T12:51:51.802Z

### 15.3 Reglas de Actualización

1. **Ningún script puede modificar estos valores automáticamente**
2. **Solo se actualizan mediante:** `node scripts/compute-health-v2-official.js --update-ssot`
3. **El SSOT es la única fuente de verdad** - Los scripts de lectura (calculate-gdd-health-v2.js) deben leer desde aquí
4. **Si hay discrepancia** entre archivos → gana el SSOT

---
