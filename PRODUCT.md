# Roastr v3 — Product Documentation

## 1. Vision del Producto

Roastr es un sistema multi-tenant de moderacion automatica y generacion de respuestas para creadores de contenido en redes sociales.

**Dos productos en uno:**

- **Shield** (core, todas las plataformas): Ingestion de comentarios, analisis de toxicidad con IA, bloqueo automatico de usuarios toxicos, ocultacion/eliminacion de comentarios inadecuados. Dashboard de moderacion.
- **Roasts** (add-on, solo plataformas que lo permitan): Generacion de respuestas ingeniosas y personalizadas a comentarios toxicos, con diferentes tonos y estilos.

### Estrategia Shield-First

Desde febrero 2026, X/Twitter bloqueo las respuestas automaticas via API para todos los tiers excepto Enterprise ($42k/mes) con "Operation Kill the Bots". Esto hace inviable el modelo de roast automatico en X para una startup.

**Decision estrategica:**

1. Lanzar primero con Shield (moderacion automatica) en todas las plataformas
2. Desarrollar Roasts en paralelo solo para plataformas que lo permitan (YouTube, Instagram, Facebook, Discord, Twitch)
3. Cuando la facturacion lo permita, obtener Enterprise tier de X para habilitar Roasts ahi tambien

Para X, Shield ofrece: leer menciones + ocultar replies + bloquear usuarios. Sin respuestas automaticas.

---

## 2. Plataformas Soportadas

### 2.1 MVP: X + YouTube

| Plataforma | Leer | Responder (Roast) | Moderar | Bloquear | Coste API |
|---|---|---|---|---|---|
| **YouTube** | commentThreads.list (1 unit) | comments.insert (50 units) | setModerationStatus | Ban de canal | Gratis (10k units/dia, ampliable) |
| **X/Twitter** | GET /2/users/:id/mentions (180 req/15min) | BLOQUEADO (feb 2026, solo Enterprise) | Hide replies | POST /1.1/blocks/create | $200/mes (Basic) |

### 2.2 Post-MVP: Plataformas adicionales

| Plataforma | Leer | Responder | Moderar | Bloquear | Coste | Prioridad |
|---|---|---|---|---|---|---|
| **Instagram** | Graph API | Graph API | Ocultar/eliminar | Limitado | Gratis (Meta Dev) | Alta |
| **Facebook Pages** | Graph API | Page token | Ocultar/eliminar | /page/blocked | Gratis (Meta Dev) | Alta |
| **Discord** | MESSAGE_CONTENT intent | Reply nativo | Eliminar msgs | Ban/kick | Gratis | Media |
| **Twitch** | EventSub real-time | Send Chat Message | Eliminar/timeout | Ban | Gratis | Media |
| **Reddit** | 60 req/min | Como user | Solo si mod | Si | $0.24/1k calls | Baja |
| **Bluesky** | AT Protocol | Sin restricciones | Labels + reportes | Si | Gratis | Baja |
| **TikTok** | Solo Research API | NO (sin endpoint) | Muy limitado | NO | Gratis | No viable |

### 2.3 Plataforma como tipo

```ts
type SupportedPlatform = 'x' | 'youtube';
type PlannedPlatform = 'instagram' | 'facebook' | 'discord' | 'twitch' | 'reddit' | 'bluesky';
// TikTok descartado por limitaciones de API
```

---

## 3. Planes y Limites

### 3.1 IDs de plan

```ts
type PlanId = 'starter' | 'pro' | 'plus';
```

### 3.2 Trial por plan

| Plan | trial_enabled | trial_days |
|------|---------------|------------|
| starter | true | 30 |
| pro | true | 7 |
| plus | false | 0 |

### 3.3 Limites mensuales por plan

| Plan | analysis_limit | roast_limit | accounts_per_platform | sponsors_allowed | tone_personal_allowed |
|------|---------------|-------------|----------------------|-----------------|----------------------|
| starter | 1,000 | 5 | 1 | false | false |
| pro | 10,000 | 1,000 | 2 | false | true |
| plus | 100,000 | 5,000 | 2 | true | true |

### 3.4 Capacidades por plan

- **Starter**: Shield basico, tonos estandar (Flanders, Balanceado, Canalla), Persona disponible, sin tono personal, sin sponsors.
- **Pro**: Shield completo, tonos estandar + tono personal (beta), multi-cuenta (2 por red), Persona disponible, sin sponsors.
- **Plus**: Todo lo de Pro + sponsors protegidos + prioridad en colas (futuro).

---

## 4. Billing — Polar

### 4.1 Proveedor

Polar es el unico proveedor de billing.

### 4.2 Estados de suscripcion

```ts
type SubscriptionState =
  | 'trialing'
  | 'expired_trial_pending_payment'
  | 'payment_retry'
  | 'active'
  | 'canceled_pending'
  | 'paused';
```

### 4.3 Reglas clave

**Trial:**
- Starter: 30 dias, Pro: 7 dias, Plus: sin trial.
- Trial exige metodo de pago valido.
- Si cancela durante trial: corte inmediato, estado paused, sin cobro.

**Fin de trial:**
- Cobro OK -> active. Cobro falla -> payment_retry (5 dias). Sigue fallando -> paused.

**Active:**
- Servicio completo segun plan. Cancelacion -> canceled_pending.

**Canceled_pending:**
- Servicio hasta current_period_end. Al llegar -> paused.

**Paused:**
- Sin Shield, sin Roasts, sin ingestion. UI accesible (billing, historico, settings).
- Reactivacion: checkout nuevo + cobro -> active.

### 4.4 Webhooks Polar

```ts
type PolarWebhookEvent =
  | 'subscription_created'    // -> trialing o active
  | 'subscription_active'     // -> active
  | 'subscription_canceled'   // -> canceled_pending
  | 'subscription_updated'    // -> upgrade/downgrade
  | 'invoice_payment_failed'  // -> payment_retry
  | 'invoice_payment_succeeded'; // -> active
```

Todos los webhooks deben ser idempotentes y pasar por billingStateMachine(currentState, event).

### 4.5 Limites agotados

- `analysis_remaining = 0`: Workers OFF, Shield OFF, Roasts OFF. Solo historico en UI.
- `roasts_remaining = 0`: Shield sigue. No se generan roasts. UI muestra limite alcanzado.

---

## 5. Shield — Motor de Analisis

### 5.1 Thresholds

```ts
type Thresholds = {
  roastLower: number;  // debajo de esto = publicar
  shield: number;      // encima = moderacion
  critical: number;    // critico = bloqueo
};
```

### 5.2 Weights

```ts
type Weights = {
  lineaRoja: number;    // 1.15 - identity attack/amenaza
  identidad: number;    // 1.10
  tolerancia: number;   // 0.95 - solo si score < shield threshold
  strike1: number;      // 1.10
  strike2: number;      // 1.25
  critical: number;     // 1.50
};
```

### 5.3 Reglas inmutables

- Identity attack o amenaza => shield_critico siempre, independiente del score numerico.
- insults_count >= N_DENSIDAD => fuerza shield_critico.
- Reincidencia: strikeLevel >= 2 + insultos fuertes => preferencia por shield_critico.
- Tolerancias solo reducen score cuando NO estamos en zona de Shield. Nunca rebajan un caso critico.

### 5.4 Decisiones posibles

```ts
type AnalysisDecision = 'publicar' | 'correctiva' | 'roast' | 'shield_moderado' | 'shield_critico';
```

### 5.5 Correctiva

Solo si: score < shield threshold, score >= roast_lower, insultoLevePeroArgumentoValido, sin strikes graves. Consume 1 credito de roast. Usa tono correctivo institucional.

---

## 6. Gatekeeper (Anti Prompt Injection)

### 6.1 Proposito

Primera linea de defensa contra comentarios maliciosos e intentos de prompt injection. Clasifica comentarios antes de que lleguen a modelos de IA.

### 6.2 Categorias de deteccion

1. `instruction_override` - Intentos de ignorar instrucciones
2. `prompt_extraction` - Intentos de extraer el prompt
3. `role_manipulation` - Cambiar rol del modelo
4. `jailbreak` - Romper restricciones
5. `output_control` - Controlar salida
6. `hidden_instruction` - Instrucciones ocultas
7. `priority_override` - Cambiar prioridades
8. `encoding_trick` - Evasion por codificacion

### 6.3 Heuristicas

- multipleNewlines, codeBlocks, unusualLength, repeatedPhrases
- Modo multiplicativo (default) o aditivo
- Configuracion via admin_settings, hot reload (cache 1 min)

---

## 7. Roastr Persona

### 7.1 Estructura

```ts
type PersonaProfile = {
  identidades: string[];   // "Lo que me define"
  lineasRojas: string[];   // "Lo que no tolero"
  tolerancias: string[];   // "Lo que me da igual"
};
```

- Almacenada como EncryptedPersona (AES) en DB.
- Se usa SOLO en Motor de Analisis (ajuste de score).
- NUNCA se incluye en prompts de IA.
- No visible en Panel Admin.
- Borrado inmediato al eliminar cuenta.

---

## 8. Tonos y Roasting

### 8.1 Tonos oficiales

```ts
type RoastTone = 'flanders' | 'balanceado' | 'canalla' | 'personal';
```

- `flanders`: amable, diminutivos, humor blanco.
- `balanceado`: estandar, sarcasmo suave, elegante.
- `canalla`: humor afilado, ironia, sin degradacion.
- `personal`: derivado rule-based del estilo del usuario (solo Pro/Plus, beta).

### 8.2 Style Validator

Rule-based, sin IA. No permite: insultos, ataques identitarios, contenido explicito, spam, textos vacios, textos que excedan limites de plataforma, falsos disclaimers de IA.

### 8.3 Disclaimers IA

Solo cuando autoApprove === true y la region lo exige (UE). Cuando el usuario aprueba manualmente, no se anade disclaimer. Variantes por tono definidas en configuracion.

---

## 9. Workers y Procesos Asincronos

### 9.1 Workers core

```ts
type CoreWorker =
  | 'FetchComments'
  | 'AnalyzeToxicity'
  | 'GenerateRoast'
  | 'GenerateCorrectiveReply'
  | 'ShieldAction'
  | 'SocialPosting'
  | 'BillingUpdate';
```

### 9.2 Workers auxiliares

```ts
type AuxWorker =
  | 'AccountDeletion'
  | 'AlertNotification'
  | 'ExportCleanup'
  | 'GDPRRetention'
  | 'ModelAvailability';
```

### 9.3 Reglas

- Todos los payloads incluyen userId + accountId (multi-tenancy).
- 5 intentos por job (1 normal + 3 backoff + 1 final). Si falla -> DLQ.
- Logs estructurados: timestamp, worker_name, userId, accountId, platform, duration_ms, success, error_code, retry_count.

---

## 10. GDPR y Retencion

- Usuarios eliminados: retencion max 90 dias, luego purga total.
- Ofensores/reincidencia: solo ultimos 90 dias.
- Logs de motor: 90 dias.
- Persona: borrado inmediato al eliminar cuenta.
- NO guardamos: texto crudo de comentarios interceptados por Shield, imagenes, videos, DMs, historial de ediciones.
- SI guardamos: datos de cuenta, persona cifrada, logs minimos (toxicidad numerica, accion, timestamp), roasts publicados.

---

## 11. Feature Flags

Todos los flags viven en admin_settings.feature_flags. Ningun flag se hardcodea.

### 11.1 Flags core

- `autopost_enabled` - auto-approve de roasts
- `manual_approval_enabled` - roasts requieren aprobacion manual
- `enable_shield` - on/off Shield por cuenta
- `enable_roast` - on/off Roasts (permite usar solo Shield)
- `ingestion_enabled` - on/off ingestion de comentarios
- `kill_switch_autopost` - apaga todos los autopost global
- `sponsor_feature_enabled` - modulo de sponsors (solo Plus)
- `enable_user_registration` - habilita registro

### 11.2 Auth flags

- `auth_enable_login`, `auth_enable_register`, `auth_enable_magic_link`, `auth_enable_password_recovery`, `auth_enable_oauth`, `auth_enable_session_refresh`, `auth_enable_emails`
- Default: false (fail-closed) excepto session_refresh (true)

### 11.3 Rate limit flags

- `enable_rate_limit_global`, `enable_rate_limit_auth`, `enable_rate_limit_ingestion`, `enable_rate_limit_roast`, `enable_rate_limit_persona`, `enable_rate_limit_notifications`, `enable_rate_limit_gdpr`, `enable_rate_limit_admin`
- Default: true (fail-closed)

---

## 12. Rate Limiting

### 12.1 Configuracion por scope

| Scope | Max | Window | Block Duration |
|-------|-----|--------|---------------|
| Global | 10,000 | 1 hora | - |
| Auth password | 5 | 15 min | 15 min |
| Auth magic_link | 3 | 1 hora | 1 hora |
| Auth oauth | 10 | 15 min | 15 min |
| Ingestion global | 1,000 | 1 hora | - |
| Ingestion per user | 100 | 1 hora | - |
| Roast | 10 | 1 min | - |
| Persona | 3 | 1 hora | - |
| Admin | 100 | 1 min | - |

### 12.2 Progressive blocking

Escalacion: 15 min -> 1 hora -> 24 horas -> permanente (requiere intervencion manual).

### 12.3 Abuse detection thresholds

- multi_ip: 3 IPs diferentes para mismo email
- multi_email: 5 emails diferentes para misma IP
- burst: 10 intentos en 1 minuto
- slow_attack: 20 intentos en 1 hora

### 12.4 Implementacion

Sliding window con Redis. Fail-safe: bloquea en errores de Redis (no permite bypass).

---

## 13. Auth Error Taxonomy

```ts
type AuthError = {
  slug: string;
  http_status: number;
  retryable: boolean;
  user_message_key: string;
  category: 'auth' | 'authz' | 'session' | 'token' | 'account' | 'policy';
};
```

Slugs MVP: AUTH_INVALID_CREDENTIALS, AUTH_EMAIL_NOT_CONFIRMED, AUTH_ACCOUNT_LOCKED, AUTH_DISABLED, AUTH_UNKNOWN, AUTHZ_INSUFFICIENT_PERMISSIONS, SESSION_EXPIRED, SESSION_INVALID, TOKEN_EXPIRED, TOKEN_INVALID, TOKEN_MISSING, ACCOUNT_NOT_FOUND, ACCOUNT_SUSPENDED, ACCOUNT_EMAIL_ALREADY_EXISTS, POLICY_RATE_LIMITED, POLICY_BLOCKED, POLICY_INVALID_REQUEST.

---

## 14. Stack Tecnico v3

### 14.1 Backend

- **Framework**: NestJS + TypeScript
- **Arquitectura**: Hexagonal (Ports & Adapters)
- **Deploy**: Railway
- **Workers**: BullMQ + Redis (servicio separado en Railway, siempre activo)

### 14.2 Frontend

- **Framework**: React + Vite + TypeScript
- **UI**: shadcn/ui
- **Deploy**: Vercel

### 14.3 Base de datos y Auth

- **DB**: Supabase (Postgres con RLS para multi-tenancy)
- **Auth**: Supabase Auth
- **Realtime**: Supabase Realtime (dashboard updates)

### 14.4 Servicios externos

- **AI**: OpenAI (toxicidad + generacion de roasts)
- **Billing**: Polar
- **Email**: Resend
- **Queue**: Redis en Railway (BullMQ)

### 14.5 Entornos

- `staging` branch -> Railway staging + Vercel Preview (roastr-ai.vercel.app)
- `main` branch -> Railway production + Vercel Production
- Supabase separado por entorno
- OAuth apps separadas por entorno (X, YouTube, Polar, Resend)

### 14.6 Arquitectura hexagonal

```
backend/src/
  domain/           -> Entidades, value objects, ports (interfaces)
  application/      -> Use cases, commands, queries, services
  infrastructure/   -> Adapters (YouTube, X, Supabase, OpenAI, BullMQ)
  interfaces/       -> Controllers REST, workers, cron jobs, webhooks
```

Anadir una nueva plataforma = solo un nuevo adapter. Cambiar proveedor de IA = solo cambiar un adapter. Toda la logica de negocio es testeable sin infraestructura.

---

## 15. Testing

### 15.1 Cobertura por categoria

- Logica de dominio: >= 90%
- Prompt builders: 100%
- Workers (unit): >= 80%
- Workers (integration): 100% escenarios clave
- API/routes: >= 80%
- Frontend hooks: >= 70%
- E2E: flujos criticos (login, conectar cuentas, dashboard, settings, billing)

### 15.2 Regla de senal

No se testean: clicks triviales, estilos CSS, mocks gigantes sin logica.

---

## 16. Reglas Anti-AI-Slop

1. Comparar diff con el resto del archivo: eliminar comentarios que un humano no escribiria, checks defensivos anomalos, casts a any injustificados, estilos incoherentes.
2. Antes de cerrar tarea: pasada de limpieza manual + resumen de lo limpiado.

---

## 17. Regla Final

Ningun nuevo comportamiento se puede introducir sin estar alineado con este documento o modificarlo explicitamente. Si hay discrepancia: detener, comunicar, no proceder hasta aclarar.
