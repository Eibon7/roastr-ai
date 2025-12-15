# Backend v2 - Roastr.AI

Clean architecture backend with TypeScript and SSOT-driven configuration.

## 🚀 Quick Start

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your AMPLITUDE_API_KEY

# Run tests
npm test

# Start dev server
npm run dev
```

## 📊 Amplitude Analytics

Amplitude is integrated and ready to use. The SDK initializes automatically on application startup.

### Usage Example

```typescript
import { trackEvent } from './lib/analytics';

// Track an event
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

### Standard Properties

All events automatically include:
- `env`: Current environment (development, staging, production)
- `source`: Always "backend-v2"
- `app_version`: Application version
- `flow`: Business flow (from context)
- `request_id`: Request trace ID (from context)

### Documentation

- **Full Guide**: `../../docs/analytics/amplitude.md`
- **Implementation**: `src/lib/analytics.ts`
- **Tests**: `tests/unit/lib/analytics.test.ts`

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test:coverage

# Run specific test file
npm test -- tests/unit/lib/analytics.test.ts
```

**Test Results:**
- ✅ 25/25 tests passing
- ✅ 100% coverage on analytics module

## 📝 Event Naming Convention

**ALWAYS use snake_case:**

✅ CORRECT:
- `auth_login_success`
- `roast_generated`
- `account_connected`

❌ INCORRECT:
- `User Logged In` (spaces)
- `RoastGenerated` (PascalCase)

See `../../docs/analytics/amplitude.md` for full event catalog.

## 🔧 Configuration

### Environment Variables

Required:
- `AMPLITUDE_API_KEY`: Amplitude project API key
- `NODE_ENV`: Environment (development, staging, production, test)
- `APP_VERSION`: Application version (default: 2.0.0)

Optional:
- `PORT`: Server port (default: 3002)

### Analytics Behavior

- **Production**: Full tracking enabled
- **Development**: Tracking enabled with console logs
- **Test**: Analytics disabled, all calls mocked

## 📦 Project Structure

```
apps/backend-v2/
├── src/
│   ├── lib/
│   │   ├── analytics.ts       # Amplitude integration
│   │   └── loadSettings.ts    # SSOT configuration
│   ├── routes/
│   │   └── settings.ts        # Settings API
│   ├── config/
│   │   └── admin-controlled.yaml
│   └── index.ts               # Main entry point
├── tests/
│   └── unit/
│       └── lib/
│           ├── analytics.test.ts
│           └── loadSettings.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .env.example
```

## 🔗 Related

- **Frontend**: `../../frontend/`
- **Documentation**: `../../docs/analytics/`
- **Unified Analytics Guide**: `../../docs/analytics/amplitude.md`

## ⚡ Development

```bash
# Watch mode (auto-reload)
npm run dev

# Build TypeScript
npm run build

# Type checking
tsc --noEmit
```

## 🎯 Features

- ✅ TypeScript with strict mode
- ✅ Amplitude Analytics integrated
- ✅ SSOT-driven configuration
- ✅ Full test coverage
- ✅ ES Modules support
- ✅ Type-safe event tracking

---

**Version:** 2.0.0  
**Node Version:** >=18.0.0  
**Last Updated:** 2025-12-15

