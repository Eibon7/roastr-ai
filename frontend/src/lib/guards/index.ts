/**
 * Guards Index
 *
 * Centralized export for all route guards
 * Issue #1063: Route guards reorganization
 */

export { AuthGuard, default as authGuard } from './auth-guard';
export { AdminGuard, default as adminGuard } from './admin-guard';
