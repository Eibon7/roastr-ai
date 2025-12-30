/**
 * PII helpers (backend-v2)
 *
 * Rules:
 * - Never log full emails
 * - Keep output stable and non-reversible for logs
 */

/**
 * Truncates an email for safe logs.
 *
 * Required format (ROA-409): `foo***@`
 * - Keeps up to first 3 chars of local part
 * - Never includes domain
 *
 * @param email - Raw email (may be invalid)
 * @returns Truncated email safe for logs
 */
export function truncateEmailForLog(email: string): string {
  if (typeof email !== 'string') return '***@';

  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf('@');
  const local = at >= 0 ? normalized.slice(0, at) : normalized;

  const prefix = local.slice(0, Math.min(3, Math.max(1, local.length)));
  if (!prefix) return '***@';
  return `${prefix}***@`;
}

