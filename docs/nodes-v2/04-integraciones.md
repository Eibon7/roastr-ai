# GDD Node — Integraciones con Redes Sociales v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Summary

Integración con X (Twitter) y YouTube para conectar cuentas, ingerir comentarios, publicar respuestas, y ejecutar acciones de Shield (ocultar, reportar, bloquear). Gestiona estados de cuentas (active, paused, inactive), OAuth, health checks, cursors de ingestión, y manejo de errores específicos por plataforma.

---

## 2. Responsibilities

### Funcionales:

- Conexión OAuth con X (PKCE) y YouTube (OAuth2)
- Ingestión incremental de comentarios
- Publicación de roasts y respuestas correctivas
- Acciones de Shield por plataforma
- Gestión de estados: active, paused, inactive
- Health monitoring (`ok`, `degraded`, `frozen`, `needs_reconnect`)
- Manejo de cursors (since_id para X, nextPageToken para YouTube)
- Smart delays anti-bot

### No Funcionales:

- Rate limiting respetuoso
- Retries con backoff exponencial
- Tokens OAuth cifrados
- Manejo de errores 429/503/401
- Freeze temporal tras errores consecutivos

---

## 3. Inputs

- **OAuth**: Redirección desde plataforma con code
- **Ingestión**: cursor actual, cadencia según plan
- **Publicación**: texto roast/correctiva, parent comment ref
- **Shield**: acción (hide/report/block), comment_id, offender_id

---

## 4. Outputs

- Cuenta conectada en `accounts` table
- Comentarios normalizados: `{id, platform, account_id, text, author, timestamp, metadata}`
- Roast/correctiva publicado con `platform_message_id`
- Acción de Shield ejecutada
- Logs de health y errores

---

## 5. Rules

### Plataformas MVP v2 (ÚNICAS):

```typescript
type SupportedPlatform = 'x' | 'youtube';
```

Estas plataformas no forman parte del MVP v2 y solo deben implementarse cuando exista una tarea explícita:

Instagram, Facebook, Discord, Twitch, Reddit, TikTok, Bluesky

### Límite de Cuentas por Plan:

| Plan    | Cuentas por plataforma | Total (X + YouTube) |
| ------- | ---------------------- | ------------------- |
| starter | 1                      | 2                   |
| pro     | 2                      | 4                   |
| plus    | 2                      | 4                   |

### Estados de Cuenta:

```typescript
status: "active" | "paused" | "inactive"
status_reason:
  | "user_paused"
  | "billing_paused"
  | "oauth_revoked"
  | "rate_limit_exceeded"
  | "token_expired"
  | "too_many_errors"
  | "network_failures"
  | null
```

### Integration Health:

```typescript
integration_health:
  | "ok"          // Todo funciona
  | "degraded"    // Errores ocasionales
  | "frozen"      // Demasiados errores → 30 min OFF
  | "needs_reconnect"  // OAuth roto
```

### Cadencia de Ingestión:

| Plan    | Cadencia | Ingestiones/día por cuenta |
| ------- | -------- | -------------------------- |
| starter | 15 min   | 96                         |
| pro     | 10 min   | 144                        |
| plus    | 5 min    | 288                        |

### X (Twitter) Específico:

- OAuth2 PKCE
- Scopes: lectura menciones/respuestas, publicar respuestas, bloquear usuarios
- Límite: 280 chars
- Delay publicación: 10-15s entre respuestas
- Ventana de edición: roast retrasado 30 min si comentario editable
- **Nota**: La ventana de edición de 30 minutos afecta exclusivamente a la publicación de roasts. El Shield actúa de inmediato aunque el comentario sea editable.
- Anti-bot: máx 4 respuestas/hora al mismo usuario
- Errores: 429 (rate limit), 503 (downstream), 401 (token inválido), 403 (permisos)

### YouTube Específico:

- OAuth2 con Google
- Scopes: leer comentarios, publicar respuestas
- Cuota diaria estricta (respeta límite Google)
- Delay publicación: 2-3s entre respuestas
- Refresh tokens caducan ~6 meses sin uso → requiere reconexión
- Errores: 429 (quota), 403 (daily quota exceeded), 401 (token)

### Manejo de Errores:

**Backoff Exponencial**:

- Intento 1 → inmediato
- Intento 2 → 1 min
- Intento 3 → 5 min
- Intento 4 → 15 min
- Intento 5 → DLQ

**Freeze Temporal**:

- Tras 3 fallos graves consecutivos:
  - `integration_health` = "frozen"
  - Ingestión OFF 30 min
  - Logging de severidad alta

**Token Revocado**:

- 401 persistente → `status` = "inactive"
- `status_reason` = "oauth_revoked"
- UI → botón "Reconectar"

### Reactivación de Cuenta:

Cuando cuenta pasa a `active` desde `paused`/`inactive`:

1. Reset de cursor
2. Reset de pipeline interno
3. Revalidación de límites
4. `health` = "ok"
5. Primer fetch de prueba
6. Reactivación de workers

### GDPR:

- Retención: 90 días tras desconexión
- `retention_until` = now + 90 días
- Purga total después
- Nueva conexión = nueva cuenta

---

## 6. Dependencies

### Servicios Externos:

- **X API**: twitter-api-v2
- **YouTube API**: googleapis / Comment API
- **Supabase**: Tabla `accounts`

### SSOT:

- `supported_platforms`: X, YouTube
- Cadencias por plan
- Smart delays
- Límites de cuentas

### Workers:

- `FetchComments`: Ingestión programada
- `SocialPosting`: Publicación de roasts/correctivas
- `ShieldAction`: Acciones de moderación
- `CursorReconciliation`: Mantenimiento de cursors

### Nodos Relacionados:

- `02-autenticacion-usuarios.md` (OAuth flow)
- `03-billing-polar.md` (Pausar si billing paused)
- `05-motor-analisis.md` (Comentarios normalizados)
- `08-workers.md` (Workers de ingestión y posting)

---

## 7. Edge Cases

1. **Límite de cuentas alcanzado**:
   - Botón "Añadir cuenta" disabled
   - Backend valida hard limit

2. **Billing paused**:
   - Todas las cuentas → `status` = "paused"
   - `status_reason` = "billing_paused"
   - Workers OFF

3. **Análisis = 0**:
   - `status` = "paused"
   - `status_reason` = "billing_paused"
   - No ingestión
   - **Nota**: Cuando analysis_remaining = 0, la ingestión se detiene totalmente: no se consultan APIs externas ni se obtienen comentarios nuevos. La UI solo muestra el histórico existente.

4. **OAuth revocado (X)**:
   - 403/401 persistente
   - `status` = "inactive"
   - `status_reason` = "oauth_revoked"
   - UI → "Reconectar"

5. **Refresh token expirado (YouTube)**:
   - Google revoca tras ~6 meses sin uso
   - `status` = "inactive"
   - `status_reason` = "oauth_revoked"
   - UI → "Reconectar"

6. **Rate limit (X)**:
   - 429 → backoff exponencial
   - Freeze temporal si persistente

7. **Cuota diaria agotada (YouTube)**:
   - 403 daily quota exceeded
   - `integration_health` = "frozen"
   - Reintenta desde midnight UTC

8. **Errores de red intermitentes**:
   - Retry con backoff
   - Si persiste → `integration_health` = "degraded"

9. **Edición de comentario (X)**:
   - Si dentro de ventana 30 min → roast retrasado
   - Shield actúa inmediatamente

10. **Cuenta desconectada**:
    - Tokens eliminados
    - `status` = "inactive"
    - Workers OFF
    - `retention_until` = now + 90 días

11. **Brigading (ataque coordinado)**:
    - En casos de brigading detectado, el Shield eleva temporalmente la aggressiveness a 1.00 y registra un evento de alerta. No se altera la configuración permanente del usuario.

---

## 8. Acceptance Criteria

### Conexión:

- [ ] X OAuth2 PKCE funciona
- [ ] YouTube OAuth2 funciona
- [ ] Tokens almacenados cifrados
- [ ] Scopes correctos solicitados
- [ ] Cuenta creada en `accounts` table con `status` = "active"

### Límites:

- [ ] Starter → 1 cuenta por plataforma (máx 2 total)
- [ ] Pro/Plus → 2 cuentas por plataforma (máx 4 total)
- [ ] Botón disabled si límite alcanzado
- [ ] Backend valida límite

### Ingestión:

- [ ] Cadencia según plan (15/10/5 min)
- [ ] Cursor incremental (since_id / nextPageToken)
- [ ] Comentarios normalizados
- [ ] Solo si `status` = "active" y hay análisis disponibles

### Publicación:

- [ ] Roasts publicados con smart delay
- [ ] Disclaimers IA añadidos (si auto-approve ON)
- [ ] X: delay 10-15s entre respuestas
- [ ] YouTube: delay 2-3s entre respuestas
- [ ] X: roast retrasado 30 min si ventana edición

### Shield:

- [ ] X: hide, report, block funcionales
- [ ] YouTube: hide, report funcionales (si API permite)
- [ ] Fallback: bloquear si no se puede ocultar

### Errores:

- [ ] 429 → backoff exponencial
- [ ] 401 persistente → `status` = "inactive"
- [ ] 3 fallos graves → freeze 30 min
- [ ] DLQ tras 5 intentos

### Health:

- [ ] `integration_health` actualizado según errores
- [ ] UI muestra estado correcto
- [ ] Logs de severidad apropiada

### Desconexión:

- [ ] Tokens eliminados
- [ ] `retention_until` = now + 90 días
- [ ] Workers OFF
- [ ] Purga tras 90 días

---

## 9. Test Matrix

### Unit Tests (Vitest):

- ✅ Normalización de comentarios (X → estándar)
- ✅ Normalización de comentarios (YouTube → estándar)
- ✅ Smart delay calculation
- ✅ Cursor management
- ❌ NO testear: APIs externas directamente

### Integration Tests (Supabase Test):

- ✅ Conexión OAuth guarda cuenta en DB
- ✅ Ingestión actualiza cursor
- ✅ Publicación registra `platform_message_id`
- ✅ Error 401 → marca cuenta como inactive
- ✅ Freeze tras 3 fallos
- ✅ Desconexión → `retention_until` set

### E2E Tests (Playwright):

- ✅ Conectar cuenta X (mock OAuth)
- ✅ Conectar cuenta YouTube (mock OAuth)
- ✅ Límite alcanzado → botón disabled
- ✅ Desconectar cuenta → confirmación
- ✅ Estado paused → badge en UI
- ✅ Reconectar cuenta inactive

---

## 10. Implementation Notes

### X Adapter:

```typescript
// apps/backend-v2/src/integrations/x/XAdapter.ts
import { TwitterApi } from 'twitter-api-v2';

export class XAdapter {
  async fetchComments(accountId: string, sinceId?: string) {
    const tokens = await getTokens(accountId);
    const client = new TwitterApi(tokens.access_token);

    const mentions = await client.v2.mentions({
      since_id: sinceId,
      max_results: 100
    });

    return mentions.data.map(normalizeXComment);
  }

  async postReply(text: string, inReplyTo: string) {
    // Implementación
  }

  async hideComment(commentId: string) {
    // Implementación
  }
}
```

### YouTube Adapter:

```typescript
// apps/backend-v2/src/integrations/youtube/YouTubeAdapter.ts
import { google } from 'googleapis';

export class YouTubeAdapter {
  async fetchComments(accountId: string, nextPageToken?: string) {
    const tokens = await getTokens(accountId);
    const youtube = google.youtube({
      version: 'v3',
      auth: tokens.access_token
    });

    const response = await youtube.commentThreads.list({
      part: ['snippet'],
      pageToken: nextPageToken,
      maxResults: 100
    });

    return response.data.items.map(normalizeYouTubeComment);
  }

  async postReply(text: string, parentId: string) {
    // Implementación
  }
}
```

### Smart Delay:

```typescript
// apps/backend-v2/src/services/smartDelay.ts
export function calculateSmartDelay(
  platform: Platform,
  accountId: string,
  recentPostings: number
): number {
  const baseDelay = platform === 'x' ? 10_000 : 2_000; // ms
  const jitter = Math.random() * 5_000; // 0-5s
  const backpressure = recentPostings * 1_000; // +1s por posting reciente

  return baseDelay + jitter + backpressure;
}
```

### Referencias:

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 4)
- SSOT: `docs/SSOT/roastr-ssot-v2.md` (sección 7)
- X API Docs: https://developer.x.com/en/docs
- YouTube API Docs: https://developers.google.com/youtube/v3
