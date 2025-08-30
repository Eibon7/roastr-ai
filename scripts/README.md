# Roastr.ai Scripts - Issue 82 Implementation

## Phase 4 CLI Tools & Advanced Features

This directory contains comprehensive CLI tools and utilities for advanced testing, project management, and development workflows.

## 🛠️ CLI Test Runner

The advanced test runner (`scripts/test/runner.js`) provides scope-based test execution with mock mode and platform filtering capabilities.

### Features

- **Enhanced scope-based test organization** - Run tests by functional area with improved categorization
- **Mock mode support** - Enable mocked external services for faster CI execution
- **Extended platform filtering** - Support for 9+ social media platforms including Bluesky, Discord
- **Environment variable validation** - Automatic checking of required env vars per scope
- **JSON output support** - Machine-readable output for automation
- **Enhanced visual feedback** - Color-coded recommendations and status indicators
- **CI optimization** - Special modes for continuous integration
- **Coverage integration** - Generate and validate coverage reports
- **Comprehensive validation** - Verify test setup and configuration

### Available Commands

#### List Test Scopes
```bash
# Using the CLI directly
node scripts/test/runner.js scopes

# Using npm script
npm run test:scopes
```

#### Run Tests by Scope
```bash
# Basic scope execution
node scripts/test/runner.js run auth
node scripts/test/runner.js run workers
node scripts/test/runner.js run billing

# With mock mode (faster execution)
node scripts/test/runner.js run auth --mock-mode

# With platform filtering
node scripts/test/runner.js run services --platform twitter

# CI mode (silent, run in band)
node scripts/test/runner.js run workers --ci --mock-mode

# With coverage
node scripts/test/runner.js run billing --coverage --verbose
```

#### Run All Tests
```bash
# Run all tests across all scopes
node scripts/test/runner.js all

# All tests with mock mode and coverage
node scripts/test/runner.js all --mock-mode --coverage
```

#### List Available Platforms (New in PR #282)
```bash
# List all supported platforms
node scripts/test/runner.js list-platforms

# JSON output for automation
node scripts/test/runner.js list-platforms --json
```

#### Platform Management
```bash
# List available platforms
node scripts/test/runner.js list-platforms

# JSON output for automation
node scripts/test/runner.js list-platforms --json

# Run tests filtered by platform
node scripts/test/runner.js run services --platform instagram
```

#### Validation
```bash
# Validate test setup and configuration
node scripts/test/runner.js validate
```

### Command Options

| Option | Description | Example |
|--------|-------------|---------|
| `--mock-mode` | Enable mocked external services | `--mock-mode` |
| `--platform <name>` | Filter by platform (twitter, instagram, etc.) | `--platform twitter` |
| `--ci` | CI mode (silent, run in band) | `--ci` |
| `--coverage` | Generate coverage report | `--coverage` |
| `--verbose` | Enable verbose output | `--verbose` |

### Test Scopes

| Scope | Description | Patterns |
|-------|-------------|----------|
| `auth` | Authentication & Authorization | `tests/unit/auth/**`, `tests/integration/auth/**` |
| `workers` | Background Workers | `tests/unit/workers/**`, `tests/integration/workers/**` |
| `billing` | Billing & Subscriptions | `tests/unit/routes/billing/**`, `tests/integration/*billing*`, `tests/integration/plan-*`, `tests/integration/stripe*` |
| `services` | Core Services | `tests/unit/services/**` |
| `routes` | API Routes | `tests/unit/routes/**` |
| `integration` | Integration Tests | `tests/integration/**` |

### Supported Platforms (Enhanced in PR #282)

- `twitter` - Twitter/X integration tests
- `youtube` - YouTube integration tests
- `instagram` - Instagram integration tests
- `facebook` - Facebook integration tests
- `discord` - Discord integration tests
- `twitch` - Twitch integration tests
- `reddit` - Reddit integration tests
- `tiktok` - TikTok integration tests
- `bluesky` - Bluesky integration tests

**New Features:**
- 🔶 **Mock mode recommendations** - Visual indicators for optimal test execution
- 🔷 **Real mode recommendations** - When external services are required
- ⚠️ **Environment variable validation** - Automatic checking of required env vars
- 📊 **JSON output support** - Machine-readable platform lists for automation

## 📦 NPM Scripts

### Test Execution Scripts
```bash
# Scope management
npm run test:scopes        # List available test scopes

# CI-optimized test commands (with mock mode)
npm run ci:test:auth       # Authentication tests in CI mode
npm run ci:test:workers    # Background worker tests in CI mode
npm run ci:test:billing    # Billing & subscription tests in CI mode

# Coverage management
npm run coverage:generate  # Generate coverage reports
npm run coverage:check     # Validate coverage thresholds
```

### Advanced Usage Examples

#### Development Workflow
```bash
# Quick feedback during development
npm run test:scopes
node scripts/test/runner.js run auth --mock-mode --verbose

# Pre-commit validation
node scripts/test/runner.js all --mock-mode --coverage
```

#### CI/CD Pipeline
```bash
# Fast CI execution
npm run ci:test:auth
npm run ci:test:workers
npm run ci:test:billing

# Or using the CLI directly
node scripts/test/runner.js run auth --ci --mock-mode
node scripts/test/runner.js run workers --ci --mock-mode
node scripts/test/runner.js run billing --ci --mock-mode
```

#### Platform-Specific Testing
```bash
# Test Twitter integration
node scripts/test/runner.js run services --platform twitter --mock-mode

# Test all platforms
for platform in twitter instagram facebook linkedin tiktok; do
  node scripts/test/runner.js run services --platform $platform --mock-mode
done
```

## 🧪 Test Utilities

### Multi-Tenant Test Utilities (`tests/utils/multiTenantMocks.js`)

Provides reusable mocks for organizations, users, and tenant-scoped data:

```javascript
// Using Jest moduleNameMapper alias (recommended)
const { createMockOrganization, createMockUser, createMultiTenantTestScenario } = require('@tests/utils/multiTenantMocks');

// Alternative: relative path from test file location
// For tests/unit/** files: require('../../utils/multiTenantMocks')
// For tests/integration/** files: require('../utils/multiTenantMocks')

// Create a test organization
const org = createMockOrganization({ plan: 'enterprise', name: 'Test Corp' });

// Create a user within that organization
const user = createMockUser(org.id, { role: 'admin', email: 'admin@testcorp.com' });

// Create a complete test scenario
const scenario = createMultiTenantTestScenario('simple');
```

### Shared Mock Utilities (`tests/utils/sharedMocks.js`)

Provides consistent mocks for core system components:

```javascript
// Using Jest moduleNameMapper alias (recommended)
const { createMockQueueService, createMockShieldService, createMockBillingService } = require('@tests/utils/sharedMocks');

// Alternative: relative path from test file location
// For tests/unit/** files: require('../../utils/sharedMocks')
// For tests/integration/** files: require('../utils/sharedMocks')

// Mock queue service for job processing tests
const queueService = createMockQueueService();

// Mock shield service for content moderation tests
const shieldService = createMockShieldService();

// Mock billing service for payment tests
const billingService = createMockBillingService();
```

## ⚙️ Configuration

### Jest Coverage Thresholds

The project uses tiered coverage thresholds based on component criticality:

- **Global minimum**: 30% (branches, functions, lines, statements)
- **Workers**: 60-70% (critical system components)
- **Shield Service**: 70-80% (security-critical)
- **Billing Routes**: 50-60% (financial impact)
- **Services**: 65-70% (core business logic)

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_MOCK_MODE` | Enable mocked external services | `false` |
| `NODE_ENV` | Environment mode | `development` |

## 🚀 Getting Started

1. **Validate your setup**:
   ```bash
   node scripts/test/runner.js validate
   ```

2. **Explore available scopes**:
   ```bash
   npm run test:scopes
   ```

3. **Run a quick test**:
   ```bash
   node scripts/test/runner.js run auth --mock-mode
   ```

4. **Generate coverage report**:
   ```bash
   node scripts/test/runner.js all --coverage
   ```

## 🔧 Troubleshooting

### Common Issues

1. **Jest not found**: Ensure Jest is installed (`npm install`)
2. **No test files found**: Check that test directories exist and contain `.test.js` files
3. **Mock mode not working**: Verify `ENABLE_MOCK_MODE=true` is set in environment

### Debug Mode

Add `--verbose` to any command for detailed output:
```bash
node scripts/test/runner.js run auth --mock-mode --verbose
```

## 📋 Best Practices

1. **Use mock mode during development** for faster feedback
2. **Run scope-specific tests** when working on particular features
3. **Use platform filtering** when testing social media integrations
4. **Validate setup** after making configuration changes
5. **Generate coverage reports** before committing changes

---

**Issue 82 - Phase 4 CLI Tools & Advanced Features: ✅ COMPLETED**

This implementation provides a comprehensive foundation for Phase 5 integration and e2e testing with scope-based organization, multi-tenant capabilities, and advanced tooling.