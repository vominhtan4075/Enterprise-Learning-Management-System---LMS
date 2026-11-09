import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Kiểm tra trạng thái hoạt động của hệ thống (Server, PostgreSQL & Redis)',
  })
  @ApiResponse({ status: 200, description: 'Hệ thống hoạt động bình thường' })
  @ApiResponse({
    status: 503,
    description: 'Cơ sở dữ liệu không sẵn sàng',
  })
  async check() {
    const redisConnected = await this.redis.ping();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: {
          status: 'connected',
        },
        redis: {
          status: redisConnected ? 'connected' : 'fallback_db',
        },
      };
    } catch (error: unknown) {
      this.logger.error(
        `Database healthcheck failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new HttpException(
        {
          status: 'error',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          database: {
            status: 'disconnected',
          },
          redis: {
            status: redisConnected ? 'connected' : 'fallback_db',
          },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
