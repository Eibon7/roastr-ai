/**
 * Abuse Detection Service v2
 *
 * Implementación de detección de abuse patterns según SSOT v2 - Sección 7.5
 *
 * Thresholds:
 * - multi_ip: 3 IPs diferentes para mismo email
 * - multi_email: 5 emails diferentes para misma IP
 * - burst: 10 intentos en 1 minuto (burst attack)
 * - slow_attack: 20 intentos en 1 hora (slow attack)
 */

import { createHash } from 'crypto';

export interface AbuseDetectionThresholds {
  multi_ip: number;
  multi_email: number;
  burst: number;
  slow_attack: number;
}

// Configuración desde SSOT v2 - Sección 7.5
// TODO(ROA-XXX): Migrar a SettingsLoader cuando esté disponible en backend-v2
// Los valores están hardcoded temporalmente para cumplir deadline de ROA-360
// Fallback si SSOT no disponible
const DEFAULT_THRESHOLDS: AbuseDetectionThresholds = {
  multi_ip: 3,
  multi_email: 5,
  burst: 10,
  slow_attack: 20
};

interface AbuseEntry {
  ips: Set<string>;
  emails: Set<string>;
  attempts: Array<{ timestamp: number }>;
}

export type AbusePattern = 'multi_ip' | 'multi_email' | 'burst_attack' | 'slow_attack';

export class AbuseDetectionService {
  private ipStore: Map<string, AbuseEntry>;
  private emailStore: Map<string, AbuseEntry>;
  private thresholds: AbuseDetectionThresholds;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(thresholds: AbuseDetectionThresholds = DEFAULT_THRESHOLDS) {
    this.ipStore = new Map();
    this.emailStore = new Map();
    this.thresholds = thresholds;
    // Auto-cleanup every 10 minutes to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * Stops cleanup interval (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Genera hash de email para privacidad
   */
  private hashEmail(email: string): string {
    return createHash('sha256').update(email.toLowerCase()).digest('hex');
  }

  /**
   * Registra un intento de autenticación y detecta abuse patterns
   */
  recordAttempt(
    email: string,
    ip: string
  ): {
    isAbuse: boolean;
    patterns: AbusePattern[];
    details?: string;
  } {
    const emailHash = this.hashEmail(email);
    const now = Date.now();
    const patterns: AbusePattern[] = [];

    // Obtener o crear entrada para IP
    let ipEntry = this.ipStore.get(ip);
    if (!ipEntry) {
      ipEntry = {
        ips: new Set(),
        emails: new Set(),
        attempts: []
      };
      this.ipStore.set(ip, ipEntry);
    }

    // Obtener o crear entrada para email
    let emailEntry = this.emailStore.get(emailHash);
    if (!emailEntry) {
      emailEntry = {
        ips: new Set(),
        emails: new Set(),
        attempts: []
      };
      this.emailStore.set(emailHash, emailEntry);
    }

    // Registrar IP y email
    ipEntry.emails.add(emailHash);
    emailEntry.ips.add(ip);

    // Registrar intento
    ipEntry.attempts.push({ timestamp: now });
    emailEntry.attempts.push({ timestamp: now });

    // Limpiar intentos antiguos (>1 hora)
    const oneHourAgo = now - 60 * 60 * 1000;
    ipEntry.attempts = ipEntry.attempts.filter((a) => a.timestamp > oneHourAgo);
    emailEntry.attempts = emailEntry.attempts.filter((a) => a.timestamp > oneHourAgo);

    // Detectar patrones de abuse

    // 1. Multi-IP: Mismo email desde múltiples IPs
    if (emailEntry.ips.size > this.thresholds.multi_ip) {
      patterns.push('multi_ip');
    }

    // 2. Multi-Email: Múltiples emails desde misma IP
    if (ipEntry.emails.size > this.thresholds.multi_email) {
      patterns.push('multi_email');
    }

    // 3. Burst Attack: Muchos intentos en 1 minuto
    const oneMinuteAgo = now - 60 * 1000;
    const recentAttemptsIp = ipEntry.attempts.filter((a) => a.timestamp > oneMinuteAgo).length;
    const recentAttemptsEmail = emailEntry.attempts.filter(
      (a) => a.timestamp > oneMinuteAgo
    ).length;

    if (recentAttemptsIp > this.thresholds.burst || recentAttemptsEmail > this.thresholds.burst) {
      patterns.push('burst_attack');
    }

    // 4. Slow Attack: Muchos intentos en 1 hora
    if (
      ipEntry.attempts.length > this.thresholds.slow_attack ||
      emailEntry.attempts.length > this.thresholds.slow_attack
    ) {
      patterns.push('slow_attack');
    }

    return {
      isAbuse: patterns.length > 0,
      patterns,
      details: patterns.length > 0 ? `Detected abuse patterns: ${patterns.join(', ')}` : undefined
    };
  }

  /**
   * Verifica si un email o IP está marcado como abusivo
   * Chequea todos los 4 patrones: multi-IP, multi-email, burst, slow attack
   */
  isAbusive(email?: string, ip?: string): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    if (email) {
      const emailHash = this.hashEmail(email);
      const entry = this.emailStore.get(emailHash);
      if (entry) {
        // Limpiar intentos antiguos
        entry.attempts = entry.attempts.filter((a) => a.timestamp > oneHourAgo);

        // Check multi_ip
        if (entry.ips.size > this.thresholds.multi_ip) return true;

        // Check burst_attack
        const recentAttempts = entry.attempts.filter((a) => a.timestamp > oneMinuteAgo).length;
        if (recentAttempts > this.thresholds.burst) return true;

        // Check slow_attack
        if (entry.attempts.length > this.thresholds.slow_attack) return true;
      }
    }

    if (ip) {
      const entry = this.ipStore.get(ip);
      if (entry) {
        // Limpiar intentos antiguos
        entry.attempts = entry.attempts.filter((a) => a.timestamp > oneHourAgo);

        // Check multi_email
        if (entry.emails.size > this.thresholds.multi_email) return true;

        // Check burst_attack
        const recentAttempts = entry.attempts.filter((a) => a.timestamp > oneMinuteAgo).length;
        if (recentAttempts > this.thresholds.burst) return true;

        // Check slow_attack
        if (entry.attempts.length > this.thresholds.slow_attack) return true;
      }
    }

    return false;
  }

  /**
   * Resetea el abuse tracking para un email o IP (uso en tests o admin)
   */
  reset(email?: string, ip?: string): void {
    if (email) {
      const emailHash = this.hashEmail(email);
      this.emailStore.delete(emailHash);
    }

    if (ip) {
      this.ipStore.delete(ip);
    }
  }

  /**
   * Limpia entradas antiguas (para evitar memory leaks)
   */
  cleanup(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Limpiar IP store
    for (const [ip, entry] of this.ipStore.entries()) {
      entry.attempts = entry.attempts.filter((a) => a.timestamp > oneHourAgo);
      if (entry.attempts.length === 0) {
        this.ipStore.delete(ip);
      }
    }

    // Limpiar email store
    for (const [emailHash, entry] of this.emailStore.entries()) {
      entry.attempts = entry.attempts.filter((a) => a.timestamp > oneHourAgo);
      if (entry.attempts.length === 0) {
        this.emailStore.delete(emailHash);
      }
    }
  }
}

// Singleton
export const abuseDetectionService = new AbuseDetectionService();
