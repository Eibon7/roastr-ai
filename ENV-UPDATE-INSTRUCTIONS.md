# ENV Variables to Add - ROA-524

## Required Manual Update to `.env.example`

After merging this PR, **NO environment variables need to be added** to `.env.example` file.

## Why?

ROA-524 uses SSOT-V2 feature flags instead of environment variables:

- `auth_enable_session_refresh` - Defined in `docs/SSOT-V2.md` (FeatureFlagKey union)
- Default: `true` (enabled)
- Admin-controlled via feature_flags table in database
- **NO environment variable fallbacks** (SSOT v2 enforcement)

## SSOT Reference

See `docs/SSOT-V2.md` section 3.2 (FeatureFlagKey) for:
- `auth_enable_session_refresh` definition
- Full semantics (purpose, default, behavior, analytics, GDPR)

---

**Issue:** ROA-524  
**PR:** #1265  
**Date:** 2025-01-08

