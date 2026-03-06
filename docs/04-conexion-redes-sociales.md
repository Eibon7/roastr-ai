# 4. Conexión con Redes Sociales (v3)

*(Versión actualizada para arquitectura Shield-first, multi-plataforma)*

Roastr v3 soporta múltiples plataformas con rollout progresivo:

**MVP:**
- YouTube
- X (Twitter)

**Phase 2 (sin entidad legal):**
- Bluesky (AT Protocol abierto)
- Twitch
- Reddit
- Discord

**Phase 3 (requiere entidad legal / verificación empresarial):**
- Instagram (Meta Graph API → requiere Business Verification)
- Facebook Pages (Meta Graph API → requiere Business Verification)
- TikTok (requiere Developer Account verificado como empresa)
- LinkedIn (Organization API → requiere empresa verificada)

Las integraciones siguen arquitectura hexagonal con NestJS. Cada plataforma es un **adapter** que implementa una interfaz común:

```
src/
├── platforms/
│   ├── platform.port.ts          # interfaz común
│   ├── youtube/
│   │   ├── youtube.adapter.ts
│   │   ├── youtube.oauth.ts
│   │   └── youtube.types.ts
│   └── x/
│       ├── x.adapter.ts
│       ├── x.oauth.ts
│       └── x.types.ts
├── ingestion/
│   ├── ingestion.service.ts
│   └── ingestion.worker.ts
├── analysis/
│   └── analysis.worker.ts
└── shield/
    └── shield.worker.ts
```

Cada plataforma opera con workers independientes, cursors propios, health checks y lógicas de error específicas.

---

## 4.1 Interfaz común de plataforma (Port)

Todas las plataformas implementan esta interfaz:

```typescript
interface PlatformAdapter {
  readonly platform: Platform;
  readonly capabilities: PlatformCapabilities;

  authenticate(code: string, state: string): Promise<OAuthTokens>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;
  revokeToken(accessToken: string): Promise<void>;

  fetchComments(cursor: string | null, accountId: string): Promise<CommentPage>;

  hideComment(commentId: string): Promise<ActionResult>;
  reportComment(commentId: string, reason: ReportReason): Promise<ActionResult>;
  blockUser(userId: string): Promise<ActionResult>;
  replyToComment(commentId: string, text: string): Promise<ActionResult>;
}

interface PlatformCapabilities {
  canHide: boolean;
  canReport: boolean;
  canBlock: boolean;
  canReply: boolean;
  rateLimits: {
    requestsPerMinute: number;
    dailyQuota: number | null;
  };
}

interface CommentPage {
  comments: NormalizedComment[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface ActionResult {
  success: boolean;
  error?: string;
  fallbackUsed?: boolean;
}
```

Los métodos no soportados lanzan `PlatformActionNotSupportedError`. El Shield consulta `capabilities` antes de invocar cualquier acción (ver §7.9).

---

## 4.2 Límite de cuentas por plan

| Plan | Cuentas por plataforma | Plataformas MVP | Max cuentas total |
|---|---|---|---|
| Starter (€5/mo) | 1 | 2 (YouTube + X) | 2 |
| Pro (€15/mo) | 2 | 2 (YouTube + X) | 4 |
| Plus (€50/mo) | 2 | 2 (YouTube + X) | 4 |

### Reglas

- "Cuentas por plataforma" significa **por red**, no en total.
- Si se alcanza el máximo → botón *Añadir cuenta* deshabilitado en UI.
- El backend valida igualmente (hard limit en el endpoint).
- Si billing está **paused** → todas las cuentas pasan a `paused`.
- Cuando se añadan plataformas en Phase 2/3, los límites se revisarán.

---

## 4.3 Estado de las cuentas

### 4.3.1 Schema en DB

```sql
CREATE TYPE account_status AS ENUM ('active', 'paused', 'inactive');
CREATE TYPE status_reason AS ENUM (
  'user_paused',
  'billing_paused',
  'oauth_revoked',
  'rate_limit_exceeded',
  'token_expired',
  'too_many_errors',
  'network_failures',
  'analysis_exhausted'
);
CREATE TYPE integration_health AS ENUM ('ok', 'degraded', 'frozen', 'needs_reconnect');

CREATE TABLE accounts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id),
  platform                    TEXT NOT NULL,
  platform_user_id            TEXT NOT NULL,
  username                    TEXT NOT NULL,
  status                      account_status NOT NULL DEFAULT 'active',
  status_reason               status_reason,
  integration_health          integration_health NOT NULL DEFAULT 'ok',

  -- OAuth tokens (cifrados en reposo)
  access_token_encrypted      BYTEA NOT NULL,
  refresh_token_encrypted     BYTEA,
  access_token_expires_at     TIMESTAMPTZ,

  -- Shield config per-account
  shield_aggressiveness       FLOAT NOT NULL DEFAULT 0.95,

  -- Roast config (opcional, solo si Roasting está activo)
  auto_approve                BOOLEAN NOT NULL DEFAULT false,
  tone                        TEXT DEFAULT 'balanceado',

  -- Cursors e ingestion
  ingestion_cursor            TEXT,
  last_successful_ingestion   TIMESTAMPTZ,
  consecutive_errors          INTEGER NOT NULL DEFAULT 0,

  -- GDPR
  retention_until             TIMESTAMPTZ,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, platform, platform_user_id)
);

-- RLS: users only see their own accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_owner ON accounts
  FOR ALL USING (auth.uid() = user_id);
```

### 4.3.2 Estados funcionales

#### 1. active

- Ingestión activa
- Shield activo (si hay análisis)
- Roasts activos (si hay créditos y módulo habilitado)
- Tokens válidos
- Workers funcionando
- `integration_health = 'ok'`

**Al entrar en active (desde paused/inactive):**

- Reset de cursor de ingestión
- Reset de workers
- Limpieza de backoffs (`consecutive_errors = 0`)
- Health check inmediato
- Primer fetch de prueba

#### 2. paused

**Causas:**

| Causa | status_reason |
|---|---|
| Usuario pausa manualmente | `user_paused` |
| Billing pausado / subscription inactive | `billing_paused` |
| Análisis agotados (`analysis_remaining = 0`) | `analysis_exhausted` |
| Freeze temporal por errores | `too_many_errors` |

**Efectos:**

- Workers detenidos
- No ingestión, no Shield, no Roasts
- UI muestra "Cuenta pausada" con motivo
- Se conservan datos y configuración

#### 3. inactive

**Causas:**

| Causa | status_reason |
|---|---|
| Token caducado sin refresh posible | `token_expired` |
| OAuth revocado (403/401 persistente) | `oauth_revoked` |
| Plataforma frozen > 24h | `too_many_errors` |
| Rate limit persistente > 24h | `rate_limit_exceeded` |

**Efectos:**

- Workers detenidos
- UI → botón "Reconectar"
- Se conserva `retention_until`
- No se borran datos hasta expiración GDPR

---

## 4.4 Flujo de autenticación

### 4.4.1 Flujo genérico OAuth2

Todas las plataformas siguen este flujo base:

```
1. Usuario pulsa "Conectar [plataforma]"
2. Frontend → Backend: GET /api/oauth/{platform}/authorize
3. Backend genera: state + code_verifier (PKCE)
4. Backend redirige al authorization URL de la plataforma
5. Usuario autoriza en la plataforma
6. Plataforma redirige a: /api/oauth/{platform}/callback?code=...&state=...
7. Backend intercambia code por tokens (access + refresh)
8. Backend cifra tokens y crea registro en accounts
9. Workers se inicializan para la cuenta
10. Frontend recibe confirmación
```

### 4.4.2 YouTube

- OAuth2 estándar con Google
- Scopes: `youtube.readonly`, `youtube.force-ssl` (para comentarios y respuestas)
- Google revoca refresh tokens tras ~6 meses sin uso → auto-detect y pedir reconexión
- Quota: 10,000 units/día por proyecto (1 list = 1 unit, 1 insert = 50 units)
- Capabilities: hide ✅, report ✅, block ✅ (ban de canal), reply ✅

### 4.4.3 X (Twitter)

- OAuth 2.0 con PKCE
- Scopes: `tweet.read`, `tweet.write`, `users.read`, `block.write`, `hide.write`
- Tiers de API:
  - Free: 1,500 tweets/month read, 500 posts/month
  - Basic ($200/mo): 10,000 reads/month, 3,000 posts/month
  - Enterprise ($42K+/año): full access
- Capabilities: hide ✅ (todos los tiers), report ❌, block ✅, reply ✅ (desde cuenta del usuario via OAuth, cuota compartida a nivel de app)
- **Nota importante:** Roastr publica desde la cuenta del usuario (no como bot). Los posts cuentan contra la cuota mensual de la APP (Free: 500, Basic: 3,000). Shield (hide/block) no consume cuota de posts.

### 4.4.4 Plataformas futuras

**Phase 2 (sin entidad legal):**

| Plataforma | Auth | Capabilities | Notas |
|---|---|---|---|
| Bluesky | AT Protocol (app password) | hide, report, block, reply | API abierta, sin rate limits estrictos |
| Twitch | OAuth2 + IRC/EventSub | hide, block, reply (chat) | Requiere permisos de mod |
| Reddit | OAuth2 | hide, report, block, reply | Solo como moderador del subreddit |
| Discord | OAuth2 + Bot token | hide (delete), block, reply | Requiere bot con permisos |

**Phase 3 (requiere entidad legal):**

| Plataforma | Auth | Capabilities | Bloqueante |
|---|---|---|---|
| Instagram | Meta Graph API | hide, block | Meta Business Verification |
| Facebook | Meta Graph API | hide, block, reply | Meta Business Verification |
| TikTok | Login Kit OAuth2 | hide, block | Developer Account verificado |
| LinkedIn | Organization API | solo lectura | Empresa verificada |

---

## 4.5 Desconectar cuentas

Al desconectar una cuenta:

1. Tokens OAuth eliminados (borrado del cifrado)
2. `status → inactive`
3. Workers detenidos
4. Ingestión OFF, Shield OFF
5. `retention_until = now + 90 días`

### Retención 90 días (GDPR)

Durante ese periodo se conservan:

- Metadatos de shield_logs (sin texto de comentarios)
- Strikes del ofensor (vinculados a la cuenta)
- Métricas agregadas

Pasado ese tiempo → **purga total** de todos los datos vinculados a esa cuenta.

UI: "Cuenta desconectada — datos retenidos hasta DD/MM/AAAA"

**Nueva conexión de la misma cuenta de plataforma = nueva cuenta en Roastr** (no se reusan datos anteriores).

---

## 4.6 Ingestión de comentarios (Workers)

### 4.6.1 Cadencia por plan

| Plan | Cadencia | Ingestiones/día por cuenta |
|---|---|---|
| Starter | 15 min | 96 |
| Pro | 10 min | 144 |
| Plus | 5 min | 288 |

Cada cuenta tiene su propio job en BullMQ con cadencia independiente.

### 4.6.2 Pipeline de ingestión

**Step 1 — Job programado (BullMQ)**

Worker consulta cada X minutos según plan del usuario.

**Step 2 — Fetch incremental**

Cada plataforma usa su mecanismo de cursor:

| Plataforma | Cursor | Mecanismo |
|---|---|---|
| YouTube | `nextPageToken` | Paginación por token |
| X | `since_id` / `pagination_token` | Cronológico |

- Retry on fail con backoff
- Guarda `last_successful_ingestion` en cada fetch exitoso
- Actualiza `ingestion_cursor` para siguiente iteración

**Step 3 — Normalización**

Todos los comentarios se normalizan al formato estándar `NormalizedComment` (ver §5.1):

```typescript
{
  id: string;
  platform: Platform;
  accountId: string;
  userId: string;
  authorId: string;
  text: string;
  timestamp: string;
  metadata: Record<string, any>;
}
```

**Step 4 — Dispatch al Motor de Análisis**

Si `analysis_remaining > 0`:
- Comentario entra al Motor de Análisis (§5)
- Motor produce `AnalysisResult`
- Resultado se despacha al Shield (§7)
- Shield ejecuta acciones según decisión y platform capabilities

Si `analysis_remaining = 0`:
- Log: `analysis_limit_exceeded`
- Cuenta pasa a `paused` con `status_reason: 'analysis_exhausted'`
- UI muestra aviso + opciones de upgrade

---

## 4.7 Manejo de errores por plataforma

### 4.7.1 Estrategia general

Todas las plataformas siguen la misma lógica base:

```
Error transitorio (429, 503, network timeout):
  → Backoff exponencial: 1min → 5min → 15min → 30min
  → consecutive_errors++
  → Si consecutive_errors >= 3: integration_health = 'degraded'
  → Si consecutive_errors >= 6: integration_health = 'frozen' (30min OFF)
  → Si frozen > 24h: status = 'inactive'

Error de autenticación (401, 403 persistente):
  → Intentar refresh token
  → Si refresh falla: status = 'inactive', reason = 'token_expired'
  → Si 403 persistente: reason = 'oauth_revoked'
  → UI: botón "Reconectar"

Error de quota (429 con retry-after, 403 quota exceeded):
  → Respetar retry-after header
  → Si es daily quota: frozen hasta midnight UTC
  → Log de severidad media
```

### 4.7.2 Errores específicos — YouTube

- `quotaExceeded` (403) → frozen hasta midnight UTC (quota diaria de 10K units)
- `commentsDisabled` → skip video, no error de cuenta
- `channelNotFound` → inactive
- `processingFailure` → retry con backoff

### 4.7.3 Errores específicos — X (Twitter)

- 429 con `x-rate-limit-reset` → espera exacta hasta timestamp
- Free tier: cap estricto de 1,500 reads/month → tracking interno para no exceder
- `ACCOUNT_SUSPENDED` → inactive
- Edit window (30 min) → delay de análisis para roasts, Shield inmediato
- `FORBIDDEN` (403) sin haber cambiado nada → posible revocación de app → log + alert

---

## 4.8 Health Model

Cada cuenta tiene un overlay de health independiente del status:

| Health | Significado | Condición |
|---|---|---|
| `ok` | Todo funciona | `consecutive_errors = 0` |
| `degraded` | Errores ocasionales | `3 ≤ consecutive_errors < 6` |
| `frozen` | Demasiados errores, 30min OFF | `consecutive_errors ≥ 6` |
| `needs_reconnect` | OAuth roto | 401/403 persistente, refresh failed |

**Reset de health:**

- Cualquier fetch exitoso → `consecutive_errors = 0`, `health = 'ok'`
- Reconexión exitosa → `health = 'ok'`
- Desfreeze automático tras 30 min → retry, si éxito → `ok`, si fallo → `frozen` de nuevo

**UI muestra:**

- Badge de color por health (verde/amarillo/rojo/gris)
- Tooltip con `status_reason` si no es `ok`
- Botón "Reconectar" si `needs_reconnect`

---

## 4.9 Reglas de pausa

| Causa | Status | Reason | Workers | Reactivación |
|---|---|---|---|---|
| Usuario pausa | `paused` | `user_paused` | OFF | Manual (UI) |
| Billing paused | `paused` | `billing_paused` | OFF | Billing reactiva |
| Análisis = 0 | `paused` | `analysis_exhausted` | OFF | Nuevo ciclo billing |
| Freeze (errores) | `paused` | `too_many_errors` | OFF 30min | Auto-retry |
| Token expired | `inactive` | `token_expired` | OFF | Reconectar |
| OAuth revocado | `inactive` | `oauth_revoked` | OFF | Reconectar |

---

## 4.10 Reconexión y reactivación

Cuando una cuenta pasa a `active` desde `paused` o `inactive`:

1. Reset de `ingestion_cursor` (empezar desde ahora, no re-procesar histórico)
2. Reset de `consecutive_errors = 0`
3. `integration_health = 'ok'`
4. Revalidación de límites de plan
5. Health check inmediato (1 fetch de prueba)
6. Si éxito → workers activados
7. Si fallo → permanece en estado anterior + log

---

## 4.11 Seguridad

- Tokens OAuth cifrados en reposo (AES-256-GCM via Supabase Vault o app-level encryption)
- Refresh tokens renovados automáticamente antes de expiración
- Sensitive logging OFF (nunca logear tokens, solo token_hash para debug)
- Tokens **nunca** se exponen al frontend
- Workers usan service role JWT aislado (no el token del usuario)
- PKCE obligatorio en todos los flujos OAuth2

---

## 4.12 Dependencias

- **Supabase Auth (§2):** Identidad del usuario propietario de las cuentas.
- **Billing (§3):** Determina límites de cuentas, cadencia de ingestión, y estado de pausa.
- **Motor de Análisis (§5):** Consume los `NormalizedComment` producidos por la ingestión.
- **Shield (§7):** Ejecuta acciones de moderación usando los métodos del adapter. Consulta `capabilities` para determinar qué acciones son posibles.
- **Workers (§8):** BullMQ jobs que ejecutan la ingestión periódica por cuenta.
- **SSOT:** Define cadencias por plan, límites de cuentas, y rate limit configs.
