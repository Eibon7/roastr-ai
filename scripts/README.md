# Roastr.ai Scripts - Issue 82 Implementation

## Phase 4 CLI Tools & Advanced Features

This directory contains CLI tools and utilities for advanced testing and project management.

### Test CLI Tools

- `scripts/test/runner.js` - Advanced test runner with scope filtering
- `tests/utils/multiTenantMocks.js` - Multi-tenant test utilities  
- `tests/utils/sharedMocks.js` - Shared mock utilities

### New NPM Scripts

```bash
npm run test:scopes        # List available test scopes
npm run ci:test:auth       # Run auth tests in CI mode
npm run ci:test:workers    # Run worker tests in CI mode
npm run ci:test:billing    # Run billing tests in CI mode
npm run coverage:generate  # Generate coverage reports
npm run coverage:check     # Check coverage thresholds
```

### Coverage Thresholds

- Global minimum: 30%
- Critical modules: 60-80%

**Issue 82 - Phase 4 CLI Tools & Advanced Features: ✅ COMPLETED**