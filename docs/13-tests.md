# 13. Tests (v3)

*(Versión actualizada para NestJS + Vitest + Playwright)*

---

## 13.1 Filosofía

La estrategia de testing prioriza **realismo sobre mocks**:

1. **Unit tests** — Solo lógica compleja y determinista (reducers, validators, matchers).
2. **Integration tests** — Todo lo que implique datos reales contra Supabase.
3. **E2E tests** — Flujos completos con Playwright (UI + API + workers).
4. **Workers** — Job-by-job execution contra DB aislada, sin cron real.

**Regla de oro: No testear ruido. Solo lo que pueda romper el sistema.**

---

## 13.2 Unit Tests (Vitest)

```
apps/api/src/**/*.spec.ts
apps/web/src/**/*.spec.ts
packages/shared/src/**/*.spec.ts
```

### Qué se unit-testea

| Módulo | Tests |
|---|---|
| `domain/analysis-reducer.ts` | Fórmula completa del score, todos los branches del árbol de decisión |
| `domain/persona-matcher.ts` | Matching de keywords contra texto |
| `domain/threshold-router.ts` | Routing por umbrales (τ_low, τ_shield, τ_critical) |
| `domain/billing-reducer.ts` | State machine de billing (todas las transiciones) |
| Prompt builders (A/B/C) | Construcción correcta de prompts por tono |
| Style Validator | Todas las reglas (insultos, spam, longitud, etc.) |
| Normalizadores | NormalizedComment desde YouTube y X |

### Qué NO se unit-testea

- Llamadas a Supabase / APIs externas
- Workers haciendo IO
- Hooks de UI que solo formatean datos
- Estilos CSS
- Comportamientos cubiertos por E2E

---

## 13.3 Integration Tests

```
apps/api/tests/integration/
```

Usan Supabase local (`supabase start`) con rollback automático por test.

### Qué se testea

| Área | Tests |
|---|---|
| Accounts | Conexión, desconexión, cambio de estado, límite por plan |
| Shield | Acción sobre comentarios con distintos scores, fallbacks por plataforma |
| Strikes | Persistencia, escalada, purga a 90 días |
| Billing | Webhook processing, state transitions, límite agotado |
| SSOT | Lectura de planes, thresholds, tonos, feature flags |
| Workers | FetchComments → AnalyzeToxicity → ShieldAction (pipeline completo) |
| DLQ | Fallos persistentes registrados correctamente sin datos sensibles |

### Regla: No mock de Supabase

Si un test necesita datos → se insertan directamente en la DB test. Si necesita un usuario → se crea via `supabase.auth.admin.createUser()`.

---

## 13.4 E2E Tests (Playwright)

```
apps/web/tests/e2e/
```

### Flujos obligatorios MVP

**1. Autenticación**
- Signup → email confirmation → login
- Login con credenciales inválidas → error correcto
- Cuenta pausada → redirect a billing

**2. Onboarding**
- Wizard completo: plan → payment (mock Polar) → persona → connect account → done
- Abandono y reanudación del wizard

**3. Conexión de redes**
- YouTube OAuth (simulado)
- X OAuth (simulado)
- Límite de cuentas por plan respetado

**4. Dashboard**
- Widgets de uso (análisis, shield, roasts)
- Estados de cuentas (active / paused / inactive)
- Análisis agotados → banner + upgrade CTA

**5. Detalle de cuenta**
- Shield logs table
- Roast list (si módulo activo)
- Settings: tono, aggressiveness, auto-approve

**6. Settings**
- Editar Roastr Persona
- Cambiar contraseña
- Billing (mock Polar redirect)

---

## 13.5 Tests por módulo

### Backend (`apps/api`)

```
tests/
├── unit/
│   ├── analysis-reducer.spec.ts
│   ├── billing-reducer.spec.ts
│   ├── persona-matcher.spec.ts
│   ├── threshold-router.spec.ts
│   ├── style-validator.spec.ts
│   └── normalizers/
│       ├── youtube.spec.ts
│       └── x.spec.ts
├── integration/
│   ├── shield.integration.spec.ts
│   ├── accounts.integration.spec.ts
│   ├── billing-webhooks.integration.spec.ts
│   ├── ingestion-pipeline.integration.spec.ts
│   └── ssot.integration.spec.ts
└── workers/
    ├── fetch-comments.spec.ts
    ├── analyze-toxicity.spec.ts
    ├── shield-action.spec.ts
    ├── generate-roast.spec.ts
    ├── billing-update.spec.ts
    ├── social-posting.spec.ts
    └── dlq.spec.ts
```

### Frontend (`apps/web`)

```
tests/
├── unit/
│   └── hooks/
│       ├── useAuth.spec.ts
│       ├── useAccounts.spec.ts
│       └── useFeatureFlags.spec.ts
└── e2e/
    ├── auth.spec.ts
    ├── onboarding.spec.ts
    ├── dashboard.spec.ts
    ├── account-detail.spec.ts
    └── settings.spec.ts
```

---

## 13.6 Cobertura mínima

| Categoría | Cobertura |
|---|---|
| Domain reducers (analysis, billing) | **95%** |
| Prompt builders | **100%** |
| Style Validator | **100%** |
| Persona Matcher | **90%** |
| Workers (unit) | **80%** |
| Workers (integration — happy path) | **100%** |
| DLQ behavior | **100%** |
| API controllers | **80%** |
| Frontend hooks | **70%** |
| E2E | Todos los flujos críticos |

**Lo que rompe el producto debe estar 100% cubierto.**

---

## 13.7 CI Pipeline

```yaml
name: CI Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - name: Start Supabase
        run: npx supabase start
      - name: Unit tests
        run: npm run test:unit -- --coverage
      - name: Integration tests
        run: npm run test:integration
      - name: E2E tests
        run: npx playwright test --reporter=html
      - name: Coverage check
        run: npm run test:coverage-check
      - uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: |
            coverage/
            playwright-report/
```

### Pre-merge gates

- Todos los tests pasan (exit 0)
- Cobertura por categoría cumple mínimos
- Playwright OK en Chromium (mínimo 1 browser)
- No hay tests sin rollback (integration)
- Cambios en workers incluyen tests correspondientes

---

## 13.8 Dependencias

- **Vitest:** Test runner para unit + integration tests.
- **Playwright:** E2E browser testing.
- **Supabase CLI:** `supabase start` para DB local en tests.
- **Redis (Docker):** BullMQ queues en integration tests.
- **MSW (Mock Service Worker):** Mock de APIs externas (Perspective, OpenAI, Polar) en tests.
