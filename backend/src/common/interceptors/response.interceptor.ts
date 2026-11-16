import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly useEnvelope?: boolean) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const envelopeEnabled =
      this.useEnvelope ?? process.env.RESPONSE_ENVELOPE === 'true';

    if (!envelopeEnabled) {
      return next.handle();
    }

    const httpCtx = context.switchToHttp();
    const response = httpCtx.getResponse<Response>();

    return next.handle().pipe(
      map((body: unknown) => {
        if (
          body instanceof StreamableFile ||
          Buffer.isBuffer(body) ||
          body === undefined ||
          body === null
        ) {
          return body;
        }

        if (
          typeof body === 'object' &&
          'statusCode' in (body as Record<string, unknown>) &&
          'data' in (body as Record<string, unknown>)
        ) {
          return body;
        }

        return {
          statusCode: response?.statusCode ?? 200,
          data: body,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}

