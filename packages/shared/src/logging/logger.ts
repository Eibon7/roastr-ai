export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = {
  service?: string;
  requestId?: string;
  userId?: string;
  jobId?: string;
  queue?: string;
  [key: string]: unknown;
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const REDACTED_FIELDS = new Set([
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'creditcard',
]);

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACTED_FIELDS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[key] = redact(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export class Logger {
  private minLevel: LogLevel;
  private defaultContext: LogContext;

  constructor(context: LogContext = {}, minLevel?: LogLevel) {
    this.defaultContext = context;
    this.minLevel =
      minLevel ??
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'
        ? 'info'
        : 'debug');
  }

  child(context: LogContext): Logger {
    return new Logger(
      { ...this.defaultContext, ...context },
      this.minLevel,
    );
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.log('error', message, data);
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
  ) {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return;

    const merged = { ...this.defaultContext, ...(data ?? {}) };
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...redact(merged),
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
        break;
    }
  }
}
