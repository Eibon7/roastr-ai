# Migration Guide: react-scripts to Craco

**Date:** 2025-11-17  
**PR:** [#847](https://github.com/Eibon7/roastr-ai/pull/847)  
**Status:** ✅ Completed

---

## Overview

This document explains the migration from `react-scripts` to `@craco/craco` (Create React App Configuration Override) that was implemented as part of the UI framework refactor and analytics dashboard feature.

---

## Why the Change?

### Reasons

1. **Custom Webpack Configuration:** Need for custom alias resolution (`@/` for imports)
2. **Tailwind CSS Integration:** Better PostCSS and Tailwind configuration control
3. **Build Optimization:** More control over build process and optimizations
4. **TypeScript Support:** Better TypeScript configuration for shadcn/ui components

### Impact

- **Breaking Change:** All frontend npm scripts now use `craco` instead of `react-scripts`
- **Local Development:** Developers need to use new scripts
- **CI/CD:** Build process updated in workflows

---

## What Changed?

### Package.json Scripts

**Before (react-scripts):**
```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  }
}
```

**After (craco):**
```json
{
  "scripts": {
    "start": "craco start",
    "build": "craco build",
    "build:ci": "craco build ...",
    "test": "craco test",
    "test:ci": "craco test ..."
  }
}
```

### New Files

- `frontend/craco.config.js` - Craco configuration
- `frontend/tailwind.config.js` - Tailwind CSS configuration
- `frontend/postcss.config.js` - PostCSS configuration

### Dependencies

**Added:**
- `@craco/craco`: ^7.1.0 (devDependency)
- `tailwindcss`: ^3.4.18 (devDependency)
- `tailwindcss-animate`: ^1.0.7 (devDependency)
- `autoprefixer`: ^10.4.21 (devDependency)
- `postcss`: ^8.5.6 (devDependency)

**Removed:**
- None (react-scripts still present for `eject` command)

---

## Local Development Setup

### Installation

```bash
cd frontend
npm ci
```

### Running Development Server

```bash
# Before
npm start  # Used react-scripts

# After
npm start  # Now uses craco (same command, different tool)
```

**No changes needed** - the command remains the same, but now uses `craco` under the hood.

### Building for Production

```bash
# Before
npm run build

# After
npm run build        # Standard build
npm run build:ci    # CI-optimized build (no sourcemaps, mock env)
```

### Testing

```bash
# Before
npm test

# After
npm test            # Interactive mode (same as before)
npm run test:ci     # CI mode (non-interactive, verbose)
```

---

## CI/CD Impact

### Changes Required

**GitHub Actions workflows updated:**
- `.github/workflows/ci.yml` - Uses `npm run build:ci`
- `.github/workflows/frontend-build-check.yml` - Uses `npm run build:ci`

**No breaking changes** - workflows automatically use new scripts.

### Verification

All CI checks passing:
- ✅ Build Check (pull_request)
- ✅ Build Check (push)
- ✅ Frontend Build Check & Case Sensitivity
- ✅ Lint and Test

---

## Configuration Details

### Craco Config (`frontend/craco.config.js`)

**Key Features:**
- **Alias Resolution:** `@/` maps to `src/` directory
- **Webpack Fallbacks:** Handles Node.js polyfills for browser
- **Warning Suppression:** Ignores non-critical webpack warnings

**Example:**
```javascript
config.resolve.alias = {
  '@': path.resolve(__dirname, 'src'),
};
```

**Usage in Code:**
```javascript
// Before
import { Button } from '../components/ui/button';

// After (optional, both work)
import { Button } from '@/components/ui/button';
```

### Tailwind Config

- Tailwind CSS v3.4.18
- Custom theme extensions
- Dark mode support
- Animation utilities

### PostCSS Config

- Autoprefixer for browser compatibility
- Tailwind CSS plugin
- Standard PostCSS processing

---

## Rollback Procedure

If issues arise, rollback is straightforward:

### Option 1: Revert Package.json Scripts

```bash
# Restore old scripts
git checkout HEAD~1 -- frontend/package.json

# Reinstall dependencies
cd frontend
npm ci
```

### Option 2: Full Revert

```bash
# Revert entire migration
git revert <commit-hash>
```

### Option 3: Keep Craco, Fix Issues

Since `react-scripts` is still installed, you can temporarily use it:

```bash
# Use react-scripts directly
npx react-scripts start
npx react-scripts build
```

---

## Testing on Clean Install

To verify the migration works on a fresh environment:

```bash
# Clean install
rm -rf node_modules frontend/node_modules
rm package-lock.json frontend/package-lock.json

# Install
npm ci
cd frontend && npm ci && cd ..

# Test build
cd frontend
npm run build:ci

# Test dev server
npm start
```

**Expected Result:** Build completes successfully, dev server starts without errors.

---

## Troubleshooting

### Issue: "Cannot find module '@craco/craco'"

**Solution:**
```bash
cd frontend
npm install @craco/craco --save-dev
```

### Issue: "Module not found: Can't resolve '@/...'"

**Solution:** Verify `craco.config.js` has correct alias configuration:
```javascript
config.resolve.alias = {
  '@': path.resolve(__dirname, 'src'),
};
```

### Issue: Tailwind classes not working

**Solution:** Verify Tailwind config and PostCSS setup:
```bash
cd frontend
npm run build  # Check for Tailwind errors
```

### Issue: Build fails in CI

**Solution:** Use `build:ci` script which has optimized settings:
```bash
npm run build:ci
```

---

## Benefits

### Achieved

1. ✅ **Custom Alias Support:** `@/` imports work seamlessly
2. ✅ **Better Build Control:** More granular webpack configuration
3. ✅ **Tailwind Integration:** Native Tailwind CSS support
4. ✅ **TypeScript Support:** Better type resolution for shadcn/ui
5. ✅ **Performance:** Optimized builds with better tree-shaking

### Trade-offs

- **Complexity:** Additional configuration file to maintain
- **Learning Curve:** Team needs to understand craco config
- **Dependencies:** One more tool in the build chain

---

## References

- **Craco Documentation:** https://craco.js.org/
- **PR #847:** https://github.com/Eibon7/roastr-ai/pull/847
- **Craco Config:** `frontend/craco.config.js`
- **Tailwind Config:** `frontend/tailwind.config.js`

---

## Migration Checklist

- [x] Install `@craco/craco` and dependencies
- [x] Create `craco.config.js` with alias and webpack config
- [x] Update all npm scripts to use `craco`
- [x] Update CI/CD workflows
- [x] Test local development (`npm start`)
- [x] Test production build (`npm run build`)
- [x] Test CI build (`npm run build:ci`)
- [x] Verify all tests pass
- [x] Document migration process
- [x] Update README if needed

---

**Status:** ✅ Migration complete and verified

