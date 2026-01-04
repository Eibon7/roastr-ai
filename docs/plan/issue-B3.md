# B3: Password Recovery Analytics - Event Instrumentation

**Issue:** B3  
**Scope:** Event instrumentation ONLY  
**Status:** Implementation  
**Date:** 2026-01-04

---

## 🎯 Objetivo

Instrumentar eventos de password recovery usando el sistema de analytics existente.

**B3 NO crea:**
- ❌ Endpoints de analytics
- ❌ Agregaciones o métricas
- ❌ Dashboards
- ❌ Tablas nuevas

**B3 SÍ hace:**
- ✅ Emitir eventos según contrato
- ✅ Usar sistema analytics existente

---

## 📋 Eventos a Instrumentar

### Frontend Events

#### `password_recovery_requested`
**Trigger:** Usuario solicita password reset  
**Location:** Frontend (auth UI)

**Payload:**
```javascript
{
  "flow": "password_recovery",
  "feature_flag_state": true,
  "provider": "supabase",
  "request_source": "auth_ui"
}
```

#### `password_recovery_failed` (Frontend)
**Trigger:** Fallo en request de recovery  
**Location:** Frontend (auth UI)

**Payload:**
```javascript
{
  "flow": "password_recovery",
  "reason": "request_failed | feature_disabled | rate_limited | unknown_error",
  "retryable": true,
  "provider": "supabase",
  "feature_flag_state": true
}
```

### Backend Events

#### `password_recovery_token_used`
**Trigger:** Usuario usa token de recovery  
**Location:** Backend (`/api/auth/update-password`)

**Payload:**
```javascript
{
  "flow": "password_recovery",
  "provider": "supabase",
  "token_status": "valid",
  "auth_state": "anonymous"
}
```

#### `password_recovery_failed` (Backend)
**Trigger:** Fallo en uso de token  
**Location:** Backend (`/api/auth/update-password`)

**Payload:**
```javascript
{
  "flow": "password_recovery",
  "reason": "token_invalid | token_expired | request_failed | unknown_error",
  "retryable": false,
  "provider": "supabase",
  "feature_flag_state": true
}
```

---

## 🔒 Privacidad (NO NEGOCIABLE)

❌ **NO incluir:**
- Email (ni hashed, ni masked)
- Token values
- User IDs
- IP addresses
- User agents
- Fingerprints

✅ **Solo datos agregados/categóricos:**
- Flow identifier
- Provider name
- Status codes
- Feature flags state

---

## 📝 Implementation

### Frontend (`public/js/auth.js` o similar)

```javascript
// En función de password reset request
async function requestPasswordReset(email) {
  try {
    // Emit event BEFORE request
    trackEvent('password_recovery_requested', {
      flow: 'password_recovery',
      feature_flag_state: true,
      provider: 'supabase',
      request_source: 'auth_ui'
    });

    const response = await apiCall('/auth/reset-password', 'POST', { email });
    
    return response;
  } catch (error) {
    // Emit failure event
    trackEvent('password_recovery_failed', {
      flow: 'password_recovery',
      reason: determineFailureReason(error),
      retryable: isRetryable(error),
      provider: 'supabase',
      feature_flag_state: true
    });
    
    throw error;
  }
}
```

### Backend (`src/routes/auth.js`)

```javascript
// En POST /api/auth/update-password
router.post('/update-password', async (req, res) => {
  try {
    const { access_token, password } = req.body;
    
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      // Emit failure event
      await trackEvent('password_recovery_failed', {
        flow: 'password_recovery',
        reason: 'token_invalid',
        retryable: false,
        provider: 'supabase',
        feature_flag_state: true
      });
      
      return res.status(400).json({
        success: false,
        error: passwordValidation.errors.join('. ')
      });
    }

    // Emit token used event
    await trackEvent('password_recovery_token_used', {
      flow: 'password_recovery',
      provider: 'supabase',
      token_status: 'valid',
      auth_state: 'anonymous'
    });

    const result = await authService.updatePassword(access_token, password);
    
    res.json({
      success: true,
      message: 'Password updated successfully.',
      data: result
    });
  } catch (error) {
    // Emit failure event
    await trackEvent('password_recovery_failed', {
      flow: 'password_recovery',
      reason: determineBackendFailureReason(error),
      retryable: false,
      provider: 'supabase',
      feature_flag_state: true
    });
    
    logger.error('Password update error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Password update failed'
    });
  }
});
```

---

## ✅ Acceptance Criteria

- [ ] Frontend emite `password_recovery_requested` al solicitar reset
- [ ] Frontend emite `password_recovery_failed` en caso de error
- [ ] Backend emite `password_recovery_token_used` al usar token válido
- [ ] Backend emite `password_recovery_failed` en caso de error
- [ ] Todos los payloads cumplen contrato exacto
- [ ] NO se incluyen datos sensibles (email, IP, tokens)
- [ ] Tests verifican emisión de eventos
- [ ] Tests verifican payloads correctos

---

## 🧪 Testing

**Tests mínimos requeridos:**

```javascript
describe('B3 - Password Recovery Events', () => {
  it('should emit password_recovery_requested on frontend', () => {
    // Verify event is emitted with correct payload
  });

  it('should emit password_recovery_token_used on backend', () => {
    // Verify event is emitted with correct payload
  });

  it('should emit password_recovery_failed with correct reason', () => {
    // Verify failure reasons match contract
  });

  it('should NOT include email in any event', () => {
    // Verify privacy
  });

  it('should NOT include IP in any event', () => {
    // Verify privacy
  });
});
```

---

## 📄 Files to Modify

### Frontend
- `public/js/auth.js` (or auth component)
  - Add event emission in password reset flow

### Backend
- `src/routes/auth.js`
  - Add event emission in `/update-password`
  - Add failure event emission

### Tests
- `tests/unit/events/password-recovery.test.js` (new)
  - Verify event emission
  - Verify payload compliance

---

## ❌ Out of Scope

- Analytics endpoints
- Metrics calculation
- Dashboards
- Aggregations
- New database tables
- Caching strategies
- Rate limiting (beyond existing)

---

**Status:** Ready for implementation  
**Next:** Implement event emission ONLY

