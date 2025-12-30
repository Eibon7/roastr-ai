/**
 * Abuse Detection Service Adapter (ROA-408)
 *
 * Adaptador entre Auth Policy Gate (A3) y Abuse Detection Service (ROA-359).
 * Proporciona interfaz compatible para el wiring de auth.
 *
 * Responsabilidad: Traducción pura, NO lógica de detección.
 */

import { abuseDetectionService } from './abuseDetectionService.js';
import type { AuthAction } from '../auth/authPolicyGate.js';

export interface AbuseCheckRequest {
  ip: string;
  email?: string;
  userId?: string;
  action: AuthAction;
  userAgent?: string;
}

/**
 * Wrapper que adapta abuseDetectionService para auth policy gate.
 * Solo adapta interfaz, NO implementa lógica de abuse.
 */
class AbuseDetectionServiceAdapter {
  /**
   * Check if request shows abuse patterns.
   * Adapta recordAttempt + isAbusive a interfaz esperada por authPolicyGate.
   */
  async checkRequest(request: AbuseCheckRequest): Promise<boolean> {
    const { ip, email } = request;

    // Si no hay email, solo revisar IP
    if (!email) {
      return abuseDetectionService.isAbusive(undefined, ip);
    }

    // Registrar intento y verificar abuse
    const result = abuseDetectionService.recordAttempt(email, ip);

    return result.isAbuse;
  }
}

// Singleton export para usar en authPolicyGate
export const abuseDetectionServiceAdapter = new AbuseDetectionServiceAdapter();
