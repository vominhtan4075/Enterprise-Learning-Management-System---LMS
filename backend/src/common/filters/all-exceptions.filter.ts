import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ErrorCode } from '../constants/error-codes.js';
import { BusinessException } from '../exceptions/business.exception.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request?.headers?.['x-request-id'] as string | undefined) ??
      randomUUID();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi hệ thống nội bộ. Vui lòng thử lại sau.';
    let errorCode: string = ErrorCode.INTERNAL_SERVER_ERROR;
    let details: unknown[] | undefined;

    if (exception instanceof BusinessException) {
      statusCode = exception.getStatus();
      message = exception.message;
      errorCode = exception.errorCode;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      errorCode = this.mapStatusToErrorCode(statusCode);

      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const resObj = res as Record<string, unknown>;
        if (typeof resObj.errorCode === 'string') {
          errorCode = resObj.errorCode;
        }
        if (Array.isArray(resObj.message)) {
          details = resObj.message;
          message = resObj.message.join('; ');
        } else if (typeof resObj.message === 'string') {
          message = resObj.message;
        }
        if (Array.isArray(resObj.details)) {
          details = resObj.details;
        }
      }
    } else if (this.isPrismaKnownError(exception)) {
      const prismaErr = exception as {
        code: string;
        meta?: Record<string, unknown>;
      };
      if (prismaErr.code === 'P2002') {
        statusCode = HttpStatus.CONFLICT;
        errorCode = ErrorCode.CONFLICT;
        const target = Array.isArray(prismaErr.meta?.target)
          ? (prismaErr.meta.target as string[]).join(', ')
          : 'dữ liệu';
        message = `Bản ghi bị trùng lặp giá trị duy nhất (${target}).`;
      } else if (prismaErr.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        errorCode = ErrorCode.NOT_FOUND;
        message = 'Không tìm thấy bản ghi yêu cầu.';
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `[${requestId}] Unhandled error on ${request?.method} ${request?.url}: ${exception.message}`,
        exception.stack,
      );
    }

    const payload: Record<string, unknown> = {
      statusCode,
      message,
      errorCode,
      timestamp: new Date().toISOString(),
      path: request?.url ?? '',
      method: request?.method ?? '',
      requestId,
    };

    if (details && details.length > 0) {
      payload.details = details;
    }

    response.status(statusCode).json(payload);
  }

  private isPrismaKnownError(
    exception: unknown,
  ): exception is { code: string; meta?: Record<string, unknown> } {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof (exception as Record<string, unknown>).code === 'string' &&
      ((exception as Record<string, unknown>).code as string).startsWith('P2')
    );
  }

  private mapStatusToErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.AUTH_UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.AUTH_FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ErrorCode.UNPROCESSABLE_ENTITY;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.TOO_MANY_REQUESTS;
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR;
    }
  }
}

