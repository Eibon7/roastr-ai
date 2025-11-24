# Migration: react-scripts → @craco/craco

**Status:** ✅ Complete  
**Date:** 2025-11-17  
**Related PRs:** #863 (UI Framework), #847 (Analytics Dashboard)  
**Impact:** Build system, development workflow

---

## Summary

Migrated frontend build system from `react-scripts` to `@craco/craco` to support custom webpack configuration required for shadcn/ui and path aliases.

## Rationale

1. **Path Aliases:** shadcn/ui components require `@/` alias support
2. **Webpack Customization:** Need to configure fallbacks for Node.js polyfills
3. **React Refresh Control:** Better control over HMR in development vs production

## Changes

### Dependencies

**Added:**

```json
{
  "@craco/craco": "^7.1.0" // devDependencies (build-time only)
}
```

**Kept (unchanged):**

```json
{
  "react-scripts": "5.0.1" // Still required as peer dependency
}
```

### NPM Scripts

**Before:**

```json
{
  "start": "react-scripts start",
  "build": "react-scripts build",
  "test": "react-scripts test"
}
```

**After:**

```json
{
  "start": "craco start",
  "build": "craco build",
  "test": "craco test",
  "build:ci": "FAST_REFRESH=false CI=false ... craco build"
}
```

### Configuration

**File:** `frontend/craco.config.js`

```javascript
module.exports = {
  babel: {
    plugins: process.env.CI ? [] : undefined // Disable React Refresh in CI
  },
  webpack: {
    configure: (config, { env }) => {
      // Path aliases
      config.resolve.alias = {
        '@': path.resolve(__dirname, 'src')
      };

      // Node.js polyfill fallbacks
      config.resolve.fallback = {
        ws: false,
        bufferutil: false,
        'utf-8-validate': false
      };

      // Remove React Refresh in production
      if (env === 'production') {
        config.plugins = config.plugins.filter(
          (plugin) => !(plugin instanceof ReactRefreshWebpackPlugin)
        );
      }

      return config;
    }
  }
};
```

## Local Development

### Setup (first time)

```bash
cd frontend
npm install  # Installs craco automatically
npm start    # Now uses craco
```

### No changes required for:

- Environment variables (`.env`)
- Test configuration (`jest`)
- ESLint configuration
- Deployment scripts

## CI/CD Impact

### GitHub Actions

**No changes required.** Workflows use `npm run build` and `npm test`, which now invoke craco transparently.

**Verified workflows:**

- `.github/workflows/ci.yml`
- `.github/workflows/frontend-build.yml`

### Build Output

Build artifacts remain identical. Output directory is still `frontend/build/`.

## Rollback Procedure

If issues arise, rollback steps:

```bash
# 1. Revert package.json scripts
git show HEAD~1:frontend/package.json > frontend/package.json

# 2. Remove craco.config.js
rm frontend/craco.config.js

# 3. Reinstall
cd frontend && npm install

# 4. Remove @craco/craco from package.json dependencies
```

**Note:** Path aliases (`@/`) will break if rolled back. shadcn/ui components must be updated to use relative imports.

## Troubleshooting

### Issue: `Module not found: Can't resolve '@/...'`

**Solution:** Ensure `craco.config.js` has the alias configured:

```javascript
config.resolve.alias = {
  '@': path.resolve(__dirname, 'src')
};
```

### Issue: React Refresh errors in production build

**Solution:** Verify `FAST_REFRESH=false` in `build:ci` script.

### Issue: Tests fail with module resolution errors

**Solution:** Add `moduleNameMapper` to `package.json`:

```json
{
  "jest": {
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/src/$1"
    }
  }
}
```

## Related Documentation

- [Craco Documentation](https://craco.js.org/)
- [shadcn/ui Setup](https://ui.shadcn.com/docs/installation)
- [Issue #860](https://github.com/Eibon7/roastr-ai/issues/860) - UI Framework Migration

## Verification

✅ Local development: `npm start` works
✅ Production build: `npm run build` succeeds
✅ Tests: `npm test` passes
✅ CI/CD: All workflows passing
✅ Path aliases: `@/components/ui/*` resolves correctly

---

**Migrated by:** Orchestrator + FrontendDev  
**Reviewed by:** Guardian  
**Status:** Production-ready ✅
