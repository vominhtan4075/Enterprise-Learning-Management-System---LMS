import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { HrmService } from './hrm.service.js';
import { SyncHrmUsersDto } from './dto/sync-user.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';

@ApiTags('Mock HRM Integration')
@Roles(RoleCode.ADMIN, RoleCode.HR)
@ApiBearerAuth()
@Controller('hrm')
export class HrmController {
  constructor(private readonly hrmService: HrmService) { }

  @Get('employees')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy danh sách nhân sự giả lập từ hệ thống HRM NovaTech',
  })
  @ApiQuery({
    name: 'department',
    required: false,
    description: 'Lọc nhân sự theo tên phòng ban (VD: Software Engineering)',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về danh sách nhân sự giả lập từ HRM thành công',
  })
  getMockEmployees(@Query('department') department?: string) {
    return this.hrmService.getMockEmployees(department);
  }

  @Post('sync-users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Mock HRM API: Tiếp nhận đồng bộ dữ liệu nhân sự mới và tự động gán Lộ trình Onboarding 30 ngày',
  })
  @ApiResponse({
    status: 201,
    description:
      'Đã đồng bộ nhân sự mới và tự động gán Lộ trình Onboarding 30 ngày.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Dữ liệu đầu vào không hợp lệ (Thiếu trường bắt buộc hoặc sai định dạng email).',
  })
  async syncUsers(@Body() payload: SyncHrmUsersDto) {
    return this.hrmService.syncUsers(payload);
  }

  @Get('sync-history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy lịch sử đồng bộ HRM có phân trang và lọc' })
  getSyncHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.hrmService.getSyncHistory({ page, limit, status, search });
  }

  @Get('sync-history/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xem chi tiết một lần đồng bộ HRM' })
  getSyncHistoryDetail(@Param('id') id: string) {
    return this.hrmService.getSyncHistoryDetail(id);
  }
}