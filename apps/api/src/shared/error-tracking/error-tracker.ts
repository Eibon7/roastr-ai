export interface ErrorTracker {
  captureException(error: Error, context?: Record<string, unknown>): void;
  captureMessage(message: string, level?: "info" | "warning" | "error"): void;
}

export class ConsoleErrorTracker implements ErrorTracker {
  captureException(error: Error, context?: Record<string, unknown>): void {
    console.error("[ErrorTracker]", error, context);
  }

  captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
    const tag = `[ErrorTracker:${level}]`;
    switch (level) {
      case "error":
        console.error(tag, message);
        break;
      case "warning":
        console.warn(tag, message);
        break;
      default:
        console.info(tag, message);
        break;
    }
  }
}
