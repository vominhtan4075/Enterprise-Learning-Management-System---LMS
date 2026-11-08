import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Kiểm tra toàn bộ trạng thái hệ thống (Server, PostgreSQL, Redis & CORS)',
  })
  @ApiResponse({ status: 200, description: 'Hệ thống hoạt động bình thường' })
  async check() {
    const redisConnected = await this.redis.ping();

    try {
      const userCount = await this.prisma.user.count();
      return {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: {
          status: 'connected',
          userCount,
        },
        redis: {
          status: redisConnected ? 'connected' : 'fallback_db',
        },
        cors: {
          status: 'enabled',
          allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        },
      };
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : 'Cannot connect to database';
      return {
        status: 'error',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: {
          status: 'disconnected',
          error: errMsg,
        },
        redis: {
          status: redisConnected ? 'connected' : 'fallback_db',
        },
      };
    }
  }
}
