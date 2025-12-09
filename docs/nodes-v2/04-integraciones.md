# GDD Node — Integraciones con Redes Sociales v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Dependencies

- [`infraestructura`](./14-infraestructura.md)
- [`billing`](./billing.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)

- [`infraestructura`](./14-infraestructura.md)
- [`billing`](./billing.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)

Este nodo depende de los siguientes nodos:

- [`infraestructura`](./14-infraestructura.md)
- [`billing`](./billing.md)
- [`observabilidad`](./observabilidad.md)
- [`ssot-integration`](./15-ssot-integration.md)

---

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

## 8. SSOT References

Este nodo usa los siguientes valores del SSOT:

- `connected_account_structure` - Estructura de cuentas conectadas
- `connection_status` - Estados de conexión (active, expired, revoked, error)
- `oauth_cleanup_rules` - Reglas de limpieza de tokens OAuth
- `oauth_pkce_flow` - Flujo PKCE de OAuth
- `oauth_scopes` - Scopes requeridos por plataforma
- `oauth_tokens` - Estructura de tokens OAuth
- `platform_limits` - Límites por plataforma (cuentas, rate limits)
- `platform_oauth_config` - Configuración OAuth por plataforma
- `platform_x_constraints` - Restricciones específicas de X/Twitter
- `platform_youtube_constraints` - Restricciones específicas de YouTube
- `smart_delay_algorithm` - Algoritmo de delays inteligentes
- `supported_platforms` - Plataformas soportadas (x, youtube)
- `token_refresh_rules` - Reglas de refresh de tokens

---

## 9. Acceptance Criteria

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

## 11. Related Nodes
