# System Configuration Reference - Roastr.AI

**Última actualización:** 2025-12-03  
**Propósito:** Inventario completo de Cursor Rules, Agents, Skills y servicios de terceros

---

## 1. 📋 Cursor Rules Activas

### 1.1. Rules Principales

| Archivo                                 | Descripción                                         | Estado    | Ámbito   |
| --------------------------------------- | --------------------------------------------------- | --------- | -------- |
| `.cursorrules`                          | Reglas generales del proyecto (GDD, Agents, Skills) | ✅ Activo | Global   |
| `.cursor/rules/shadcn-ui-migration.mdc` | Reglas para migración UI a shadcn/ui                | ✅ Activo | Frontend |
| `.cursor/rules/v2-development.mdc`      | Reglas para desarrollo V2 limpio                    | ✅ Activo | V2 only  |

### 1.2. Contenido de Reglas

#### `.cursorrules` - Reglas Generales

- **FASE 0 Assessment con GDD** (obligatorio)
- **Detección automática de Agents** (detect-triggers.js)
- **Workflow estándar** (FASE 0 → 1 → 2 → 3 → 4)
- **Reglas por Agent** (TestEngineer, FrontendDev, Guardian, TaskAssessor)
- **Skills auto-activadas** (10 skills integradas)
- **Anti-AI-Slop Review** (limpieza de código antes de PR)

#### `.cursor/rules/shadcn-ui-migration.mdc` - UI

- **Comandos MCP:** `/cui`, `/iui`, `/rui`, `/ftc`
- **Componentes shadcn/ui** por defecto
- **Tema claro/oscuro/sistema** obligatorio
- **Responsive design** (mobile-first)
- **Testing visual** con Playwright

#### `.cursor/rules/v2-development.mdc` - V2

- **Ámbito:** `/apps/frontend-v2`, `/apps/backend-v2`, `/apps/shared`
- **TypeScript only** (`.ts` / `.tsx`)
- **UI:** shadcn/ui + Tailwind
- **Billing:** Polar (no Stripe en v2)
- **Emails:** Resend (no SendGrid en v2)
- **Testing:** Vitest + Supabase Test + Playwright
- **Architecture:** Hexagonal (backend), Domain-driven (frontend)
- **Testing Rules V2:** Behavior-driven, anti-mock hell, 80-120 tests

---

## 2. 🤖 Agents Configurados

**Manifest:** `agents/manifest.yaml`  
**Inventario:** `docs/agents/INVENTORY.md`  
**Receipts:** `docs/agents/receipts/`

### 2.1. Built-in Agents (7)

| Agent              | Status         | Purpose                                | Triggers                                       |
| ------------------ | -------------- | -------------------------------------- | ---------------------------------------------- |
| **Orchestrator**   | ✅ Implemented | Coordina sub-agents, ejecuta workflows | `area:*`, `priority:*`                         |
| **Explore**        | ✅ Implemented | Research de codebase rápido            | `area:*`, research, investigation              |
| **TaskAssessor**   | ✅ Implemented | Evalúa tareas antes de implementar     | AC ≥3, P0/P1                                   |
| **TestEngineer**   | ✅ Implemented | Genera tests, valida cobertura         | `test:*`, cambios en `src/`, `tests/`          |
| **FrontendDev**    | ✅ Implemented | Implementa UI components               | `area:frontend`, `area:ui`, `*.jsx`, `*.tsx`   |
| **UIDesigner**     | ✅ Implemented | Produce UI specs, accesibilidad        | `area:ui`, `design`                            |
| **WhimsyInjector** | ✅ Implemented | Añade microcopy y branding             | `area:ui`, `branding` (NO legal/billing/admin) |

### 2.2. Custom Agents (2)

| Agent               | Status         | Purpose                            | Script                    |
| ------------------- | -------------- | ---------------------------------- | ------------------------- |
| **Guardian**        | ✅ Implemented | Governance + completion validation | `scripts/guardian-gdd.js` |
| **general-purpose** | ✅ Implemented | Research multi-step complejo       | Built-in                  |

### 2.3. Guardrails Críticos

**Orchestrator:**

- ❌ Never load spec.md completamente
- ❌ Never expose secrets o .env variable names
- ✅ Always FASE 0 assessment antes de implementar
- ✅ Generate receipts para todos los agents

**Guardian:**

- ❌ NEVER bypass CRITICAL violations sin Product Owner approval
- ❌ NEVER merge PRs con exit code 2
- ❌ NEVER merge PRs incompletas (completion < 100%)
- ✅ Validate completion antes de merge

**TestEngineer:**

- ❌ Never commit código sin tests
- ❌ Never skip visual evidence para frontend
- ✅ Must coordinate con Orchestrator si tests faltan

---

## 3. 🛠️ Skills Configuradas

**Ubicación:** `.claude/skills/`  
**Total:** 20 skills disponibles

### 3.1. Skills Core (6)

| Skill                                    | Trigger                        | Output                               |
| ---------------------------------------- | ------------------------------ | ------------------------------------ |
| **test-generation-skill**                | Cambios en `src/` sin tests    | Tests + `docs/test-evidence/`        |
| **gdd-sync-skill**                       | Cambios código/arquitectura    | Nodos actualizados + health ≥87      |
| **security-audit-skill**                 | auth, secret, policy, security | `docs/audit/security-report-{id}.md` |
| **visual-validation-skill**              | UI change, frontend, visual    | Screenshots + `ui-report.md`         |
| **writing-plans-skill**                  | AC ≥3, P0/P1                   | `docs/plan/issue-{id}.md`            |
| **verification-before-completion-skill** | "complete", "done", "ready"    | Evidence-based validation            |

### 3.2. Skills Avanzadas (8)

| Skill                                    | Purpose                                        |
| ---------------------------------------- | ---------------------------------------------- |
| **systematic-debugging-skill**           | Framework 4 fases debugging (root cause → fix) |
| **root-cause-tracing-skill**             | Traza errores hacia atrás en call stack        |
| **test-driven-development-skill**        | RED→GREEN→REFACTOR enforcement                 |
| **dispatching-parallel-agents-skill**    | Despacha múltiples agents en paralelo          |
| **using-git-worktrees-skill**            | Workspaces aislados con setup automático       |
| **finishing-a-development-branch-skill** | Cierra branches con 4 opciones estructuradas   |
| **requesting-code-review-skill**         | Estándar para pedir review con rigor           |
| **receiving-code-review-skill**          | Aplica review feedback sistemáticamente        |

### 3.3. Skills Especializadas (6)

| Skill                               | Domain                           |
| ----------------------------------- | -------------------------------- |
| **api-integration-debugging-skill** | API integrations troubleshooting |
| **code-review-skill**               | Code review automation           |
| **cost-control-validation-skill**   | Billing & quotas validation      |
| **multi-tenant-context-skill**      | Multi-tenant isolation patterns  |
| **prompt-injection-defense-skill**  | Security against prompt attacks  |
| **spec-update-skill**               | Spec.md maintenance              |

### 3.4. Auto-Activation

Skills se activan automáticamente según:

- **Keywords:** "GDD", "test", "security", "UI change"
- **File changes:** `src/`, `tests/`, `docs/nodes/`
- **Labels:** `test:*`, `area:ui`, `security`
- **Context:** "complete", "done", "ready"

---

## 4. 🌐 Productos y Servicios de Terceros

**Status:** ✅ = Activo | 🚧 = En migración | 📦 = Legacy

### 4.1. Infrastructure & Database

| Servicio             | Versión   | Uso                          | Status    |
| -------------------- | --------- | ---------------------------- | --------- |
| **Supabase**         | `^2.57.4` | PostgreSQL + Auth + Storage  | ✅ Activo |
| **Redis (Upstash)**  | `^1.35.6` | Queue system + Rate limiting | ✅ Activo |
| **Redis (estándar)** | `^5.9.0`  | Fallback/desarrollo          | ✅ Activo |

### 4.2. AI & ML

| Servicio                   | Versión   | Uso                           | Status    |
| -------------------------- | --------- | ----------------------------- | --------- |
| **OpenAI**                 | `^5.23.2` | Roast generation + Embeddings | ✅ Activo |
| **Google Perspective API** | -         | Toxicity analysis             | ✅ Activo |

### 4.3. Payments & Billing

| Servicio   | Versión   | Uso                        | Status         |
| ---------- | --------- | -------------------------- | -------------- |
| **Polar**  | `^0.41.1` | Billing v2 (subscriptions) | ✅ Activo (v2) |
| **Stripe** | `^18.5.0` | Billing legacy             | 📦 Legacy (v1) |

### 4.4. Email

| Servicio     | Versión  | Uso                      | Status            |
| ------------ | -------- | ------------------------ | ----------------- |
| **Resend**   | -        | Email v2 (transaccional) | 🚧 Migración (v2) |
| **SendGrid** | `^8.1.5` | Email legacy             | 📦 Legacy (v1)    |

### 4.5. Social Media Platforms

#### Activas (2)

| Plataforma      | Librería         | Versión   | Uso                        | Status    |
| --------------- | ---------------- | --------- | -------------------------- | --------- |
| **X (Twitter)** | `twitter-api-v2` | `^1.24.0` | Mention monitoring, roasts | ✅ Activo |
| **YouTube**     | googleapis       | -         | Comment monitoring, roasts | ✅ Activo |

#### Legacy (7 - NO implementar en v2 sin tarea explícita)

| Plataforma    | Status    | Nota                                |
| ------------- | --------- | ----------------------------------- |
| **Instagram** | 📦 Legacy | Instagram Basic Display + Graph API |
| **Facebook**  | 📦 Legacy | Facebook Graph API                  |
| **Discord**   | 📦 Legacy | Discord Bot API                     |
| **Twitch**    | 📦 Legacy | Twurple (Twitch API wrapper)        |
| **Reddit**    | 📦 Legacy | Reddit API                          |
| **TikTok**    | 📦 Legacy | TikTok API                          |
| **Bluesky**   | 📦 Legacy | AT Protocol (`@atproto/api`)        |

### 4.6. Development & Testing

| Servicio                   | Versión   | Uso                                | Status         |
| -------------------------- | --------- | ---------------------------------- | -------------- |
| **Playwright**             | `^1.56.1` | E2E testing + Visual validation    | ✅ Activo      |
| **Jest**                   | -         | Unit/Integration testing (v1)      | 📦 Legacy      |
| **Vitest**                 | -         | Unit/Integration testing (v2)      | ✅ Activo (v2) |
| **supabase-test**          | `^0.2.4`  | Test DB con rollback transaccional | ✅ Activo      |
| **@testing-library/react** | `^16.3.0` | React component testing            | ✅ Activo      |

### 4.7. Project Management

| Servicio          | Versión       | Uso                       | Status              |
| ----------------- | ------------- | ------------------------- | ------------------- |
| **Linear**        | `@linear/sdk` | Issue tracking & planning | ✅ Activo           |
| **GitHub Issues** | -             | Legacy issue tracking     | ✅ Activo (híbrido) |

### 4.8. CI/CD & Deployment

| Servicio           | Uso                                | Status    |
| ------------------ | ---------------------------------- | --------- |
| **GitHub Actions** | CI/CD automation                   | ✅ Activo |
| **Vercel**         | Frontend deployment (staging/prod) | ✅ Activo |
| **CodeRabbit**     | Automated code review              | ✅ Activo |

### 4.9. Monitoring & Analytics

| Servicio                    | Uso                        | Status       |
| --------------------------- | -------------------------- | ------------ |
| **Portkey**                 | AI gateway + observability | ✅ Activo    |
| **Sentry** (si configurado) | Error tracking             | 🔍 Verificar |

### 4.10. MCP Servers

| MCP                   | Uso                              | Status    |
| --------------------- | -------------------------------- | --------- |
| **Playwright MCP**    | Browser automation + screenshots | ✅ Activo |
| **Shadcn-Studio MCP** | UI component generation          | ✅ Activo |

---

## 5. 📊 Resumen por Categoría

### Infrastructure

- 🟢 **3 servicios** (Supabase, Redis Upstash, Redis estándar)

### AI/ML

- 🟢 **2 servicios** (OpenAI, Google Perspective)

### Payments

- 🟢 **1 activo v2** (Polar)
- 📦 **1 legacy v1** (Stripe)

### Email

- 🟡 **1 migración v2** (Resend)
- 📦 **1 legacy v1** (SendGrid)

### Social Platforms

- 🟢 **2 activas** (X, YouTube)
- 📦 **7 legacy** (resto - NO usar en v2)

### Project Management

- 🟢 **2 servicios** (Linear, GitHub Issues - híbrido)

### Development

- 🟢 **5 herramientas activas** (Playwright, Vitest, supabase-test, testing-library, CodeRabbit)
- 📦 **1 legacy** (Jest - solo v1)

### Deployment

- 🟢 **3 servicios** (GitHub Actions, Vercel, CodeRabbit)

### MCPs

- 🟢 **2 servidores** (Playwright, Shadcn-Studio)

---

## 6. 🎯 Comandos Rápidos

### Agents

```bash
# Detectar agent apropiado para issue
node scripts/cursor-agents/detect-triggers.js

# Validar receipts
ls docs/agents/receipts/cursor-*-[timestamp].md

# Guardian governance
node scripts/guardian-gdd.js --full

# Completion validation
node scripts/ci/validate-completion.js --pr=<number>
```

### Skills

```bash
# GDD sync
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci

# Security audit
grep -r "API_KEY\|SECRET\|PASSWORD" src/

# Visual validation
npm run test:e2e -- --headed
```

### Testing

```bash
# Legacy (v1)
npm test
npm run test:coverage

# V2
npm run test:unit        # Vitest unit tests
npm run test:integration # Vitest + Supabase Test
npm run test:e2e:ci      # Playwright E2E
```

### Verification

```bash
# RLS security
npm run verify:rls

# Environment
npm run verify:env

# CodeRabbit
npm run coderabbit:review
```

### Linear Integration

```bash
# Ver teams
npm run linear:teams

# Crear issue
npm run linear:create -- --title "..." --description "..." --priority 1

# Actualizar issue
npm run linear:update -- --id ROA-123 --status "In Progress"

# Listar issues
npm run linear:list -- --state "Todo"

# Sincronizar con GitHub
npm run linear:sync -- --linear ROA-123 --github 1093
```

---

## 7. 📚 Referencias

### Documentation

- **GDD Guide:** `docs/GDD-ACTIVATION-GUIDE.md`
- **Agent Manifest:** `agents/manifest.yaml`
- **Agent Inventory:** `docs/agents/INVENTORY.md`
- **Skills:** `.claude/skills/`
- **Integrations:** `docs/INTEGRATIONS.md`
- **Linear Integration:** `docs/LINEAR-INTEGRATION-GUIDE.md`
- **Testing Guide:** `docs/TESTING-GUIDE.md`
- **V2 Rules:** `.cursor/rules/v2-development.mdc`
- **Migration Guide:** `docs/CURSOR-MIGRATION-GUIDE.md`

### Configuration Files

- **Cursor Rules:** `.cursorrules`
- **Agent Manifest:** `agents/manifest.yaml`
- **GDD Config:** `.gddrc.json`
- **Package:** `package.json`
- **Environment:** `.env.example`

---

## 8. 🔄 Maintenance

**Última revisión completa:** 2025-12-03  
**Próxima revisión:** 2025-01-15

**Responsable de actualización:**

- Cursor rules: Orchestrator agent
- Agent manifest: Product Owner
- Skills: Development team
- Integrations: Integration Specialist

**Proceso de actualización:**

1. Revisar cambios en último mes
2. Actualizar tablas y versiones
3. Verificar status de servicios
4. Confirmar comandos funcionan
5. Commit con prefijo `docs(system):`

---

**Fin del documento**
