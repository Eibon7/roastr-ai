/**
 * Rate Limiting Service v2
 *
 * Implementación de rate limiting según SSOT v2 - Sección 7.4
 *
 * Configuración por tipo de autenticación:
 * - login: 5 intentos en 15 min → bloqueo 15 min
 * - magic_link: 3 intentos en 1h → bloqueo 1h
 * - oauth: 10 intentos en 15 min → bloqueo 15 min
 * - password_reset: 3 intentos en 1h → bloqueo 1h
 *
 * Bloqueo progresivo: 15min → 1h → 24h → permanente
 *
 * ROA-410: Integrado con auth observability para logging estructurado
 */

export type AuthType = 'login' | 'magic_link' | 'oauth' | 'password_reset' | 'signup';

interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  blockDurationMs: number;
}

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  blockedUntil?: number | null;
  blockCount: number;
}

// Configuración desde SSOT v2 - Sección 7.4
const RATE_LIMITS: Record<AuthType, RateLimitConfig> = {
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxAttempts: 5,
    blockDurationMs: 15 * 60 * 1000 // 15 minutos
  },
  magic_link: {
    windowMs: 60 * 60 * 1000, // 1 hora
    maxAttempts: 3,
    blockDurationMs: 60 * 60 * 1000 // 1 hora
  },
  oauth: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxAttempts: 10,
    blockDurationMs: 15 * 60 * 1000 // 15 minutos
  },
  password_reset: {
    windowMs: 60 * 60 * 1000, // 1 hora
    maxAttempts: 3,
    blockDurationMs: 60 * 60 * 1000 // 1 hora
  },
  signup: {
    windowMs: 60 * 60 * 1000, // 1 hora
    maxAttempts: 5,
    blockDurationMs: 60 * 60 * 1000 // 1 hora
  }
};

// Bloqueo progresivo según SSOT v2
const PROGRESSIVE_BLOCK_DURATIONS = [
  15 * 60 * 1000, // 15 minutos (1ra infracción)
  60 * 60 * 1000, // 1 hora (2da infracción)
  24 * 60 * 60 * 1000, // 24 horas (3ra infracción)
  null // Permanente (4ta+ infracción, requiere intervención manual)
];

export class RateLimitService {
  private store: Map<string, RateLimitEntry>;
  private observability?: {
    logRateLimit: (_context: any, _reason: string) => void;
  };

  constructor() {
    this.store = new Map();
  }

  /**
   * Set observability hooks (ROA-410)
   * Allows dependency injection for testing
   */
  setObservability(hooks: { logRateLimit: (_context: any, _reason: string) => void }): void {
    this.observability = hooks;
  }

  /**
   * Genera key de rate limit
   */
  private getKey(authType: AuthType, identifier: string): string {
    return `ratelimit:${authType}:${identifier}`;
  }

  /**
   * Obtiene duración de bloqueo progresivo
   */
  private getBlockDuration(blockCount: number, baseBlockDuration: number): number | null {
    if (blockCount >= PROGRESSIVE_BLOCK_DURATIONS.length) {
      return null; // Bloqueo permanente
    }
    return PROGRESSIVE_BLOCK_DURATIONS[blockCount] || baseBlockDuration;
  }

  /**
   * Verifica si un identificador está bloqueado
   */
  isBlocked(authType: AuthType, identifier: string): boolean {
    const key = this.getKey(authType, identifier);
    const entry = this.store.get(key);

    if (!entry) {
      return false;
    }

    // Si hay bloqueo permanente
    if (entry.blockedUntil === null) {
      return true;
    }

    // Si hay bloqueo temporal y aún no expiró
    if (entry.blockedUntil && Date.now() < entry.blockedUntil) {
      return true;
    }

    // Si el bloqueo expiró, limpiar
    if (entry.blockedUntil && Date.now() >= entry.blockedUntil) {
      this.store.delete(key);
      return false;
    }

    return false;
  }

  /**
   * Obtiene tiempo restante de bloqueo (en ms)
   */
  getBlockRemaining(authType: AuthType, identifier: string): number | null {
    const key = this.getKey(authType, identifier);
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Bloqueo permanente
    if (entry.blockedUntil === null) {
      return Infinity;
    }

    // Si no hay bloqueo temporal
    if (!entry.blockedUntil) {
      return null;
    }

    const remaining = entry.blockedUntil - Date.now();
    return remaining > 0 ? remaining : null;
  }

  /**
   * Registra un intento de autenticación
   */
  recordAttempt(
    authType: AuthType,
    identifier: string
  ): {
    allowed: boolean;
    remaining?: number;
    blockedUntil?: number | null;
  } {
    const config = RATE_LIMITS[authType];
    const key = this.getKey(authType, identifier);
    const now = Date.now();

    // Verificar si está bloqueado
    if (this.isBlocked(authType, identifier)) {
      const remaining = this.getBlockRemaining(authType, identifier);
      const blockedUntil = remaining === Infinity ? null : now + (remaining || 0);

      // ROA-410: Log rate limit event
      if (this.observability) {
        this.observability.logRateLimit(
          {
            flow: authType,
            ip: identifier.includes(':') ? identifier.split(':')[0] : identifier
          },
          `rate_limit_blocked:${authType}:${identifier}`
        );
      }

      return {
        allowed: false,
        blockedUntil
      };
    }

    // Obtener o crear entrada
    let entry = this.store.get(key);

    if (!entry) {
      entry = {
        attempts: 0,
        firstAttempt: now,
        blockCount: 0
      };
    }

    // Si la ventana expiró, resetear
    if (now - entry.firstAttempt > config.windowMs) {
      entry = {
        attempts: 0,
        firstAttempt: now,
        blockCount: entry.blockCount
      };
    }

    // Incrementar intentos
    entry.attempts++;

    // Si excede el límite, bloquear
    if (entry.attempts > config.maxAttempts) {
      const blockDuration = this.getBlockDuration(entry.blockCount, config.blockDurationMs);

      entry.blockedUntil = blockDuration === null ? null : now + blockDuration;
      entry.blockCount++;
      entry.attempts = 0;

      this.store.set(key, entry);

      // ROA-410: Log rate limit exceeded
      if (this.observability) {
        this.observability.logRateLimit(
          {
            flow: authType,
            ip: identifier.includes(':') ? identifier.split(':')[0] : identifier
          },
          `rate_limit_exceeded:${authType}:${entry.blockCount}:${blockDuration === null ? 'permanent' : `${blockDuration}ms`}`
        );
      }

      return {
        allowed: false,
        blockedUntil: entry.blockedUntil
      };
    }

    this.store.set(key, entry);

    return {
      allowed: true,
      remaining: config.maxAttempts - entry.attempts
    };
  }

  /**
   * Resetea el rate limit para un identificador (uso en tests o admin)
   */
  reset(authType: AuthType, identifier: string): void {
    const key = this.getKey(authType, identifier);
    this.store.delete(key);
  }

  /**
   * Limpia entradas expiradas (para evitar memory leaks)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      // Eliminar si no está bloqueado y la ventana expiró
      if (!entry.blockedUntil && now - entry.firstAttempt > 24 * 60 * 60 * 1000) {
        this.store.delete(key);
      }
      // Eliminar si el bloqueo temporal expiró
      if (entry.blockedUntil && entry.blockedUntil !== null && now > entry.blockedUntil) {
        this.store.delete(key);
      }
    }
  }
}

// Singleton
export const rateLimitService = new RateLimitService();
