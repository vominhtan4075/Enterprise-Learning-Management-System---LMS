import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { HrmEmploymentStatus, SyncHrmUsersDto } from './dto/sync-user.dto.js';
import { HrmService } from './hrm.service.js';

@ApiTags('Mock HRM Integration')
@Public()
@ApiBearerAuth()
@Controller('hrm')
export class HrmController {
  constructor(private readonly hrmService: HrmService) {}

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
  @ApiQuery({
    name: 'status',
    required: false,
    enum: HrmEmploymentStatus,
    description: 'Lọc nhân sự theo trạng thái làm việc (ACTIVE hoặc RESIGNED)',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về danh sách nhân sự giả lập từ HRM thành công',
  })
  getMockEmployees(
    @Query('department') department?: string,
    @Query('status') status?: string,
  ) {
    return this.hrmService.getMockEmployees(department, status);
  }

  // TODO(Tuần 4 - chờ Lead chốt route với SV02 Quang Hưng):
  // Endpoint xem lịch sử đồng bộ HRM hiện có 2 đặc tả: GET /api/v1/hrm/logs và GET /api/v1/reports/hrm-sync-logs.
  // Dữ liệu log đã được ghi đầy đủ vào bảng hrm_sync_logs trong HrmService.

  @Post('sync-users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Mock HRM API: Đồng bộ nhân sự mới, xử lý thay đổi chức danh hoặc nghỉ việc và ghi vết vào hrm_sync_logs',
  })
  @ApiResponse({
    status: 201,
    description:
      'Đồng bộ dữ liệu nhân sự thành công (tạo mới, cập nhật chức danh, vô hiệu hóa tài khoản nghỉ việc và ghi log).',
  })
  @ApiResponse({
    status: 400,
    description:
      'Dữ liệu đầu vào không hợp lệ (Thiếu trường bắt buộc, sai định dạng email, ngày hoặc trạng thái).',
  })
  async syncUsers(@Body() payload: SyncHrmUsersDto) {
    return this.hrmService.syncUsers(payload);
  }
}