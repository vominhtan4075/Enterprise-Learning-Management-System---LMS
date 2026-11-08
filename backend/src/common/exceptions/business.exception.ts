import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.js';

export class BusinessException extends HttpException {
  public readonly errorCode: ErrorCode | string;
  public readonly details?: unknown[];

  constructor(
    errorCode: ErrorCode | string,
    message: string,
    status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
    details?: unknown[],
  ) {
    super(
      {
        statusCode: status,
        message,
        errorCode,
        ...(details ? { details } : {}),
      },
      status,
    );
    this.errorCode = errorCode;
    this.details = details;
  }
}

