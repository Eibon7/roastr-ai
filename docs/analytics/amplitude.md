# Amplitude Analytics - Roastr.AI (Unified Guide)

**Version:** 2.0  
**Last Updated:** 2025-12-15  
**Status:** ✅ Production Ready

---

## 📊 Overview

This document provides a complete guide for using Amplitude Analytics across Roastr.AI's frontend and backend-v2 applications.

### Key Features

- ✅ **Frontend**: Web SDK with autocapture
- ✅ **Backend v2**: Node SDK with TypeScript support
- ✅ **GDPR Compliant**: EU server zone
- ✅ **Type-Safe**: Full TypeScript support
- ✅ **Tested**: 100% test coverage with mocks
- ✅ **V2-Ready**: snake_case events, standard properties

---

## 🎯 Event Naming Convention (MANDATORY)

**All events MUST use `snake_case`:**

### ✅ CORRECT
```typescript
'auth_login_success'
'roast_generated'
'account_connected'
'plan_upgraded'
```

### ❌ INCORRECT
```typescript
'User Logged In'  // Spaces
'RoastGenerated'  // PascalCase
'account-connected'  // kebab-case
```

---

## 🔧 Setup

### Frontend Setup

#### 1. Install Dependencies
```bash
cd frontend
npm install  # @amplitude/unified already installed
```

#### 2. Configure Environment
```bash
cp .env.example .env
# Add: VITE_AMPLITUDE_API_KEY=your_key_here
```

#### 3. Initialize (Automatic)
Amplitude initializes automatically when the app loads (`src/main.tsx`).

#### 4. Usage
```typescript
import { amplitude } from '@/lib/analytics';

// Track event
amplitude.track('auth_login_success', {
  method: 'email_password',
  redirect_to: '/app'
});
```

---

### Backend v2 Setup

#### 1. Install Dependencies
```bash
cd apps/backend-v2
npm install  # @amplitude/analytics-node already installed
```

#### 2. Configure Environment
```bash
cp .env.example .env
# Add: AMPLITUDE_API_KEY=your_key_here
```

#### 3. Initialize at Startup
```typescript
// src/index.ts or main entry point
import { initializeAmplitude } from './lib/analytics';

// Initialize once at application startup
initializeAmplitude();
```

#### 4. Usage
```typescript
import { trackEvent } from './lib/analytics';

// Track event with standard properties
trackEvent({
  userId: 'user_123',
  event: 'roast_generated',
  properties: {
    tone: 'canalla',
    platform: 'twitter',
    character_count: 280,
  },
  context: {
    flow: 'roasting',
    request_id: 'req_xyz',
  },
});
```

---

## 📝 Standard Properties

### Automatically Injected by Backend

Every event tracked from backend automatically includes:

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `env` | string | Environment | `development`, `staging`, `production` |
| `source` | string | Origin of event | `backend-v2`, `frontend` |
| `app_version` | string | Application version | `2.0.0` |
| `flow` | string | Business flow | `auth`, `roasting`, `ingestion` |
| `request_id` | string | Request trace ID | `req_abc123` |

### Frontend Standard Properties

Frontend events should include similar context:

```typescript
amplitude.track('event_name', {
  // Your custom properties
  property1: 'value1',
  
  // Recommended standard properties
  flow: 'auth',  // or 'roasting', 'settings', etc.
  // env and source are handled by analytics.ts
});
```

---

## 🎯 Event Catalog

### Authentication Events

#### `auth_login_success`
**When:** User successfully logs in  
**Properties:**
- `method`: `'email_password'` | `'demo_mode'` | `'magic_link'` | `'oauth'`
- `redirect_to`: string (destination route)
- `user_type`?: `'demo_admin'` (for demo mode)

**Example:**
```typescript
// Frontend
amplitude.track('auth_login_success', {
  method: 'email_password',
  redirect_to: '/app'
});

// Backend
trackEvent({
  userId: user.id,
  event: 'auth_login_success',
  properties: { method: 'email_password' },
  context: { flow: 'auth', request_id }
});
```

---

#### `auth_login_failed`
**When:** Login attempt fails  
**Properties:**
- `method`: string
- `error`: string (error message)

---

#### `auth_register_success`
**When:** User completes registration  
**Properties:**
- `method`: string
- `plan`: string (initial plan)

---

#### `auth_magic_link_requested`
**When:** User requests magic link  
**Properties:**
- `email_domain`: string

---

### Roast Generation Events

#### `roast_generated`
**When:** A roast is successfully generated  
**Properties:**
- `tone`: `'flanders'` | `'balanceado'` | `'canalla'` | `'personal'`
- `platform`: `'twitter'` | `'instagram'` | `'facebook'` | etc.
- `character_count`: number
- `generation_time_ms`: number
- `model`: string (AI model used)

**Example:**
```typescript
trackEvent({
  userId: user.id,
  event: 'roast_generated',
  properties: {
    tone: 'canalla',
    platform: 'twitter',
    character_count: 280,
    generation_time_ms: 1234,
    model: 'gpt-4',
  },
  context: {
    flow: 'roasting',
    request_id,
  },
});
```

---

#### `roast_posted`
**When:** Roast is published to social platform  
**Properties:**
- `platform`: string
- `manual_edit`: boolean
- `auto_post`: boolean

---

#### `roast_rejected`
**When:** Roast is rejected by Shield  
**Properties:**
- `rejection_reason`: string
- `toxicity_score`: number
- `platform`: string

---

### Social Account Events

#### `account_connected`
**When:** User connects a social account  
**Properties:**
- `platform`: string
- `account_type`: `'personal'` | `'business'`

---

#### `account_disconnected`
**When:** User disconnects account  
**Properties:**
- `platform`: string
- `reason`: `'user_action'` | `'revoked'` | `'error'`

---

### Billing Events

#### `plan_upgraded`
**When:** User upgrades subscription  
**Properties:**
- `from_plan`: string
- `to_plan`: string
- `payment_frequency`: `'monthly'` | `'yearly'`
- `amount`: number

---

#### `plan_downgraded`
**When:** User downgrades subscription  
**Properties:**
- `from_plan`: string
- `to_plan`: string
- `reason`: string

---

#### `subscription_cancelled`
**When:** User cancels subscription  
**Properties:**
- `plan`: string
- `reason`: string
- `feedback`?: string

---

### Settings Events

#### `persona_updated`
**When:** User updates persona configuration  
**Properties:**
- `has_encryption`: boolean
- `field_count`: number

---

#### `tone_preference_changed`
**When:** User changes default tone  
**Properties:**
- `tone`: string
- `previous_tone`?: string

---

### General Events

#### `cta_click`
**When:** User clicks a call-to-action  
**Properties:**
- `cta_name`: string
- `cta_location`: string (page/component)

---

#### `form_submit`
**When:** User submits a form  
**Properties:**
- `form_name`: string
- `form_location`: string

---

## 🧪 Testing

### Frontend Tests

```bash
cd frontend
npm test -- src/lib/__tests__/analytics.test.ts
```

**Coverage:** 4/4 tests passing

---

### Backend v2 Tests

```bash
cd apps/backend-v2
npm test -- tests/unit/lib/analytics.test.ts
```

**Coverage:** 11/11 tests passing

---

### Test Environment Behavior

- **Frontend**: `VITE_AMPLITUDE_API_KEY` mocked in `vitest.config.ts`
- **Backend**: Analytics disabled when `NODE_ENV=test`
- **No Real API Calls**: All Amplitude calls are mocked in tests
- **CI/CD**: Tests run with mocks, never hit Amplitude servers

---

## 🔒 Privacy & GDPR

### Data Protection

1. **Server Zone**: EU (data stored in European servers)
2. **No PII by Default**: Autocapture doesn't capture input values
3. **User Consent**: Consider implementing opt-out if required
4. **Session Replay**: Enabled, but doesn't capture sensitive input values

### What We Track

✅ **We DO track:**
- User interactions (clicks, form submissions)
- Navigation (page views, route changes)
- Feature usage
- Performance metrics

❌ **We DON'T track:**
- Input field values (passwords, emails, personal data)
- Payment information
- API keys or secrets

---

## 🚀 Best Practices

### DO ✅

1. **Use snake_case** for all event names
2. **Include standard properties** (`flow`, `request_id`)
3. **Track meaningful business events** (not every click)
4. **Use descriptive property names**
5. **Keep properties consistent** across similar events
6. **Test events** before deploying to production

### DON'T ❌

1. **Don't use spaces or PascalCase** in event names
2. **Don't track PII** without proper consent
3. **Don't create duplicate events** (check catalog first)
4. **Don't hardcode API keys** (use environment variables)
5. **Don't track in test environment** (mocks only)
6. **Don't block business logic** if Amplitude fails

---

## 🔧 Troubleshooting

### Frontend: Events Not Appearing

**Check:**
1. `VITE_AMPLITUDE_API_KEY` is set in `.env`
2. Console shows: `[Amplitude] Analytics initialized successfully`
3. Network tab shows requests to Amplitude API
4. Event names use `snake_case`

---

### Backend: Events Not Sending

**Check:**
1. `AMPLITUDE_API_KEY` is set in backend `.env`
2. `initializeAmplitude()` called at startup
3. Console shows: `[Amplitude] Backend v2 analytics initialized successfully`
4. `NODE_ENV !== 'test'`
5. No error messages in console

---

### Common Issues

**"Missing API Key" Warning**
- Solution: Add `AMPLITUDE_API_KEY` to `.env` file

**"Not initialized" Warning**
- Solution: Call `initializeAmplitude()` at app startup

**Events Not in Dashboard**
- Wait 1-2 minutes for processing
- Check event name matches catalog (snake_case)
- Verify API key is correct

---

## 📚 References

- **Amplitude Docs**: https://www.docs.developers.amplitude.com/
- **Frontend Implementation**: `frontend/src/lib/analytics.ts`
- **Backend Implementation**: `apps/backend-v2/src/lib/analytics.ts`
- **Event Catalog**: This document (sections above)

---

## 🔗 Related Documentation

- `docs/AMPLITUDE_ANALYTICS.md` - Frontend-specific docs (legacy)
- `.env.example` files - Environment variable templates
- `vitest.config.ts` - Test configuration

---

**Questions or issues?** Open an issue on GitHub or contact the team.

**Last Review:** 2025-12-15  
**Reviewers:** Roastr.AI Team  
**Status:** ✅ Production Ready

