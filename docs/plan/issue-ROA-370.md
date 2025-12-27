# Plan de Implementación: ROA-370 - Auth Infra: Email Provider Setup (Resend + Supabase)

**Issue:** ROA-370  
**Tipo:** type:backend, type:infra  
**Prioridad:** P1 (Auth + Email)  
**Owner:** Backend Dev  
**Fecha:** 2025-12-27

---

## Estado Actual

### Situación Existente

**Email Service (src/services/emailService.js):**
- Usa SendGrid (`@sendgrid/mail`) como proveedor
- Feature flag: `ENABLE_EMAIL_NOTIFICATIONS`
- Templates: Handlebars (.hbs) en `src/templates/emails/`
- Métodos implementados:
  - sendWelcomeEmail
  - sendPasswordResetEmail
  - sendPaymentFailedNotification
  - sendSubscriptionCanceledNotification
  - sendUpgradeSuccessNotification
  - sendDataExportEmail
  - sendAccountDeletionRequestedEmail
  - sendAccountDeletionReminderEmail
  - sendAccountDeletionCompletedEmail
  - sendAccountDeletionCancelledEmail
  - sendExportFileDeletionNotification
  - sendExportFileCleanupNotification

**Variables de entorno actuales:**
```bash
SENDGRID_API_KEY=xxx
SENDGRID_FROM_EMAIL=noreply@roastr.ai
SENDGRID_FROM_NAME=Roastr.ai
SUPPORT_EMAIL=support@roastr.ai
```

**Tests:**
- tests/unit/services/emailService.test.js (mocks SendGrid)
- Multiple workers mock emailService

**Supabase Auth:**
- Actualmente no configurado para usar Resend
- Magic links dependen de configuración SMTP

---

## Objetivos

1. **Migrar de SendGrid a Resend** como proveedor de email oficial para v2
2. **Integrar Resend con Supabase Auth** para magic links y password reset
3. **Mantener compatibilidad** con todos los métodos existentes
4. **Actualizar documentación** GDD y SSOT
5. **Tests pasando** al 100%

---

## Análisis de Dependencias

### Nodos GDD Afectados

**Desde system-map-v2.yaml:**

1. **auth** (línea 573-622)
   - Depende de: billing-integration, workers
   - Requerido por: frontend-user-app, frontend-admin, roasting-engine, shield-engine
   - Subnodos: overview, login-flows, session-management, rate-limiting, error-taxonomy, security
   - **Impacto:** Magic links y password reset usan email

2. **billing-integration** (línea 206-254)
   - Usa emailService para notificaciones de pago
   - **Impacto:** Todas las notificaciones de facturación deben funcionar

3. **integraciones resend** (system-map línea 795-802)
   - Ya declarado como integración oficial v2
   - Status: production
   - Tipo: communication
   - Nodos: billing-integration

### Archivos Afectados

**Código:**
- `src/services/emailService.js` → **Migración completa**
- `.env.example` → Añadir RESEND_API_KEY
- `package.json` → Añadir resend, remover @sendgrid/mail

**Tests:**
- `tests/unit/services/emailService.test.js` → Actualizar mocks
- `tests/unit/workers/BillingWorker.test.js` → Verificar mocks compatibles
- `tests/unit/workers/ExportCleanupWorker.test.js` → Verificar mocks compatibles
- `tests/unit/workers/AccountDeletionWorker.test.js` → Verificar mocks compatibles

**Documentación:**
- `docs/nodes-v2/auth/overview.md` → Actualizar sección email provider
- `docs/SSOT-V2.md` → Verificar sección 11.2 (Environment Variables)
- `docs/system-map-v2.yaml` → Verificar integración resend

---

## Pasos de Implementación

### FASE 1: Investigación y Setup (30 min)

**✅ Task 1.1: Investigar API de Resend**
- Leer docs oficial: https://resend.com/docs/api-reference/introduction
- Comparar con SendGrid API actual
- Verificar soporte de templates (HTML)
- Identificar diferencias en retry logic

**✅ Task 1.2: Instalar dependencias**
```bash
npm install resend@^2.0.0
npm uninstall @sendgrid/mail
```

**✅ Task 1.3: Crear template de migraci

ón**
- Backup actual: `cp src/services/emailService.js src/services/emailService.sendgrid.backup.js`
- Documentar diferencias de API

---

### FASE 2: Migración de EmailService (2-3h)

**✅ Task 2.1: Adaptar EmailService.init()**
```javascript
// ANTES (SendGrid)
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// DESPUÉS (Resend)
const { Resend } = require('resend');
this.resend = new Resend(process.env.RESEND_API_KEY);
```

**✅ Task 2.2: Adaptar EmailService.sendEmail()**
- Mapear estructura de mensaje SendGrid → Resend
- Mantener retry logic con exponential backoff
- Actualizar logs con nuevo provider

**Comparación de APIs:**

| SendGrid | Resend | Notas |
|----------|--------|-------|
| `to` | `to` | ✅ Compatible |
| `from` | `from` | ✅ Compatible |
| `subject` | `subject` | ✅ Compatible |
| `html` | `html` | ✅ Compatible |
| `text` | `text` (opcional) | ✅ Compatible |
| N/A | `tags` | ⚠️ Nueva feature (opcional) |
| N/A | `headers` | ⚠️ Nueva feature (opcional) |

**✅ Task 2.3: Verificar templates Handlebars**
- Resend soporta HTML custom (no requiere cambios en templates)
- Mantener sistema de loadTemplate existente

**✅ Task 2.4: Actualizar getStatus()**
```javascript
getStatus() {
  return {
    configured: this.isConfigured,
    provider: 'Resend', // Cambio aquí
    templatesLoaded: this.templates.size,
    featureFlag: flags.isEnabled('ENABLE_EMAIL_NOTIFICATIONS')
  };
}
```

---

### FASE 3: Configuración Supabase Auth (1h)

**✅ Task 3.1: Configurar SMTP en Supabase**
1. Dashboard Supabase → Authentication → Email Templates
2. Settings → SMTP Settings:
   - Provider: Custom SMTP
   - Host: `smtp.resend.com`
   - Port: `587`
   - Username: `resend`
   - Password: `<RESEND_API_KEY>`
   - Sender email: `noreply@roastr.ai`

**✅ Task 3.2: Verificar templates de Supabase**
- Confirm Email (signup)
- Magic Link
- Change Email Address
- Reset Password

**✅ Task 3.3: Test manual**
```bash
# En Supabase dashboard:
# Authentication → Email Templates → Send test email
```

---

### FASE 4: Tests (2-3h)

**✅ Task 4.1: Actualizar tests/unit/services/emailService.test.js**

**Mocks a actualizar:**
```javascript
// ANTES
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ headers: { 'x-message-id': 'test-id' } }])
}));

// DESPUÉS
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({
        id: 'test-id',
        from: 'noreply@roastr.ai',
        to: 'user@test.com',
        created_at: '2025-12-27T10:00:00Z'
      })
    }
  }))
}));
```

**✅ Task 4.2: Actualizar worker tests**
- BillingWorker.test.js
- ExportCleanupWorker.test.js
- AccountDeletionWorker.test.js
- Verificar que mocks de emailService siguen funcionando

**✅ Task 4.3: Ejecutar tests**
```bash
npm test -- tests/unit/services/emailService.test.js
npm test -- tests/unit/workers/BillingWorker.test.js
npm test -- tests/unit/workers/ExportCleanupWorker.test.js
npm test -- tests/unit/workers/AccountDeletionWorker.test.js
```

**Objetivo:** 100% passing, 0 failing

---

### FASE 5: Documentación GDD (1h)

**✅ Task 5.1: Actualizar docs/nodes-v2/auth/overview.md**

Añadir sección sobre Resend:

```markdown
### Email Provider (Resend)

**v2 Official Provider:** Resend (reemplaza SendGrid de v1)

**Configuración:**
- API Key: `RESEND_API_KEY` (env var)
- From email: `noreply@roastr.ai` (verificado en Resend)
- SMTP para Supabase: `smtp.resend.com:587`

**Casos de uso:**
- Magic Link (Supabase Auth)
- Password Reset (Supabase Auth)
- Email confirmation (Supabase Auth)
- Billing notifications (via EmailService)

**Integración con Supabase:**
- Supabase Auth usa Resend SMTP para envío de emails
- EmailService usa Resend API para emails transaccionales
- Ambos comparten el mismo dominio verificado
```

**✅ Task 5.2: Verificar docs/SSOT-V2.md**

Sección 11.2 (Environment Variables) debe incluir:
```markdown
## 11.2 Environment Variables (contractual names)

### Email Provider (Resend - v2)
```bash
RESEND_API_KEY=re_xxx              # Required: Resend API key
RESEND_FROM_EMAIL=noreply@roastr.ai # Default sender email
SUPPORT_EMAIL=support@roastr.ai     # Support contact email
```

### Legacy (NO USAR EN V2)
```bash
SENDGRID_API_KEY=xxx  # ❌ v1 only - use Resend in v2
```
```

**✅ Task 5.3: Actualizar docs/system-map-v2.yaml**

Verificar integración resend (ya existe en línea 795-802):
```yaml
integrations:
  resend:
    description: Transactional email (v2 only)
    status: production
    type: communication
    nodes:
      - billing-integration
      - auth  # Añadir si no está
    files:
      - src/services/emailService.js
      - apps/backend-v2/src/services/emailService.ts  # Si existe backend-v2
```

**✅ Task 5.4: Actualizar "Agentes Relevantes"**
- docs/nodes-v2/auth/overview.md → Añadir "Backend Dev (ROA-370)"
- docs/nodes-v2/billing.md → Verificar si menciona email

---

### FASE 6: Validación (30 min)

**✅ Task 6.1: Validar estructura v2**
```bash
node scripts/validate-v2-doc-paths.js --ci
```

**✅ Task 6.2: Validar alineación SSOT**
```bash
node scripts/validate-ssot-health.js --ci
```

**✅ Task 6.3: Validar Strong Concepts**
```bash
node scripts/validate-strong-concepts.js --ci
```

**✅ Task 6.4: Validar drift**
```bash
node scripts/check-system-map-drift.js --ci
```

**✅ Task 6.5: Validar GDD runtime**
```bash
node scripts/validate-gdd-runtime.js --full
```

**Esperado:** Todos pasan (exit 0)

---

## Agentes a Usar

**Según detect-triggers.js:**
- **Backend Dev** (implementación EmailService)
- **Test Engineer** (actualización de tests)
- **Guardian** (validación de env vars, security audit)

**Receipts esperados:**
- `docs/agents/receipts/cursor-backend-[timestamp].md`
- `docs/agents/receipts/cursor-test-engineer-[timestamp].md`
- `docs/agents/receipts/cursor-guardian-[timestamp].md`

---

## Validación Final

**Pre-Commit Checklist:**
- [ ] Tests pasando al 100%
- [ ] Validadores GDD pasando
- [ ] No referencias a SendGrid en código v2
- [ ] Variables de entorno documentadas
- [ ] Supabase Auth configurado con Resend
- [ ] Nodos GDD actualizados
- [ ] "Agentes Relevantes" actualizado

**Pre-Push Checklist:**
- [ ] Rama correcta: `feature/ROA-370-email-provider-setup`
- [ ] `.issue_lock` presente con rama correcta
- [ ] No archivos fuera de scope
- [ ] Commit message: `fix(ROA-370): Migrate email provider from SendGrid to Resend`

---

## Riesgos y Mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Resend API difiere de SendGrid | Media | Medio | Revisar docs oficial, crear wrapper compatible |
| Templates no funcionan igual | Baja | Bajo | Resend soporta HTML custom, mantener Handlebars |
| Supabase SMTP config falla | Media | Alto | Test manual en dashboard, verificar credenciales |
| Tests rotos por cambio de API | Alta | Medio | Actualizar mocks, ejecutar suite completa |
| Rate limits Resend diferentes | Baja | Bajo | Verificar docs, implementar retry logic |

---

## Referencias

**Documentación externa:**
- Resend API: https://resend.com/docs/api-reference/introduction
- Resend with Supabase: https://resend.com/docs/send-with-supabase-auth
- Supabase SMTP: https://supabase.com/docs/guides/auth/auth-smtp

**Documentación interna:**
- SSOT v2: `docs/SSOT-V2.md` (sección 11.2)
- Auth node: `docs/nodes-v2/auth/overview.md`
- System-map: `docs/system-map-v2.yaml` (línea 795-802)
- CodeRabbit lessons: `docs/patterns/coderabbit-lessons.md`

---

**Creado:** 2025-12-27  
**Owner:** Backend Dev  
**Status:** In Progress  
**Worktree:** ../roastr-ai-worktrees/ROA-370

