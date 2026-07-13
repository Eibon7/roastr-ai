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

Al desconectar una cuenta (`AccountsService.disconnectByUserAndId`, ROA-T24):

1. `refresh_token_encrypted → NULL` (impide cualquier refresco futuro). `access_token_encrypted` es `NOT NULL` en el schema y no puede vaciarse; queda inerte porque `status` deja de ser `'active'`, y se purga junto al resto de la fila tras la retención.
2. `status → 'revoked'`, `status_reason → 'user_action'` (el enum `account_status` real es `active|paused|revoked|error` — no existe el valor `inactive` mencionado en versiones previas de este doc)
3. Repeatable job de ingestión en BullMQ eliminado (ROA-T23) — Workers detenidos
4. Ingestión OFF (bloqueado también por `status !== 'active'` en `ingestionProcessor`), Shield OFF (deja de recibir comentarios nuevos)
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

> **Hallazgo (auditoría de coste, §4.6.3):** esta tabla describe el mecanismo *documentado/intencionado*, no el implementado. `apps/worker/src/shared/fetch-comments.ts` (`fetchXComments`) solo usa `pagination_token` para paginar hacia adelante dentro de un mismo ciclo de fetch; no envía `since_id` (ni ningún parámetro equivalente) para pedir a X solo las menciones nuevas desde el ciclo anterior. En la práctica, cada llamada a `/2/users/{id}/mentions` devuelve hasta `max_results=100` de las menciones más recientes de la cuenta, sin excluir las ya leídas en ciclos previos. Ver §4.6.3 para el impacto de esto en el coste estimado de "Owned Reads". No se corrige aquí (fuera de alcance de esta tarea, que es de modelado/documentación, no de implementación).

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

### 4.6.3 Modelo de coste variable: "Owned Reads" en X (estimación)

> **Estado: ESTIMACIÓN, no cifra verificada.** Los números de esta sección se derivan de los supuestos documentados abajo, no de facturación real de X ni de una confirmación 1:1 contra la documentación oficial de precios de X API vigente en el momento de escribir esto (2026-07). Sirven para dimensionar el orden de magnitud del problema y decidir próximos pasos (pricing / términos de uso / cambios de implementación), no como cifra contractual.

**Contexto:** la auditoría de 2026-07-11 (PRD del proyecto "16 — Auditoría de flujos core") señaló que la lectura de menciones de X vía `/2/users/{id}/mentions` probablemente cae bajo el modelo "Owned Reads" de X — facturación de **$0.001 por recurso leído**, vigente desde abril 2026 — en vez de (o además de) el tier fijo mensual de la app (ver §6.14 de `docs/06-motor-roasting.md`: Free/Basic $200/Pro $5,000). Esta sección modela ese coste variable por plan.

**Supuestos usados (documentados explícitamente para que otras tareas los reutilicen, p.ej. la actualización de Términos de Uso para cuentas de X):**

1. Cada ciclo de ingestión programado (§4.6.1) ejecuta **1 llamada** a `GET /2/users/{id}/mentions` (`apps/worker/src/shared/fetch-comments.ts`, función `fetchXComments`). El código no pagina múltiples páginas dentro de un mismo ciclo de job.
2. `max_results=100` está hardcodeado en esa llamada (`fetch-comments.ts`, `url.searchParams.set("max_results", "100")`) — es el máximo de recursos que la API puede devolver por llamada.
3. **Hallazgo clave:** el código actual no implementa `since_id` ni ningún filtro incremental equivalente (ver nota en §4.6.2). Sin ese filtro, cada llamada devuelve hasta 100 de las menciones más recientes disponibles de la cuenta, sin excluir las ya devueltas en ciclos anteriores. Para cualquier cuenta con un historial de más de 100 menciones, esto implica que la mayoría de llamadas devolverán un número de recursos cercano al máximo (100), **independientemente del volumen real de menciones nuevas** desde el ciclo anterior. Por eso se modela un escenario "techo" (100 recursos/llamada) como estimación principal, en vez de una cifra "optimista" basada en actividad real — no hay telemetría de producción disponible para estimar el volumen real de menciones nuevas por cuenta con algún grado de confianza.
4. Precio: $0.001/recurso leído (Owned Reads), tomado tal cual de la nota de auditoría, sin verificación adicional.
5. Mes de 30 días para las cifras de "llamadas/mes" (consistente con la cadencia de §4.6.1: 96/144/288 ingestiones/día para Starter/Pro/Plus).
6. Las cifras son **por cuenta de X conectada**, no por usuario ni agregadas por plan. Un usuario con más de una cuenta de X conectada (Pro/Plus permiten `accountsPerPlatform: 2`, ver `packages/shared/src/constants/plans.ts`) multiplica el coste proporcionalmente al número de cuentas.
7. No está verificado si X factura por recurso devuelto en cada respuesta HTTP (contando recursos ya devueltos en llamadas anteriores como nuevos cobros) o si deduplica por ID de recurso dentro de un periodo de facturación. Este modelo asume el caso **sin deduplicación** (cada recurso devuelto en cada respuesta cuenta como una lectura facturable), que es el escenario de coste más alto y el que se corresponde con el comportamiento real del código (punto 3). Si X deduplicara por ID, el coste real sería menor y proporcional al volumen de menciones verdaderamente nuevas — desconocido sin datos de producción.

**Tabla: coste estimado de Owned Reads por plan (por cuenta de X conectada)**

| Plan | Cadencia | Llamadas/mes (30d) | Recursos/llamada (supuesto, techo) | Recursos/mes | Coste estimado/mes |
|---|---|---|---|---|---|
| Starter | 15 min | 2,880 | 100 | 288,000 | **$288.00** |
| Pro | 10 min | 4,320 | 100 | 432,000 | **$432.00** |
| Plus | 5 min | 8,640 | 100 | 864,000 | **$864.00** |

*(Cálculo: llamadas/mes × 100 recursos × $0.001/recurso. P. ej. Starter: 2,880 × 100 × 0.001 = 288.00.)*

**Lectura del resultado:** el coste estimado de Owned Reads por cuenta de X conectada (entre $288 y $864/mes según plan, en el escenario "techo") supera ampliamente el precio del propio plan (Starter €5, Pro €15, Plus €50/mes — `packages/shared/src/constants/plans.ts`). Incluso tomado solo como orden de magnitud, esto sugiere que el modelo de ingestión actual de X (cadencia fija + sin filtrado incremental) no es sostenible tal cual si se factura Owned Reads sin ningún límite adicional.

**Palancas de mitigación identificadas (fuera de alcance de esta tarea — solo se documentan, no se implementan):**
- Añadir `since_id` (u otro filtro incremental) al fetch de X para leer solo menciones nuevas desde el cursor anterior, acercando el coste real al volumen de actividad real en vez de al buffer máximo de 100 por llamada.
- Revisar si una cadencia más lenta (menos llamadas/día) reduce el coste sin degradar demasiado la frescura de los datos, especialmente en Starter/Pro.
- Evaluar un cap de "recursos leídos por cuenta/mes" como límite de producto (análogo a `analysisLimit`), en vez de limitar solo por cadencia.
- Decidir si el coste se traslada a pricing (subir precio, cobrar add-on por cuenta de X conectada) o se gestiona vía Términos de Uso (cap de cuentas de X más restrictivo, cadencia más lenta en planes bajos, o cláusula de reserva de coste variable).

**Relación con la tarea paralela de Términos de Uso:** la tarea "Actualizar términos de uso para usuarios que conectan cuentas de X" (mismo proyecto, ROA-P2, ver también §4.13(c) más abajo) debía citar las cifras de este modelo una vez cerrado. La cifra a citar es: **rango estimado $288–$864/mes por cuenta de X conectada, según plan, en el escenario "techo" sin deduplicación** — no verificado contra facturación real ni contra la política exacta de deduplicación de X.

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

---

## 4.13 Comunicación previa a la conexión de una cuenta de X (nota de producto/UX)

> **Aviso:** Esta sección es una **nota de producto/UX**, no el texto legal definitivo. Su propósito es dejar constancia de qué debe comunicarse al usuario antes de conectar una cuenta de X, para que Legal redacte la cláusula final de los Términos de Uso (`apps/web/src/routes/terms.tsx`, que hoy es un texto genérico sin menciones específicas por plataforma) y/o el copy de la pantalla de conexión (`ConnectAccounts`, §4.4.1). No se debe usar el texto de este apartado como cláusula legal vinculante tal cual.

Contexto (decisión de producto ya tomada, ver PRD del proyecto "16 — Auditoría de flujos core"): X restringió en feb 2026 las respuestas programáticas vía API salvo que el autor original mencione/cite la cuenta, con el tier Enterprise (~$42K+/año) como única vía de acceso sin esa restricción. Por eso Roastr ofrece **roast automático solo en YouTube**; en X, por ahora, no.

Antes de que un usuario conecte una cuenta de X, el flujo de conexión (o los Términos de Uso) debería dejar explícitas al menos estas tres cosas:

**a) No hay roast automático en X.**
Solo Shield (ocultar/bloquear comentarios, §7) actúa de forma automática sobre las menciones ingeridas de X. Capabilities reales del adapter de X (§4.1, §4.4.3): `hide` ✅, `block` ✅, `reply` ✅ solo si la publicación destino menciona/cita la cuenta del usuario (restricción de la API de X vigente desde feb 2026) o si la cuenta opera bajo el tier Enterprise. Esto debe comunicarse como una diferencia explícita frente a YouTube, donde sí hay roast automático (§ROA-T sobre disparo automático desde `analysis.ts`).

**b) La generación de un roast en X requiere acción manual del usuario.**
El endpoint `POST /roast/generate` (apps/api, `apps/api/src/modules/roast/roast.controller.ts`) sigue existiendo y es funcional para ese caso, pero a día de hoy **no tiene UI que lo invoque para X**: `RoastGenerateModal.tsx` se eliminó del frontend (ver learnings de la tarea "Reparar o retirar el camino manual roto") al no existir todavía un selector de comentario individual para X. Es decir: el texto de cara al usuario debe reflejar la intención de producto ("en X, generar un roast es una acción manual tuya, no automática"), pero **no debe prometer una función de generación manual ya disponible en la UI actual** — eso queda pendiente de construir. Legal/Producto deben alinear el wording con el estado real de la feature en el momento de publicar el texto.

**c) La lectura de menciones en X tiene un coste variable que puede repercutir en el plan.**
Según el PRD de este proyecto, la lectura de menciones vía `/2/users/{id}/mentions` probablemente cae bajo el modelo "Owned Reads" de X (facturación por recurso leído, no solo por tier fijo), vigente desde abril 2026. El modelo de coste ya está cerrado — ver **§4.6.3 de este mismo documento** — con la estimación (no verificada contra facturación real): **$288–$864/mes por cuenta de X conectada**, según plan (Starter/Pro/Plus), en el escenario "techo" sin deduplicación de X (supuesto explícito, ver §4.6.3 punto 7). El texto de cara al usuario debería, como mínimo: (i) advertir que leer menciones de X tiene un coste variable para Roastr ligado al volumen/cadencia de ingestión de la cuenta conectada (§4.6.1), (ii) evitar citar la cifra exacta como definitiva dado que no está verificada contra facturación real ni contra la política de deduplicación de X, y (iii) dejar constancia de que ese coste puede reflejarse en el pricing de los planes en el futuro (ajuste de cadencia, límites o precio), sujeto a revisión.

**Resumen para Legal:** el texto final de Términos de Uso para cuentas de X debe (1) diferenciar explícitamente las capacidades de X frente a YouTube en materia de roast automático, (2) evitar prometer una función de generación manual de roast en X que hoy no existe en la UI, y (3) incluir una cláusula de reserva sobre el coste variable de lectura de menciones y su posible traslado a pricing, citando como referencia el rango estimado de §4.6.3 ($288–$864/mes por cuenta conectada) marcado explícitamente como estimación no verificada, no como cifra contractual.
