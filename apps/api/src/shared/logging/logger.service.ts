import { Injectable } from "@nestjs/common";
import { Logger as SharedLogger } from "@roastr/shared";

@Injectable()
export class LoggerService extends SharedLogger {
  constructor() {
    super({ service: "api" });
  }
}
