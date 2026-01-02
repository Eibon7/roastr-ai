# Changelog - ROA-377: b4-register-tests-v2

## Added

### Tests

- **Unit Tests - Edge Cases Validation** (`apps/backend-v2/tests/unit/services/authService-register-validation.test.ts`)
  - 12 new tests for email and password validation edge cases
  - Covers normalization, length limits, special characters, invalid formats

- **Integration Tests - Real Database** (`apps/backend-v2/tests/integration/auth/register.spec.ts`)
  - 5 new integration tests with real Supabase database
  - Tests happy path, profile creation, anti-enumeration, and role protection
  - Automatic cleanup of test data after each test
  - Skips automatically if database credentials are not available

### Documentation

- **Plan Document** (`docs/plan/issue-ROA-377.md`)
  - Complete implementation plan with test coverage analysis
  - Requirements vs deliverables mapping

- **Test Evidence** (`docs/test-evidence/ROA-377/SUMMARY.md`)
  - Comprehensive test coverage summary
  - Test execution instructions
  - Key validations documentation

## Test Coverage Improvements

### Before
- 20 tests (9 endpoint + 11 service)
- All tests used mocks (no real database)
- Limited edge case coverage

### After
- 37 tests total (9 endpoint + 11 service + 12 edge cases + 5 integration)
- Real database integration tests
- Comprehensive edge case coverage
- Role protection validation
- Anti-enumeration verification with real database

## Key Features

### Role Protection
- Verified that all users created via register endpoint always have role 'user'
- Prevents privilege escalation through registration endpoint

### Anti-Enumeration
- Verified that duplicate email registration returns homogeneous response
- Email existence is not revealed to potential attackers

### Database Integration
- Real Supabase Auth integration
- Profile creation verification
- Isolated test data with automatic cleanup

### Edge Cases
- Email normalization (trim, lowercase, control characters)
- Password length validation (8-128 characters)
- Special characters handling
- Invalid format rejection

## Breaking Changes

None

## Migration Guide

No migration required. This is a test-only change.

## Related Issues

- ROA-377: b4-register-tests-v2

