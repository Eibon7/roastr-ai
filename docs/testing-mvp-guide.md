# Testing MVP Guide - Issue #403

## Overview

This guide covers the comprehensive testing suite for Roastr AI MVP, implementing the "Camino de baldosas amarillas (v2)" approach to validate all critical system flows.

## Test Structure

### Test Categories

1. **E2E Tests** (`tests/e2e/`) - End-to-end user flows
2. **Integration Tests** (`tests/integration/`) - Component integration validation  
3. **Unit Tests** (`tests/unit/`) - Individual component testing

### Priority Levels

- **P0** (Critical) - Must pass for production readiness
- **P1** (Important) - Required for stability and observability
- **P2** (Nice-to-have) - Code quality and polish

## Running Tests

### Quick Start

```bash
# Run complete MVP test suite
npm run test:mvp

# Run by category
npm run test:mvp:e2e          # End-to-end tests
npm run test:mvp:integration  # Integration tests  
npm run test:mvp:unit        # Unit tests

# Generate coverage report
npm run test:mvp:coverage

# Watch mode for development
npm run test:mvp:watch

# CI/CD mode
npm run test:mvp:ci
```

### Environment Setup

Tests require these environment variables:

```bash
# Core configuration
NODE_ENV=test
ENABLE_MOCK_MODE=true

# Database (dummy values for testing)
SUPABASE_URL="http://localhost/dummy"
SUPABASE_SERVICE_KEY="dummy-service-key"
SUPABASE_ANON_KEY="dummy-anon-key"

# API Keys (mock values)
OPENAI_API_KEY="mock-openai-key"
PERSPECTIVE_API_KEY="mock-perspective-key"

# Feature flags
ENABLE_SHIELD=true
ENABLE_BILLING=true
ENABLE_PERSPECTIVE_API=true
```

## Test Issues Breakdown

### P0 Issues (Critical)

#### #404 - [E2E] Flujo manual (auto-approval OFF)
- **File**: `tests/e2e/manual-flow.test.js`
- **Validates**: Complete manual approval workflow
- **Status**: ⏳ Pending

#### #405 - [E2E] Flujo automático (auto-approval ON)  
- **File**: `tests/e2e/automatic-flow.test.js`
- **Validates**: Automated processing pipeline
- **Status**: ⏳ Pending

#### #406 - [Integración] Ingestor
- **File**: `tests/integration/ingestor.test.js`
- **Validates**: Comment deduplication, order, backoff, acknowledgment
- **Status**: ⏳ Pending

#### #407 - [Integración] Triage
- **File**: `tests/integration/triage.test.js`  
- **Validates**: Block/roast/publish decision matrix
- **Status**: ⏳ Pending

#### #408 - [Integración] Shield
- **File**: `tests/integration/shield.test.js`
- **Validates**: Shield actions and offender registry
- **Status**: ⏳ Pending

#### #409 - [Integración] Generación
- **File**: `tests/integration/generation.test.js`
- **Validates**: Tone-based generation with 2+1 variants
- **Status**: ⏳ Pending

#### #410 - [Integración] Publisher
- **File**: `tests/integration/publisher.test.js`
- **Validates**: Direct publication and idempotency
- **Status**: ⏳ Pending

#### #411 - [Integración] Workers
- **File**: `tests/integration/workers.test.js`
- **Validates**: Worker idempotency and retries
- **Status**: ⏳ Pending

#### #412 - [Integración] Multi-tenant (RLS)
- **File**: `tests/integration/multi-tenant.test.js`
- **Validates**: Strict tenant isolation
- **Status**: ⏳ Pending

#### #413 - [Integración] Billing/Entitlements
- **File**: `tests/integration/billing.test.js`
- **Validates**: Plan-based gating with Stripe
- **Status**: ⏳ Pending

#### #414 - [Integración] Kill-switch
- **File**: `tests/integration/kill-switch.test.js`
- **Validates**: Publisher rollback functionality
- **Status**: ⏳ Pending

#### #416 - [E2E] Demo Mode
- **File**: `tests/e2e/demo-flow.test.js`
- **Validates**: Fixtures traverse complete pipeline
- **Status**: ✅ Initial implementation complete

### P1 Issues (Robustez/UX/Observabilidad)

#### #417 - [Integración] Observabilidad
- **File**: `tests/integration/observability.test.js`
- **Validates**: Structured logs and correlation
- **Status**: ⏳ Pending

#### #419 - [E2E] Resiliencia UI
- **File**: `tests/e2e/ui-resilience.test.js`  
- **Validates**: Timeout/error handling, "no more variants"
- **Status**: ⏳ Pending

#### #420 - [Integración] Fixtures/Seeds
- **File**: `tests/integration/fixtures.test.js`
- **Validates**: Complete fixture system
- **Status**: ✅ Base fixtures implemented

#### #421 - [DOC] Guía de ejecución
- **File**: `docs/testing-mvp-guide.md`
- **Validates**: Complete testing documentation
- **Status**: ✅ This document

### P2 Issues (Pulido Técnico)

#### #422 - [Unit] Utilidades
- **File**: `tests/unit/utils/sanitization.test.js`
- **Validates**: Text sanitization/normalization utilities
- **Status**: ⏳ Pending

#### #423 - [Integración] Compatibilidad sandbox
- **File**: `tests/integration/sandbox-compat.test.js`
- **Validates**: Platform sandbox compatibility
- **Status**: ⏳ Pending

## Test Infrastructure

### Helper Files

- **`tests/helpers/test-setup.js`** - Central test configuration
- **`tests/helpers/fixtures-loader.js`** - Test data management
- **`tests/helpers/env-setup.js`** - Environment variable setup

### Configuration

- **`jest.testing-mvp.config.js`** - Jest configuration for MVP tests
- **Test timeout settings**:
  - Unit tests: 10 seconds
  - Integration tests: 45 seconds  
  - E2E tests: 60 seconds

### Fixtures System

The fixtures system provides:

- **Multi-language support** (Spanish/English)
- **Comment categories** (roastable, shield, block, neutral)
- **Multi-tenant scenarios** (different organizations, users, plans)
- **Reproducible test data** for consistent testing

Example fixture usage:

```javascript
const { loadFixtures, createTestScenario } = require('../helpers/fixtures-loader');

// Load Spanish roastable comments
const fixtures = await loadFixtures('comments', 'spanish');

// Create complete test scenario
const scenario = createTestScenario('test-name', {
  orgCount: 2,
  commentsPerOrg: 10,
  language: 'spanish'
});
```

## Coverage Requirements

### Global Targets
- **Branches**: 70%
- **Functions**: 75%
- **Lines**: 80%  
- **Statements**: 80%

### Critical Services (Higher Requirements)
- **`src/services/`**: 90% line coverage
- **`src/workers/`**: 85% line coverage

## CI/CD Integration

### GitHub Actions

The testing MVP integrates with CI/CD:

```yaml
# Run MVP tests in CI
- name: Run MVP Test Suite
  run: npm run test:mvp:ci
  
# Upload coverage reports
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/testing-mvp/coverage-final.json
```

### Test Reports

- **JUnit XML**: `test-results/testing-mvp-results.xml`
- **Coverage HTML**: `coverage/testing-mvp/index.html`  
- **Coverage JSON**: `coverage/testing-mvp/coverage-final.json`

## Troubleshooting

### Common Issues

1. **Mock mode not enabled**
   ```bash
   export ENABLE_MOCK_MODE=true
   ```

2. **Database connection errors**
   - Ensure dummy database URLs are set
   - Check that mock mode is properly configured

3. **Test timeouts**
   - Increase timeout in jest config for slow tests
   - Check for hanging async operations

4. **Fixture loading errors**
   - Verify fixtures directory exists
   - Check fixture JSON syntax

### Debug Mode

Run tests with additional logging:

```bash
DEBUG=true npm run test:mvp
```

## Development Workflow

### Adding New Tests

1. **Identify test category** (e2e/integration/unit)
2. **Create test file** in appropriate directory
3. **Use fixtures system** for test data
4. **Follow naming convention**: `feature-name.test.js`
5. **Add appropriate timeouts** based on test type
6. **Update this guide** with new test documentation

### Test-Driven Development

1. Write failing test first
2. Implement minimal code to pass
3. Refactor while maintaining green tests
4. Ensure coverage targets are met

### Review Process

All testing MVP changes require:

- [ ] Tests for new functionality
- [ ] Coverage targets maintained
- [ ] Documentation updated
- [ ] CI/CD pipeline passing

## Metrics and Monitoring

### Success Criteria

- ✅ All P0 tests passing
- ✅ Coverage targets met
- ✅ CI/CD pipeline stable  
- ✅ Documentation complete
- ✅ Zero flaky tests

### Performance Targets

- **Total test time**: < 15 minutes
- **E2E tests**: < 5 minutes
- **Integration tests**: < 8 minutes
- **Unit tests**: < 2 minutes

### Quality Gates

Tests must pass these gates:

1. **No critical failures** in P0 tests
2. **Coverage thresholds** met for all areas
3. **Zero flaky tests** over 10 runs
4. **Performance targets** achieved
5. **Documentation** up to date

## Future Enhancements

### Planned Improvements

- **Visual regression testing** with Playwright screenshots
- **Performance benchmarking** for critical paths
- **Stress testing** for multi-tenant isolation
- **Load testing** for worker system scalability

### Monitoring Integration

- **Real-time test metrics** dashboard
- **Automated failure notifications**
- **Trend analysis** for test stability
- **Integration** with observability stack

---

**Maintained by**: Testing MVP Team (Issue #403)
**Last Updated**: 2025-01-25
**Status**: 🚧 In Development