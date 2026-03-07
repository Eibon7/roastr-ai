export interface ErrorTracker {
  captureException(error: Error, context?: Record<string, unknown>): void;
  captureMessage(message: string, level?: "info" | "warning" | "error"): void;
}

export class ConsoleErrorTracker implements ErrorTracker {
  captureException(error: Error, context?: Record<string, unknown>): void {
    console.error("[ErrorTracker]", error.message, context);
  }

  captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
    console.log(`[ErrorTracker:${level}]`, message);
  }
}
