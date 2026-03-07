import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, finalize } from "rxjs";
import { randomUUID } from "crypto";

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.headers["x-request-id"] || randomUUID();
    const start = Date.now();

    request.requestId = requestId;

    return next.handle().pipe(
      finalize(() => {
        const duration = Date.now() - start;
        const response = context.switchToHttp().getResponse();
        if (!response.headersSent) {
          response.setHeader("x-request-id", requestId);
          response.setHeader("x-response-time", `${duration}ms`);
        }
      }),
    );
  }
}
