# GDD Node — Infraestructura v2

---

version: "2.0"
node_id: infraestructura
status: production
priority: critical
owner: Back-end Dev
last_updated: 2025-12-05
coverage: 81
coverage_source: auto
required_by:

- analysis-engine
- shield-engine
- integraciones-redes-sociales
- billing-integration
- workers
  ssot_references:
- queue_configuration
- worker_routing_table
- rls_policies
- rate_limits
  subnodes:
- queue-management
- database-rls
- queue-configuration
- base-worker
- staging-production-isolation
- deploy-pipeline
- smoke-tests-pipeline
- backups
- rate-limits

---

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Dependencies

- [`observabilidad`](./observabilidad.md)

- [`observabilidad`](./observabilidad.md)

Este nodo depende de los siguientes nodos:

- [`observabilidad`](./observabilidad.md)

---

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

## 10. Acceptance Criteria

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

## 10. SSOT References

Este nodo usa los siguientes valores del SSOT:

- `queue_configuration` - Configuración de colas (nombres, prioridades, DLQ)
- `worker_routing_table` - Tabla de routing de workers
- `rls_policies` - Políticas de Row Level Security
- `rate_limits` - Rate limits por servicio

---

### Referencias

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 14)
- SSOT: `docs/SSOT/roastr-ssot-v2.md` (sección 10)

## 11. Related Nodes

- analysis-engine (required_by)
- shield-engine (required_by)
- integraciones-redes-sociales (required_by)
- billing-integration (required_by)
- workers (required_by)
