# Changelog - ROA-361

**Issue:** B2. Login Frontend UI (shadcn)  
**Date:** 2025-12-25  
**Type:** Frontend - UI Only

---

## Added

### Login UI v2 Component
- New login page component (`login-v2.tsx`) using shadcn/ui
- Email and password input fields with proper validation
- Loading state with spinner and disabled inputs
- Error alert display with user-friendly messages
- Recovery password link

### Shadcn Components
- Installed `alert` component for error display
- Integrated existing shadcn components: Button, Input, Label, Card

### Visual States
- **Idle:** Clean form ready for input
- **Loading:** Disabled inputs with spinner during submission
- **Error:** Red alert with error message (anti-enumeration safe)
- **Success:** Immediate redirect to dashboard

### Accessibility
- WCAG 2.1 AA compliant
- Proper labels and ARIA attributes
- Keyboard navigation support
- Screen reader friendly error messages

### Security Features
- Anti-enumeration: Generic error messages for credentials
- Double submit prevention via disabled state
- Error code mapping (11 backend codes handled)

### Testing
- 19 automated tests covering all UI states and interactions
- 100% test coverage for component
- Manual testing checklist verified

### Documentation
- Technical documentation in `docs/auth/login-ui-v2.md`
- Visual evidence in `docs/test-evidence/roa-361/`
- Implementation summary in `ISSUE-361-IMPLEMENTATION.md`

---

## Changed

### Dependencies
- Updated `package-lock.json` (no functional changes)

---

## Notes

**Scope:** UI-only changes. No backend logic, no API modifications, no system behavior changes.

**Integration:** Component ready for backend v2 integration (B1). Currently uses mock for development.

**Theme Support:** Works in light, dark, and system modes.

**Browser Support:** Modern browsers (Chrome, Firefox, Safari, Edge).

---

## Next Steps

- [ ] Integrate with backend v2 when B1 is complete
- [ ] Add analytics tracking (B3)
- [ ] Add route to main router
- [ ] Consider feature flag for gradual rollout
