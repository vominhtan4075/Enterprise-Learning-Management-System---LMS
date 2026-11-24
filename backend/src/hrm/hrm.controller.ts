import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';
import { QueryHrmSyncLogsDto, QueryHrmTrainingStatusDto } from './dto/query-hrm.dto.js';
import { HrmEmploymentStatus, SyncHrmUsersDto } from './dto/sync-user.dto.js';
import { HrmService } from './hrm.service.js';

@ApiTags('Mock HRM Integration')
@ApiBearerAuth()
@Controller('hrm')
export class HrmController {
  constructor(private readonly hrmService: HrmService) {}

  @Public()
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

  @Public()
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

  @Get('sync-logs')
  @Roles(RoleCode.ADMIN, RoleCode.HR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tra cứu danh sách lịch sử đồng bộ HRM có phân trang, tìm kiếm và lọc trạng thái (ADMIN, HR)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách HrmSyncLog phân trang ({ data, total, page, limit, totalPages })',
  })
  getSyncLogs(@Query() query: QueryHrmSyncLogsDto) {
    return this.hrmService.getSyncLogs(query);
  }

  @Get('sync-logs/:id')
  @Roles(RoleCode.ADMIN, RoleCode.HR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xem chi tiết một bản ghi lịch sử đồng bộ HRM (ADMIN, HR)',
  })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết bản ghi HrmSyncLog',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy lịch sử đồng bộ',
  })
  getSyncLogDetail(@Param('id') id: string) {
    return this.hrmService.getSyncLogDetail(id);
  }

  @Get('training-status')
  @Roles(RoleCode.ADMIN, RoleCode.HR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trả về trạng thái đào tạo, tiến độ lộ trình/khóa học và điểm năng lực của nhân viên cho HRM (ADMIN, HR)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách trạng thái đào tạo phân trang theo nhân viên',
  })
  getTrainingStatus(@Query() query: QueryHrmTrainingStatusDto) {
    return this.hrmService.getTrainingStatus(query);
  }
}