# Scripts and CLI Tools Documentation

This directory contains various scripts and CLI tools for Roastr.ai development, testing, and operations. This document provides comprehensive documentation for all available tools and their usage.

## 📋 Table of Contents

- [Test CLI Runner](#test-cli-runner)
- [Lint & Typecheck](#lint--typecheck)
- [Development Scripts](#development-scripts)
- [Administrative Tools](#administrative-tools)
- [Coverage and Analysis](#coverage-and-analysis)
- [Deployment Tools](#deployment-tools)

## 🧪 Test CLI Runner

### Overview

The advanced CLI test runner (`scripts/test/runner.js`) provides sophisticated test execution with scope filtering, platform support, and mock mode capabilities. This is part of Issue #277 implementation.

### Installation

Make the runner executable:
```bash
chmod +x scripts/test/runner.js
```

### Basic Usage

#### List Available Scopes
```bash
node scripts/test/runner.js list-scopes
```

#### Run Tests by Scope
```bash
# Basic unit tests in mock mode (recommended)
node scripts/test/runner.js run unit --mock-mode

# Integration tests in real mode  
node scripts/test/runner.js run integration

# All tests with coverage
node scripts/test/runner.js run all --coverage --mock-mode
```

### Available Test Scopes

| Scope | Description | Mock Mode | Special Requirements |
|-------|-------------|-----------|---------------------|
| 🔶 `unit` | Run unit tests only | ✅ Recommended | None |
| 🔷 `integration` | Run integration tests only | ❌ Real mode better | Database required |
| 🔶 `smoke` | Run smoke tests only | ✅ Recommended | None |
| 🔶 `routes` | Run API route tests | ✅ Recommended | None |
| 🔶 `services` | Run service layer tests | ✅ Recommended | None |
| 🔶 `workers` | Run background worker tests | ✅ Recommended | None |
| 🔶 `middleware` | Run middleware tests | ✅ Recommended | None |
| 🔶 `billing` | Run billing and payment tests | ✅ Recommended | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| 🔶 `security` | Run security and auth tests | ✅ Recommended | None |
| 🔷 `all` | Run all tests | ❌ Mixed mode | All requirements |

**Legend:**
- 🔶 Mock mode recommended for speed
- 🔷 Real mode recommended for accuracy

### Command Options

#### Core Options
```bash
--mock-mode              # Enable mock mode for faster execution
--platform <platform>    # Filter tests by platform
--coverage               # Generate coverage report
--verbose                # Enable verbose output
--silent                 # Run in silent mode
--ci                     # Run in CI mode (no watch)
--run-in-band            # Run tests serially
--test-timeout <ms>      # Test timeout in milliseconds (default: 10000)
```

#### Coverage Options
```bash
--coverage-reporters <reporters>  # Coverage reporters (default: text,html)
                                 # Available: text, html, json, lcov, json-summary
```

### Platform Filtering and Listing

Filter tests by specific social media platforms:

```bash
# Test only Twitter-related functionality
node scripts/test/runner.js run services --platform twitter --mock-mode

# Test YouTube integration
node scripts/test/runner.js run integration --platform youtube

# Available platforms: twitter, youtube, instagram, facebook, discord, twitch, reddit, tiktok, bluesky

# List available platforms
node scripts/test/runner.js list-platforms

# JSON output (for CI)
node scripts/test/runner.js list-platforms --json
```

### Mock Mode vs Real Mode

#### Mock Mode (`--mock-mode`)
- ✅ **Fast execution** - No external API calls
- ✅ **Reliable** - No network dependencies  
- ✅ **CI friendly** - Consistent results
- ✅ **Cost effective** - No API usage costs
- ❌ **Limited scope** - May miss integration issues

**When to use:** Unit tests, CI/CD, development, most scenarios

#### Real Mode (default)
- ✅ **Comprehensive** - Tests real integrations
- ✅ **Accurate** - Catches real-world issues
- ❌ **Slow** - Network latency and API calls
- ❌ **Flaky** - Network and service dependencies
- ❌ **Costly** - Uses real API quotas

**When to use:** Integration testing, pre-deployment validation

### Practical Examples

#### Development Workflow
```bash
# Quick unit test during development
node scripts/test/runner.js run services --mock-mode --platform twitter

# Full test suite before commit
node scripts/test/runner.js run all --coverage --mock-mode --ci

# Integration testing before deployment  
node scripts/test/runner.js run integration --verbose
```

#### CI/CD Pipeline
```bash
# Fast CI test run
node scripts/test/runner.js run all --mock-mode --ci --coverage --silent

# Platform-specific testing
node scripts/test/runner.js run services --platform youtube --mock-mode --ci
```

#### Debugging Tests
```bash
# Verbose output for debugging
node scripts/test/runner.js run unit --verbose --mock-mode

# Single test scope with detailed output
node scripts/test/runner.js run billing --verbose --test-timeout 30000
```

## 🧹 Lint & Typecheck

As part of Issue #277, the runner also supports linting and type checking tasks.

### Lint

```bash
# Run ESLint on backend src/ and tests/
node scripts/test/runner.js lint

# Auto-fix simple issues
node scripts/test/runner.js lint --fix

# Via npm script
npm run lint:runner
```

### Typecheck

Runs TypeScript type checking (`tsc --noEmit`) when a `tsconfig.json` is present in the repository root or in `frontend/`.

```bash
# Run typecheck (skips gracefully if no tsconfig.json)
node scripts/test/runner.js typecheck

# Via npm script
npm run typecheck
```

### Combined Check

Runs lint first, then typecheck.

```bash
# Lint + Typecheck
node scripts/test/runner.js check

# With auto-fix for lint
node scripts/test/runner.js check --fix

# Via npm script
npm run check
```

## 🧩 Multi-Tenant Mocks

The helpers in `tests/helpers/testUtils.js` support configurable multi-tenant scenarios for robust testing across plans and organizations.

### Presets

- simple: Baseline organization with defaults
- freeTier: Free plan constraints (1 platform, limited features)
- plus: Mid-tier between free and pro (limited platforms, shield enabled)
- pro: Professional plan with enhanced limits
- agency: Multi-seat, higher quotas (teamSeats ≈ 25)
- enterprise: Full features, strict moderation, many platforms
- multiUser: Organization with additional users and role-based access
- suspended: Suspended org/user to test restricted flows

### Configuration Options

- planType: `free | plus | pro | agency | enterprise`
- userRole: `user | admin`
- platforms: e.g. `['twitter','youtube']`
- isActive, suspended, suspendedReason
- entitlements: `{ monthlyResponsesLimit, integrationsLimit, shieldEnabled, ... }`
- usage overrides: `{ roastsThisMonth, limit, currentSpend, tokensUsed }`
- quotaScenario: `'near' | 'over' | null` (simulate near/over limits)

### Examples

```js
const { createMultiTenantTestScenario, createMultiTenantMocks } = require('../tests/helpers/testUtils');

// Agency org with near-limit usage on two platforms
const scenario = createMultiTenantTestScenario('agency', {
  platforms: ['twitter', 'youtube'],
  quotaScenario: 'near'
});
const db = createMultiTenantMocks(scenario);

// Pro org over limit with custom entitlements
const overLimit = createMultiTenantTestScenario('pro', {
  entitlements: { monthlyResponsesLimit: 300 },
  usage: { roastsThisMonth: 310 },
  quotaScenario: 'over'
});
```

### Usage Helpers

`createMultiTenantMocks(scenario)` exposes:
- getUserById, getUsersByOrg
- getOrganizationById, getOrgSettings
- getPlatformsByOrg
- getUsageStats: includes `isNearLimit` and `isOverLimit`

## 🔗 Coverage & Runner

Coverage thresholds live in `jest.config.js`. Use the CLI runner to filter by scope/platform during development and CI. For CI parsing, add `--json` to `run`, `lint`, `typecheck`, or `check` to print a summary JSON.

### Environment Variables Required

#### Billing Tests
```bash
export STRIPE_SECRET_KEY="sk_test_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
export STRIPE_SUCCESS_URL="http://localhost:3000/success"
export STRIPE_CANCEL_URL="http://localhost:3000/cancel"
export STRIPE_PORTAL_RETURN_URL="http://localhost:3000/billing"
```

#### General Testing
```bash
export ENABLE_MOCK_MODE="true"  # Automatically set by --mock-mode
export NODE_ENV="test"
export OPENAI_API_KEY="sk-..."  # For real mode testing
```

### Troubleshooting

#### Common Issues

**Missing Environment Variables:**
```bash
❌ Missing required environment variables for scope 'billing':
   - STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET

💡 Tip: Set these variables in your .env file or use --mock-mode
```

**Invalid Scope:**
```bash
❌ Invalid scope: invalidscope

💡 Use --list-scopes to see available options
```

**Platform Not Found:**
```bash  
❌ Invalid platform: invalidplatform. Available: twitter, youtube, instagram...
```

#### Performance Tips

1. **Use Mock Mode for Development:**
   ```bash
   node scripts/test/runner.js run unit --mock-mode  # Fast
   ```

2. **Run Tests in Parallel (default):**
   ```bash
   # Parallel execution (faster)
   node scripts/test/runner.js run services --mock-mode
   
   # Serial execution (slower but more stable)  
   node scripts/test/runner.js run services --run-in-band
   ```

3. **Optimize Coverage Generation:**
   ```bash
   # Text summary only (fast)
   node scripts/test/runner.js run unit --coverage --coverage-reporters text
   
   # Full HTML report (slower)
   node scripts/test/runner.js run unit --coverage --coverage-reporters html,text
   ```

## 🛠 Development Scripts

### Test Users Management
```bash
# Create test users for development (Issue #237)
npm run setup:test-users          # Create admin and test users
npm run setup:test-users:dry      # Preview what will be created
```

### Coverage Analysis
```bash
npm run coverage:analyze          # Analyze test coverage gaps
npm run coverage:report           # Generate coverage report  
npm run coverage:full             # Full coverage analysis
```

### Documentation Generation
```bash
npm run docs:generate             # Generate docs from tests
npm run docs:update               # Run tests + generate docs
```

## 🔧 Administrative Tools

### Admin Setup
```bash
npm run admin:setup               # Setup admin users
npm run admin:list                # List admin users
```

### User Management
```bash
npm run users:list                # List all users
npm run users:create              # Create new user
npm run users:delete              # Delete user
npm run users:search              # Search users
npm run users:stats               # User statistics
npm run users:health              # User system health
```

### Log Management
```bash
npm run logs:stats                # Log statistics
npm run logs:cleanup              # Clean up old logs
npm run logs:cleanup:dry          # Preview cleanup
npm run logs:backup               # Backup logs
npm run logs:backup:list          # List backups
npm run logs:backup:cleanup       # Clean up backups
```

## 📊 Coverage and Analysis

### Coverage Thresholds (jest.config.js)

| Component | Branches | Functions | Lines | Statements | Reason |
|-----------|----------|-----------|-------|------------|---------|
| **Global** | 35% | 40% | 40% | 40% | Baseline coverage |
| **Workers** | 60% | 70% | 70% | 70% | Critical system role |
| **Billing** | 50% | 60% | 60% | 60% | Financial impact |
| **Services** | 65% | 70% | 70% | 70% | Core business logic |
| **Shield Service** | 70% | 80% | 80% | 80% | Security role |
| **Toxicity Worker** | 60% | 60% | 60% | 60% | Moderation critical |

### Multi-Tenant Test Utilities

The enhanced test utilities (Issue #277) provide comprehensive multi-tenant testing capabilities:

#### Available Test Scenarios

```javascript
const { createMultiTenantTestScenario } = require('../tests/helpers/testUtils');

// Simple scenario (default)
const simple = createMultiTenantTestScenario('simple', {
  planType: 'free',
  userRole: 'user', 
  platforms: ['twitter']
});

// Enterprise scenario
const enterprise = createMultiTenantTestScenario('enterprise', {
  planType: 'enterprise',
  userRole: 'admin',
  platforms: ['twitter', 'youtube', 'instagram']
});

// Pro scenario
const pro = createMultiTenantTestScenario('pro', {
  planType: 'pro',
  platforms: ['twitter', 'youtube']
});

// Free tier limitations
const freeTier = createMultiTenantTestScenario('freeTier');

// Multi-user organization  
const multiUser = createMultiTenantTestScenario('multiUser', {
  planType: 'pro'
});

// Suspended account
const suspended = createMultiTenantTestScenario('suspended');
```

#### Mock Database Integration

```javascript
const { createMultiTenantMocks } = require('../tests/helpers/testUtils');

const scenario = createMultiTenantTestScenario('enterprise');
const mockDb = createMultiTenantMocks(scenario);

// Use in tests
mockDb.getUserById('user123');  // Returns scenario user
mockDb.getOrgSettings('org456'); // Returns scenario org settings
```

#### Platform-Specific Mock Data

```javascript
const { createPlatformMockData } = require('../tests/helpers/testUtils');

// Generate Twitter mock data
const twitterData = createPlatformMockData('twitter', {
  count: 10,
  toxicityLevel: 'high'
});

// Generate YouTube mock data
const youtubeData = createPlatformMockData('youtube', {
  count: 5,
  toxicityLevel: 'moderate'
});
```

## 🚀 Deployment Tools

### API Readiness Validation
```bash
node scripts/validate-api-readiness.js    # Validate API configuration
```

### Production Deployment Checklist
```bash
node scripts/production-deployment-checklist.js    # Pre-deployment checks
```

### Staging Tests
```bash
node scripts/test-staging-plan-limits.js    # Test plan limits in staging
```

### Price Validation
```bash
npm run validate:prices                     # Validate Stripe prices
npm run validate:prices:ci                  # CI price validation
```

## ⚠️ Important Warnings

### Security Considerations

1. **Never commit real API keys** to version control
2. **Use mock mode for CI/CD** to avoid API quota usage
3. **Validate environment variables** before running billing tests
4. **Review test data** to ensure no PII in mock data

### Performance Considerations

1. **Mock mode is ~10x faster** than real mode for unit tests
2. **Serial execution** (`--run-in-band`) is more stable but slower
3. **Coverage generation** adds ~20% overhead
4. **Integration tests** should use real mode when possible

### CI/CD Best Practices

```yaml
# Example GitHub Actions workflow
- name: Run Fast Tests  
  run: node scripts/test/runner.js run all --mock-mode --ci --coverage --silent

- name: Run Critical Integration Tests
  run: node scripts/test/runner.js run security --verbose
  if: github.event_name == 'pull_request'
```

## 📝 Contributing

When adding new scripts or modifying existing ones:

1. **Update this documentation** with usage examples
2. **Add proper error handling** and user-friendly messages
3. **Include help text** and command descriptions
4. **Test both mock and real modes** where applicable
5. **Add environment variable validation** for external dependencies

## 🔄 Issue References

- **Issue #277**: Complete CLI tools implementation
- **Issue #237**: Test users management
- **Issue #82**: Phase 4 CLI Tools & Advanced Features (original)

## 📞 Support

For questions about these tools or to report issues:

1. Check this documentation first
2. Run commands with `--help` flag for quick reference
3. Use `--verbose` flag for debugging information
4. Review error messages for specific guidance

---

*This documentation is part of Issue #277 implementation and covers all CLI tools and scripts available in the Roastr.ai project.*
