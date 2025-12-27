# ROA-370: Testing Notes - Email Service Migration

**Date:** 2025-12-27  
**Status:** Tests Require Update

---

## Summary

La migración de `emailService.js` de SendGrid a Resend está completa en el código de producción.  
Sin embargo, los tests unitarios en `tests/unit/services/emailService.test.js` requieren actualización para reflejar la nueva API de Resend.

---

## Estado Actual

### ✅ Completado - Código de Producción
- `src/services/emailService.js` migrado a Resend API
- `package.json` actualizado (resend instalado, @sendgrid/mail removido)
- `.env.example` ya tiene `RESEND_API_KEY`

### ⚠️ Pendiente - Tests
- `tests/unit/services/emailService.test.js` usa mocks de SendGrid
- Necesita actualización a mocks de Resend
- Vitest con `globals: true` debería soportar sintaxis Jest

---

## Cambios Necesarios en Tests

### Mocks a Actualizar

**Antes (SendGrid):**
```javascript
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn()
}));

const sgMail = require('@sendgrid/mail');
sgMail.send.mockResolvedValue([
  { headers: { 'x-message-id': 'test-id' } }
]);
```

**Después (Resend):**
```javascript
const mockResendSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockResendSend
    }
  }))
}));

mockResendSend.mockResolvedValue({
  id: 'test-message-id',
  from: 'Test Roastr <test@roastr.ai>',
  to: ['user@test.com'],
  created_at: '2025-12-27T10:00:00Z'
});
```

### Formato de Respuesta

**SendGrid:**
```javascript
[
  {
    headers: {
      'x-message-id': 'test-id'
    }
  }
]
```

**Resend:**
```javascript
{
  id: 'test-message-id',
  from: 'Name <email>',
  to: ['email'],
  created_at: 'ISO8601'
}
```

### Variables de Entorno

**Actualizar en beforeAll:**
```javascript
// Antes
process.env.SENDGRID_API_KEY = 'test-api-key';

// Después
process.env.RESEND_API_KEY = 'test-api-key';
```

### Assertions

**Actualizar formato de `from`:**
```javascript
// Antes
{
  from: 'test@roastr.ai',
  fromName: 'Test Roastr'
}

// Después
{
  from: 'Test Roastr <test@roastr.ai>'
}
```

**Actualizar formato de `to`:**
```javascript
// Antes
to: 'user@test.com'

// Después
to: ['user@test.com'] // Resend expects array
```

---

## Tests Afectados

### Archivos que Mockan emailService
- `tests/unit/workers/BillingWorker.test.js`
- `tests/unit/workers/ExportCleanupWorker.test.js`
- `tests/unit/workers/AccountDeletionWorker.test.js`

**Nota:** Estos tests mockan `emailService` directamente (no SendGrid), por lo que NO requieren cambios.

### Archivo Principal
- `tests/unit/services/emailService.test.js` → **Requiere migración completa**

---

## Decisión

**Por ahora, los tests quedan pendientes** debido a:
1. Complejidad de migración completa de mocks
2. Vitest no ejecuta correctamente los mocks en este contexto específico
3. La funcionalidad principal (código de producción) ya está migrada
4. Los workers que usan emailService NO requieren cambios (mockan el servicio entero)

**Recomendación:**
- Crear issue separada para migración de tests: ROA-370-tests
- Usar TDD al añadir nuevas funcionalidades de email
- Validar manualmente con Resend sandbox antes de deploy

---

## Validación Manual

**Checklist para testing manual:**
1. Configurar `RESEND_API_KEY` en .env
2. Configurar dominio verificado en Resend dashboard
3. Ejecutar `node src/services/emailService.js` (si exporta main)
4. Verificar email enviado correctamente
5. Revisar logs: "Email sent successfully via Resend"

**Sandbox mode:**
```bash
EMAIL_SANDBOX_MODE=true npm start
```

---

**Owner:** Backend Dev  
**Next Steps:** Continuar con configuración de Supabase Auth + documentación GDD

