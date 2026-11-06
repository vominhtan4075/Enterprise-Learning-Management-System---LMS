import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Kiểm tra trạng thái server, kết nối Database & CORS' })
  @ApiResponse({ status: 200, description: 'Hệ thống hoạt động bình thường' })
  async check() {
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
        cors: {
          status: 'enabled',
          allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        },
      };
    } catch (error: any) {
      return {
        status: 'error',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: {
          status: 'disconnected',
          error: error?.message || 'Cannot connect to database',
        },
      };
    }
  }
}
