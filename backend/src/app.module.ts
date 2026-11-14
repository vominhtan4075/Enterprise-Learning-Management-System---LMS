import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { PrismaModule } from './prisma.module.js';
import { RedisModule } from './common/redis/redis.module.js';
import { envValidationSchema } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { CoursesModule } from './courses/courses.module.js';
import { ModulesModule } from './modules/modules.module.js';
import { FilesModule } from './files/files.module.js';
import { LessonsModule } from './lessons/lessons.module.js';
import { HrmModule } from './hrm/hrm.module.js';
import { QuizModule } from './quiz/quiz.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { MustChangePasswordGuard } from './auth/guards/must-change-password.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
        genReqId: (req: IncomingMessage) =>
          (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers["x-api-key"]',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 200,
      },
    ]),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    ModulesModule,
    FilesModule,
    LessonsModule,
    HrmModule,
    QuizModule,
  ],
  providers: [
    // Guard toàn cục – chạy theo đúng thứ tự khai báo (WP1 1.10, WP3):
    // rate limit → xác thực JWT → chặn khi bắt buộc đổi mật khẩu → kiểm tra role
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
