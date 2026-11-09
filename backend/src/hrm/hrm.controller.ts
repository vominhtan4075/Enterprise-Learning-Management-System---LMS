import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
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
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Mock HRM Integration')
@Public()
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
}