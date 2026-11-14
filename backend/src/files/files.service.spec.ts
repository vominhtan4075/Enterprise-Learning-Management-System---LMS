import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FilesService } from './files.service.js';
import { PrismaService } from '../prisma.service.js';
import { CoursesService } from '../courses/courses.service.js';
import { PositionLevel, RoleCode } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

describe('FilesService (WP5 – 5.4 File Service)', () => {
  let service: FilesService;
  let prismaMock: {
    file: {
      create: ReturnType<typeof jest.fn>;
      findUnique: ReturnType<typeof jest.fn>;
      delete: ReturnType<typeof jest.fn>;
    };
  };
  let configMock: {
    get: ReturnType<typeof jest.fn>;
  };
  let coursesServiceMock: {
    isUserEnrolledInCourse: ReturnType<typeof jest.fn>;
  };

  const trainerA: AuthenticatedUser = {
    id: 'trainer-a',
    email: 'trainer.a@novatech.com',
    fullName: 'Trainer A',
    role: RoleCode.TRAINER,
    position: PositionLevel.SENIOR,
    department: 'Training',
    mustChangePassword: false,
    tokenVersion: 0,
  };

  const trainerB: AuthenticatedUser = {
    id: 'trainer-b',
    email: 'trainer.b@novatech.com',
    fullName: 'Trainer B',
    role: RoleCode.TRAINER,
    position: PositionLevel.SENIOR,
    department: 'Training',
    mustChangePassword: false,
    tokenVersion: 0,
  };

  const employeeUser: AuthenticatedUser = {
    id: 'emp-1',
    email: 'emp1@novatech.com',
    fullName: 'Employee 1',
    role: RoleCode.EMPLOYEE,
    position: PositionLevel.FRESHER,
    department: 'Engineering',
    mustChangePassword: false,
    tokenVersion: 0,
  };

  beforeEach(() => {
    prismaMock = {
      file: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };

    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'UPLOAD_DIR') return join(tmpdir(), 'lms-test-uploads');
        if (key === 'MAX_UPLOAD_MB') return 20;
        return undefined;
      }),
    };

    coursesServiceMock = {
      isUserEnrolledInCourse: jest.fn().mockResolvedValue(false as never),
    };

    service = new FilesService(
      prismaMock as unknown as PrismaService,
      configMock as unknown as ConfigService,
      coursesServiceMock as unknown as CoursesService,
    );
  });

  describe('uploadPdf() & validatePdfBuffer()', () => {
    it('nên chặn tệp .exe đổi đuôi thành .pdf (sai magic bytes %PDF-) -> 400 BAD_REQUEST', async () => {
      const fakeExeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00fake-exe-content');

      await expect(
        service.uploadPdf(
          {
            originalname: 'malware.pdf',
            mimetype: 'application/pdf',
            size: fakeExeBuffer.length,
            buffer: fakeExeBuffer,
          },
          trainerA,
        ),
      ).rejects.toMatchObject({
        errorCode: 'BAD_REQUEST',
        status: 400,
      });
    });

    it('nên chặn tệp vượt quá giới hạn MAX_UPLOAD_MB -> 400 BAD_REQUEST', async () => {
      const validHeader = Buffer.from('%PDF-1.7 dummy');

      await expect(
        service.uploadPdf(
          {
            originalname: 'huge.pdf',
            mimetype: 'application/pdf',
            size: 25 * 1024 * 1024, // 25 MB > 20 MB
            buffer: validHeader,
          },
          trainerA,
        ),
      ).rejects.toMatchObject({
        errorCode: 'BAD_REQUEST',
        status: 400,
      });
    });

    it('nên lưu tệp PDF hợp lệ, tính SHA-256 checksum và ghi metadata vào DB', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
      prismaMock.file.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'file-uuid-1',
          createdAt: new Date(),
          ...args.data,
        }),
      );

      const res = await service.uploadPdf(
        {
          originalname: 'java-core-slide.pdf',
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
          buffer: pdfBuffer,
        },
        trainerA,
      );

      expect(res.id).toBe('file-uuid-1');
      expect(res.mimeType).toBe('application/pdf');
      expect(res.checksum).toHaveLength(64);
      expect(res.url).toBe('/api/v1/files/file-uuid-1');
    });
  });

  describe('downloadFile()', () => {
    it('EMPLOYEE tải tệp của khóa học chưa được giao -> 403 COURSE_NOT_ENROLLED', async () => {
      prismaMock.file.findUnique.mockResolvedValue({
        id: 'file-1',
        storageKey: 'abc.pdf',
        originalName: 'slide.pdf',
        mimeType: 'application/pdf',
        lessons: [
          {
            id: 'lesson-1',
            module: {
              deletedAt: null,
              courseId: 'course-1',
              course: { id: 'course-1', isPublished: true, deletedAt: null },
            },
          },
        ],
      } as never);
      coursesServiceMock.isUserEnrolledInCourse.mockResolvedValue(false as never);

      await expect(
        service.downloadFile('file-1', employeeUser),
      ).rejects.toMatchObject({
        errorCode: 'NOT_ENROLLED',
        status: 403,
      });
    });
  });

  describe('remove()', () => {
    it('Trainer B xóa tệp của Trainer A -> 403 AUTH_FORBIDDEN', async () => {
      prismaMock.file.findUnique.mockResolvedValue({
        id: 'file-1',
        uploadedById: trainerA.id,
        lessons: [],
      } as never);

      await expect(
        service.remove('file-1', trainerB),
      ).rejects.toMatchObject({
        errorCode: 'AUTH_FORBIDDEN',
        status: 403,
      });
    });

    it('chặn xóa tệp đang được gắn với bài học đang hoạt động -> 422 UNPROCESSABLE_ENTITY', async () => {
      prismaMock.file.findUnique.mockResolvedValue({
        id: 'file-1',
        uploadedById: trainerA.id,
        lessons: [{ id: 'lesson-1', title: 'Bài 1: Giới thiệu Java' }],
      } as never);

      await expect(
        service.remove('file-1', trainerA),
      ).rejects.toMatchObject({
        errorCode: 'UNPROCESSABLE_ENTITY',
        status: 422,
      });
    });
  });
});

