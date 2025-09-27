# Plan: CodeRabbit Review Fixes - PR #424

## Objetivo
Resolver todos los issues identificados por CodeRabbit en la PR #424 para que pasen los CI jobs y la PR sea mergeable.

## Comentarios de CodeRabbit a Abordar

### 1. **Adapter Contracts Issue**
- **Problem**: Missing Instagram and Facebook Shield Adapters
- **Impact**: Tests import non-existent mock adapters
- **Solution**: Create the missing mock adapters or remove references to non-existent ones

### 2. **E2E Test Route Problem**
- **Problem**: No matching routes for `/api/comments/ingest`
- **Impact**: E2E tests will return 404 errors
- **Solution**: Either create missing routes or update tests to use existing endpoints

### 3. **Jest Configuration Dependency**
- **Problem**: Missing `jest-html-reporters` package
- **Impact**: Jest fails during initialization
- **Solution**: Install missing package or remove from jest.config.js

### 4. **Stripe Test Keys Security**
- **Problem**: Hardcoded Stripe test keys in test files
- **Impact**: Security scanners triggered, potential security risk
- **Solution**: Move to environment variables or GitHub Secrets

### 5. **Supabase Mock Implementation**
- **Problem**: Mock client is "thenable", breaking async chains
- **Impact**: Async operations may fail unexpectedly
- **Solution**: Restructure mock to return proper query builder object

### 6. **Test Results Processor**
- **Problem**: Duplicate "failed_tests" key overwrites data
- **Impact**: Loss of test failure information
- **Solution**: Rename duplicate key to preserve both count and details

## Subagentes a Usar

### Test Engineer
- **Responsabilidad**: Generar/fix tests que falten tras los cambios
- **Archivos**: Todos los archivos de test modificados
- **Validación**: Ensuring all tests pass after changes

### General Purpose Agent
- **Responsabilidad**: Research existing codebase structure and dependencies
- **Uso**: Búsqueda de rutas existentes, análisis de configuración Jest
- **Archivos**: Búsqueda en src/ y configuración

## Archivos Afectados

### Tests
- `tests/integration/spec14-adapter-contracts.test.js`
- `tests/e2e/spec14-integral-test-suite.test.js`
- `tests/integration/spec14-tier-validation.test.js`
- `tests/integration/spec14-idempotency.test.js`

### Configuration
- `package.json` (add missing dependencies)
- `jest.config.js` (fix reporter config)
- `.github/workflows/` (CI configuration)

### Mock Implementation
- `src/config/supabase.js` (fix mock structure)
- Test processor utilities

### Missing Adapters (Create or Fix References)
- `src/adapters/mock/InstagramShieldAdapter.js`
- `src/adapters/mock/FacebookShieldAdapter.js`

## Plan de Implementación

### Phase 1: Dependency and Configuration Fixes
1. **Install missing jest-html-reporters package**
2. **Fix Jest configuration to remove missing dependencies**
3. **Fix Supabase mock implementation structure**

### Phase 2: Security and Environment Fixes
1. **Replace hardcoded Stripe test keys with environment variables**
2. **Update test files to use process.env for sensitive data**
3. **Fix test results processor duplicate key issue**

### Phase 3: Adapter and Route Fixes
1. **Research existing API routes in the codebase**
2. **Either create missing `/api/comments/ingest` route or update tests**
3. **Create missing mock adapters or fix imports in adapter tests**

### Phase 4: Validation and Testing
1. **Run all SPEC 14 tests locally to verify fixes**
2. **Use Test Engineer to generate any missing test coverage**
3. **Verify CI jobs pass on GitHub**

## Criterios de Éxito
- ✅ All CI jobs pass on PR #424
- ✅ No security warnings from hardcoded credentials
- ✅ All SPEC 14 tests pass locally and in CI
- ✅ Jest configuration works without missing dependencies
- ✅ Supabase mocks work correctly in async contexts
- ✅ No duplicate keys in test result processing

## Riesgos y Mitigaciones
- **Risk**: Creating missing routes might affect other parts of system
- **Mitigation**: Use existing routes or create minimal mock implementations
- **Risk**: Changing Supabase mocks might break other tests
- **Mitigation**: Test all related functionality after changes

## Estimación
- **Tiempo**: 1-2 horas
- **Complejidad**: Media (mostly configuration and mock fixes)
- **Dependencies**: None external, all internal codebase changes