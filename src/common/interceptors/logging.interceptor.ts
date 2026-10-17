import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string) || 'none';
    const method = req.method;
    const url = req.originalUrl || req.url;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const statusCode = res.statusCode;
          this.logger.log(
            `[${correlationId}] ${method} ${url} ${statusCode} - ${duration}ms`,
          );
        },
        error: (err) => {
          const duration = Date.now() - start;
          const status = err.status || 500;
          this.logger.warn(
            `[${correlationId}] ${method} ${url} ${status} - ${duration}ms (${err.message})`,
          );
        },
      }),
    );
  }
}
