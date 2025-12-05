# GDD Node — Infraestructura v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Summary

Pipeline de deploy CI/CD con aislamiento total staging/producción, tests automáticos pre-merge, smoke tests, observabilidad obligatoria, alertas por criticidad, backups automáticos, rate limits, y error budget para proteger producción. Producción nunca se despliega automáticamente.

---

## 2. Responsibilities

### Funcionales:

- Deploy automático a staging tras merge
- Promoción manual a producción
- Aislamiento total staging/prod (BD, workers, colas, OAuth, logs)
- Smoke tests automáticos post-deploy
- Backups automáticos (staging: 7 días, prod: 30 días)
- Rate limiting interno y externo
- Observabilidad (logs estructurados, alertas)

### No Funcionales:

- Reproducibilidad: deploys auditables y reversibles
- Seguridad: env vars cifradas, separadas por entorno
- Monitoreo: logs JSON, alertas por criticidad
- Resiliencia: error budget, rollbacks manuales

---

## 3. Inputs

- Git push → PR
- Aprobación humana
- Tests CI passing
- Smoke tests passing
- Métricas de error budget

---

## 4. Outputs

- Deploy staging automático
- Deploy producción manual
- Smoke tests results
- Logs estructurados (Axiom/Datadog/Sentry)
- Alertas (alta/media/baja criticidad)
- Backups automáticos

---

## 5. Rules

### Deploy Pipeline:

```
Git push →
PR creada →
Coderabbit review →
Aprobación humana →
Tests CI (unit + integration + E2E) →
Merge →
Deploy automático a Staging →
Smoke tests →
Promoción manual → Producción
```

**Regla inamovible**: Producción NUNCA se despliega automáticamente.

**Promoción manual a producción requiere**:

- 2 aprobaciones humanas (superadmin + otro aprobador técnico)
- Confirmación explícita: "Entiendo que estoy desplegando a producción"

### CI Pre-Merge:

Nada entra en `main` sin:

- ✅ Lint passing
- ✅ Typecheck passing
- ✅ Vitest passing
- ✅ Supabase Test passing
- ✅ Playwright E2E passing (críticos)
- ✅ Coverage mínima cumplida
- ✅ Validación SSOT OK

### Aislamiento Staging/Producción:

**NO comparten**:

- Backend
- Frontend
- Base de datos
- Storage
- Colas
- Workers
- Claves OAuth
- Logs
- IA keys

**Backend**:

- Staging: `stg.roastr.ai/api`
- Prod: `api.roastr.ai`

**Frontend**:

- Staging: `stg.roastr.ai`
- Prod: `roastr.ai`

**Supabase**:

- Dos instancias separadas
- Staging: datos ficticios/anonimizados, seeds controlados
- Prod: datos reales, sin seeds

**SSOT nunca se comparte entre entornos** (todas las tablas):

- Staging → `*_staging` (admin_settings, plan_limits, shield_settings, tone_settings, workers_settings, integrations_settings, ai_settings, flags_settings)
- Producción → `*_prod` (mismo conjunto)
- Si staging intenta leer SSOT prod → error inmediato.

**Migraciones**:

- SIEMPRE pasan por staging primero
- Rollbacks manuales + revisión obligatoria

### Workers y Colas:

**Prefijos por entorno**:

```
Staging:
queue_roastr_staging_fetch
queue_roastr_staging_roast
queue_roastr_staging_shield

Producción:
queue_roastr_prod_fetch
queue_roastr_prod_roast
queue_roastr_prod_shield
```

**Regla**: Ningún worker puede consumir cola de otro entorno.

Validación:

- Env vars obligatorias
- Prefijos de colas
- Health checks específicos

**En Staging, GenerateRoast y GenerateCorrectiveReply siempre usan modelos IA de bajo coste** (gpt-4o-mini u otros definidos en SSOT).

Producción sí usa los modelos configurados en SSOT (full power).

**En Staging: Cron de ingestión deshabilitado**.

- Workers solo corren cuando los activa un test o QA.

**En Staging está habilitado "Posting Sandbox Mode"**:

- NO publica en X ni YouTube.
- Las respuestas se envían a un endpoint local simulado.
- ShieldAction NO ejecuta bloqueos reales.
- Se registran logs como si la acción hubiera ocurrido.

### Variables de Entorno:

**Prefijos obligatorios**:

```
OPENAI_API_KEY_4O_STG
OPENAI_API_KEY_4O_PROD
OPENAI_API_KEY_4OMINI_STG
OPENAI_API_KEY_4OMINI_PROD
PERSPECTIVE_API_KEY_STG
PERSPECTIVE_API_KEY_PROD
AXIOM_TOKEN_STG
AXIOM_TOKEN_PROD
X_CLIENT_ID_STG
X_CLIENT_ID_PROD
SUPABASE_URL_STG
SUPABASE_URL_PROD
```

Reglas:

- Prefijadas por entorno
- **Todas las IA keys están siempre duplicadas por entorno**
- **Ningún entorno puede leer las claves del otro**
- Cargadas desde settings loader
- ❌ NO hardcodeadas en código
- Cada entorno tiene `.env` cifrado

### Smoke Tests Automáticos:

```
POST /health
POST /auth
POST /billing/test
POST /workers/ping
POST /integrations/x/status
POST /ssot/health      → Verifica integridad SSOT
POST /llm/ping         → Verifica que IA responde
```

### Observabilidad:

**Logs estructurados (JSON)**:

```typescript
{
  (timestamp, env, service, user_id, account_id, action, latency_ms, success, error_code);
}
```

**Destinos**:

- Backend → Axiom / Logtail / Datadog
- Workers → logs separados
- Frontend → Sentry

### Alertas:

**Criticidad Alta (rojo)**:

- Workers caídos
- Perspective API caída completamente
- DLQ > 20
- Errores 500 persistentes >1% en 10 min

→ Notificación inmediata (PagerDuty / Slack urgente)

**Criticidad Media (amarillo)**:

- Backoff excesivo
- Integraciones devolviendo 429 repetidos
- Degradación IA

→ Notificación Slack canal #alerts

**Criticidad Baja (azul)**:

- Errores UI menores
- 404 no críticos
- Warning workers

→ Logging únicamente + notificación opcional

### Error Budget:

| Tipo                 | Límite          | Consecuencia        |
| -------------------- | --------------- | ------------------- |
| 500s en backend      | >1% en 10 min   | No promotion a prod |
| Fails E2E en staging | >3 consecutivos | Bloqueo deploy      |
| DLQ size             | >20 jobs        | Alerta alta         |
| SmartDelay 429       | >5 en 5 min     | Alerta media        |

### Backups:

**Supabase**:

- Staging → 7 días
- Producción → 30 días

**Ubicación backups**:

- Staging → `supabase_staging/backups/YYYY-MM-DD/`
- Producción → `supabase_prod/backups/YYYY-MM-DD/`

Los backups NUNCA se almacenan en infraestructura del frontend.

**Incluye**:

- Usuarios, cuentas, roasts, SSOT, flags, reincidencia, settings

**NO incluye**:

- Tokens OAuth caducados
- Logs > 30 días
- Colas DLQ

**Restauración**:

1. Pausar workers
2. Restaurar snapshot
3. Restaurar SSOT
4. Validar migraciones + RLS
5. Smoke tests
6. Reactivar workers

Simulacro cada 90 días.

### Rate Limits:

**Internos**:

- API → 60 req/min
- Ingestión según plan (15/10/5 min)
- Smart Delay en posting

**Externos**:

- X → límites estrictos por usuario y app
- YouTube → cuota diaria
- OpenAI → límite por minuto

---

## 6. Dependencies

### Servicios:

- **GitHub Actions**: CI/CD pipeline
- **Vercel/Railway**: Hosting (staging + prod)
- **Supabase**: BD separadas
- **Axiom/Datadog**: Logs
- **Sentry**: Error tracking

### Configuración:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`

### Nodos Relacionados:

- `13-testing.md` (Tests en CI)
- Todos los nodos (deploy de features)

---

## 7. Edge Cases

1. **Staging deploy falla**:
   - Rollback automático
   - Alerta alta
   - Logs detallados

2. **Smoke tests fallan**:
   - NO promoción a prod
   - Investigación requerida

3. **Error budget excedido**:
   - Bloqueo deploy prod
   - Requiere fix

4. **Worker staging consume cola prod**:
   - Detectado por prefijos
   - Rechazado por validación

5. **Migración falla en staging**:
   - Rollback
   - NO intenta en prod

6. **Backup corrupto**:
   - Usa backup anterior
   - Alerta crítica

7. **Env var falta**:
   - Deploy falla early
   - Error claro

8. **Rate limit excedido (X)**:
   - Workers pausan temporalmente
   - Log + alerta

9. **Perspective API down**:
   - Fallback GPT-4o-mini
   - Alerta media

10. **DLQ > 20 jobs**:
    - Alerta alta
    - Requiere revisión

11. **Staging intenta publicar contra API producción**:
    - Bloqueo inmediato por validación de host
    - Log crítico: "cross-environment-call-blocked"

---

## 8. Acceptance Criteria

### Pipeline:

- [ ] CI ejecuta lint, typecheck, tests
- [ ] Deploy staging automático tras merge
- [ ] Deploy prod manual (requiere aprobación)
- [ ] Smoke tests post-deploy
- [ ] Rollback manual disponible

### Aislamiento:

- [ ] Staging y prod separados completamente
- [ ] BD separadas (Supabase)
- [ ] Colas prefijadas por entorno
- [ ] Workers separados
- [ ] OAuth apps separadas
- [ ] Env vars separadas

### Workers:

- [ ] Colas `v2_*` en staging
- [ ] Colas `v2_*` en prod
- [ ] Ningún worker cruza entornos
- [ ] Validación de prefijos

### Observabilidad:

- [ ] Logs JSON estructurados
- [ ] Destinos: Axiom/Datadog (backend), Sentry (frontend)
- [ ] Logs separados por worker
- [ ] Sin datos sensibles en logs

### Alertas:

- [ ] Alta criticidad configurada
- [ ] Media criticidad configurada
- [ ] Baja criticidad configurada
- [ ] Destino: email, Slack, PagerDuty

### Error Budget:

- [ ] 500s > 1% en 10 min → bloquea prod
- [ ] E2E fails > 3 → bloquea deploy
- [ ] DLQ > 20 → alerta alta
- [ ] 429 > 5 en 5 min → alerta media

### Backups:

- [ ] Staging: 7 días automático
- [ ] Prod: 30 días automático
- [ ] Simulacro cada 90 días
- [ ] Restauración documentada

### Rate Limits:

- [ ] API: 60 req/min
- [ ] Ingestión por plan
- [ ] Smart delays implementados
- [ ] Respeto límites externos (X, YouTube, OpenAI)

---

## 9. Test Matrix

### CI Tests:

- ✅ Lint
- ✅ Typecheck
- ✅ Vitest (unit + integration)
- ✅ Playwright E2E (críticos)
- ✅ Coverage validation
- ✅ SSOT validation

### Smoke Tests:

- ✅ `/health`
- ✅ `/auth`
- ✅ `/billing/test`
- ✅ `/workers/ping`
- ✅ `/integrations/x/status`
- ✅ `/ssot/health` (integridad SSOT)
- ✅ `/llm/ping` (IA responde)

---

## 10. Implementation Notes

### CI Workflow:

```yaml
# .github/workflows/ci.yml
name: CI Tests

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:e2e
      - run: npm run validate:ssot
```

### Deploy Staging:

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm run build
      - run: npm run deploy:staging
      - run: npm run smoke:staging
```

### Referencias:

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 14)
- SSOT: `docs/SSOT/roastr-ssot-v2.md` (sección 10)
