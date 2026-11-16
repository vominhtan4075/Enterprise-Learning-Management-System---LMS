import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EnrollmentsService } from './enrollments.service.js';
import {
  AssignPathDto,
  CreateEnrollmentDto,
  QueryEnrollmentsDto,
  UpdateEnrollmentDto,
} from './dto/enrollment.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';

@ApiTags('Enrollments')
@ApiBearerAuth()
@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post('enrollments')
  @Roles(RoleCode.HR, RoleCode.TRAINER, RoleCode.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Giao khóa học lẻ (courseId) hoặc lộ trình (pathId) cho cá nhân / phòng ban / cấp bậc (HR, TRAINER, ADMIN)',
  })
  @ApiResponse({
    status: 201,
    description:
      'Giao bài thành công (Trả về createdCount, skippedCount, enrollmentIds, skipped)',
  })
  @ApiResponse({ status: 409, description: 'Giao đơn lẻ cho học viên đã có bản ghi giao bài' })
  @ApiResponse({
    status: 422,
    description:
      'Khóa học chưa xuất bản, lộ trình sai cấu trúc (PATH_STRUCTURE_INVALID) hoặc không tìm thấy nhân viên',
  })
  assign(
    @Body() dto: CreateEnrollmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.enrollmentsService.assign(dto, actor);
  }

  @Post('assignments/path')
  @Roles(RoleCode.HR, RoleCode.TRAINER, RoleCode.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Giao lộ trình học tập theo vị trí nhân sự (targetPosition), phòng ban hoặc danh sách nhân viên ([W2] /assignments/path)',
  })
  @ApiResponse({ status: 201, description: 'Giao lộ trình thành công' })
  assignPath(
    @Body() dto: AssignPathDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.enrollmentsService.assignPath(dto, actor);
  }

  @Get('enrollments')
  @ApiOperation({
    summary:
      'Lấy danh sách ghi danh khóa học & lộ trình (HR/ADMIN: toàn bộ; TRAINER: do mình giao; EMPLOYEE: của chính mình)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách ghi danh phân trang' })
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryEnrollmentsDto,
  ) {
    return this.enrollmentsService.findAll(actor, query);
  }

  @Get('enrollments/:id')
  @ApiOperation({
    summary: 'Xem chi tiết một bản ghi giao bài (Kiểm tra phạm vi quyền xem theo Role)',
  })
  @ApiParam({ name: 'id', description: 'ID của bản ghi CourseEnrollment hoặc PathEnrollment' })
  @ApiResponse({ status: 200, description: 'Chi tiết bản ghi giao bài' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hoặc ngoài phạm vi truy cập' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.enrollmentsService.findOne(id, actor);
  }

  @Put('enrollments/:id')
  @Roles(RoleCode.HR, RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Gia hạn / cập nhật hạn chót (deadline) của bản ghi giao bài và đặt lại nhắc hạn (HR, ADMIN; TRAINER chỉ sửa bài do mình giao)',
  })
  @ApiParam({ name: 'id', description: 'ID của bản ghi giao bài' })
  @ApiResponse({ status: 200, description: 'Cập nhật hạn chót thành công' })
  updateDeadline(
    @Param('id') id: string,
    @Body() dto: UpdateEnrollmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.enrollmentsService.updateDeadline(id, dto, actor);
  }

  @Delete('enrollments/:id')
  @Roles(RoleCode.HR, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Hủy bản ghi giao bài (HR, ADMIN – Giữ nguyên lịch sử tiến độ UserProgress và QuizAttempt theo D-19)',
  })
  @ApiParam({ name: 'id', description: 'ID của bản ghi giao bài' })
  @ApiResponse({ status: 200, description: 'Xóa bản ghi giao bài thành công' })
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.enrollmentsService.remove(id, actor);
  }
}
