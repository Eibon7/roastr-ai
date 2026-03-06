import { Injectable, LoggerService as NestLoggerService } from "@nestjs/common";

@Injectable()
export class StructuredLogger implements NestLoggerService {
  log(message: string, context?: string) {
    this.emit("info", message, context);
  }

  error(message: string, trace?: string, context?: string) {
    this.emit("error", message, context, trace);
  }

  warn(message: string, context?: string) {
    this.emit("warn", message, context);
  }

  debug(message: string, context?: string) {
    this.emit("debug", message, context);
  }

  verbose(message: string, context?: string) {
    this.emit("verbose", message, context);
  }

  private emit(level: string, message: string, context?: string, trace?: string) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: "api",
      module: context ?? "unknown",
      message,
      ...(trace && { trace }),
    };
    process.stdout.write(JSON.stringify(entry) + "\n");
  }
}
