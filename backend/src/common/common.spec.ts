import {
  ArgumentsHost,
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { paginate } from './utils/pagination.util.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { BusinessException } from './exceptions/business.exception.js';
import { ErrorCode } from './constants/error-codes.js';
import { ResponseInterceptor } from './interceptors/response.interceptor.js';

describe('Common Infrastructure (WP1)', () => {
  describe('paginate()', () => {
    it('nên tính toán đúng page, limit và totalPages', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const result = paginate(items, 45, 2, 20);
      expect(result).toEqual({
        data: items,
        total: 45,
        page: 2,
        limit: 20,
        totalPages: 3,
      });
    });

    it('nên trả về totalPages = 0 khi total = 0 và giới hạn limit tối đa 100', () => {
      const result = paginate([], 0, 0, 500);
      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 100,
        totalPages: 0,
      });
    });
  });

  describe('AllExceptionsFilter', () => {
    let filter: AllExceptionsFilter;
    let statusMock: { json: (body: Record<string, unknown>) => void };
    let capturedStatus: number;
    let capturedBody: Record<string, unknown>;
    let mockHost: ArgumentsHost;

    beforeEach(() => {
      filter = new AllExceptionsFilter();
      capturedStatus = 0;
      capturedBody = {};
      statusMock = {
        json: (body: Record<string, unknown>) => {
          capturedBody = body;
        },
      };
      mockHost = {
        switchToHttp: () => ({
          getResponse: () => ({
            status: (code: number) => {
              capturedStatus = code;
              return statusMock;
            },
          }),
          getRequest: () => ({
            url: '/api/v1/lessons/lesson-1',
            method: 'GET',
            headers: { 'x-request-id': 'req-123' },
          }),
        }),
      } as unknown as ArgumentsHost;
    });

    it('nên format đúng BusinessException (ví dụ BR02_LOCK_CONSTRAINT 422)', () => {
      const exception = new BusinessException(
        ErrorCode.BR02_LOCK_CONSTRAINT,
        'Bài học đã bị khóa.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );

      filter.catch(exception, mockHost);

      expect(capturedStatus).toBe(422);
      expect(capturedBody.statusCode).toBe(422);
      expect(capturedBody.errorCode).toBe('BR02_LOCK_CONSTRAINT');
      expect(capturedBody.message).toBe('Bài học đã bị khóa.');
      expect(capturedBody.path).toBe('/api/v1/lessons/lesson-1');
      expect(capturedBody.requestId).toBe('req-123');
    });

    it('nên ánh xạ lỗi Prisma P2002 sang 409 CONFLICT và P2025 sang 404 NOT_FOUND', () => {
      filter.catch({ code: 'P2002', meta: { target: ['email'] } }, mockHost);
      expect(capturedStatus).toBe(409);
      expect(capturedBody.errorCode).toBe(ErrorCode.CONFLICT);

      filter.catch({ code: 'P2025' }, mockHost);
      expect(capturedStatus).toBe(404);
      expect(capturedBody.errorCode).toBe(ErrorCode.NOT_FOUND);
    });

    it('nên giữ nguyên errorCode tùy chỉnh và details khi bắt BadRequestException', () => {
      const exception = new BadRequestException({
        statusCode: 400,
        message: ['email không hợp lệ', 'fullName không được để trống'],
        errorCode: 'BAD_REQUEST',
      });

      filter.catch(exception, mockHost);

      expect(capturedStatus).toBe(400);
      expect(capturedBody.errorCode).toBe('BAD_REQUEST');
      expect(capturedBody.details).toEqual([
        'email không hợp lệ',
        'fullName không được để trống',
      ]);
    });
  });

  describe('ResponseInterceptor', () => {
    const mockContext = {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;

    const mockNext: CallHandler = {
      handle: () => of({ id: 'course-1', title: 'Java Core' }),
    };

    it('nên trả về dữ liệu phẳng (flat JSON) khi RESPONSE_ENVELOPE = false', async () => {
      const interceptor = new ResponseInterceptor(false);
      const res = await firstValueFrom(
        interceptor.intercept(mockContext, mockNext),
      );
      expect(res).toEqual({ id: 'course-1', title: 'Java Core' });
    });

    it('nên bọc dữ liệu trong { statusCode, data, timestamp } khi RESPONSE_ENVELOPE = true', async () => {
      const interceptor = new ResponseInterceptor(true);
      const res = (await firstValueFrom(
        interceptor.intercept(mockContext, mockNext),
      )) as Record<string, unknown>;
      expect(res.statusCode).toBe(200);
      expect(res.data).toEqual({ id: 'course-1', title: 'Java Core' });
      expect(typeof res.timestamp).toBe('string');
    });
  });
});

