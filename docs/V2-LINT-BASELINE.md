# V2 Lint Baseline

**Status:** ✅ Active  
**Issue:** ROA-518 - Make CI Lint Green  
**Date:** 2025-01-06

## Rule

**V2 code admits ZERO warnings. Legacy debt is visible but isolated.**

## V2 Scope

- `apps/backend-v2/**` - Backend V2 codebase
- `frontend/**` - Frontend (future)
- `docs/nodes-v2/**` - Documentation (future)

## Legacy Scope

- `src/**` - Backend legacy
- `tests/**` - Legacy tests
- `scripts/**` - Build/validation scripts
- `docs/nodes/**` - Legacy GDD

## Commands

```bash
# V2 - Zero warnings policy (CI fails on any warning)
npm run lint:v2

# Legacy - Visible debt, non-blocking
npm run lint:legacy
```

## CI Behavior

- **V2 warnings** → CI FAILS (exit code 1)
- **Legacy warnings** → CI PASSES (always exit code 0, visible in logs)

## Why This Matters

1. **Clear signal** - V2 developers know their code must be clean
2. **No hiding debt** - Legacy warnings remain visible for optional cleanup
3. **Fast feedback** - V2 lint checks fewer files, runs faster
4. **Quality baseline** - All new V2 code starts at highest standard

## Adding New V2 Paths

When creating new V2 modules, add to `package.json`:

```json
"lint:v2": "eslint --ext .js,.jsx,.ts,.tsx --max-warnings 0 apps/backend-v2 apps/new-module"
```

## Never Do This

❌ Add `--quiet` to lint:v2  
❌ Add `|| true` to lint:v2  
❌ Increase `--max-warnings` above 0  
❌ Add V2 paths to lint:legacy to hide warnings

## References

- Full audit: `V2_BASELINE_AUDIT.md`
- CI workflow: `.github/workflows/ci.yml`
- ESLint config: `eslint.config.js`

