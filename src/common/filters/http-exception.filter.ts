import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId =
      (request.headers[CORRELATION_ID_HEADER] as string) || 'none';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let errorType = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const body = exceptionResponse as Record<string, unknown>;
        message = (body.message as string | object) || exception.message;
        errorType = (body.error as string) || exception.name;
      }
    } else if (exception instanceof Error) {
      // Prisma known constraint errors or domain errors
      if (exception.name === 'PrismaClientKnownRequestError') {
        const prismaError = exception as { code?: string; meta?: unknown };
        if (prismaError.code === 'P2002') {
          status = HttpStatus.CONFLICT;
          errorType = 'Conflict';
          message = 'A resource with this unique identifier already exists.';
        } else if (prismaError.code === 'P2025') {
          status = HttpStatus.NOT_FOUND;
          errorType = 'Not Found';
          message = 'Record to operate on was not found.';
        }
      }
      this.logger.error(
        `[${correlationId}] Unhandled exception on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      error: errorType,
      message,
      path: request.url,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}
