# ENV Variables to Add - ROA-524

## Required Manual Update to `.env.example`

After merging this PR, add the following lines to `.env.example` file:

```bash
# ============================================================================
# Session Refresh Feature (ROA-524)
# ============================================================================
# Enable automatic session refresh when tokens are near expiry (5 min before)
# Default: true (enabled)
ENABLE_SESSION_REFRESH=true

# Enable detailed session refresh debug logs (development only)
# Default: false (disabled in production)
DEBUG_SESSION=false
```

## Location

Add after the existing Auth Features section in `.env.example`

## Why Manual?

`.env.example` is gitignored, so this change must be made directly in the main repository after PR merge.

---

**Issue:** ROA-524  
**PR:** #1265  
**Date:** 2025-01-08

