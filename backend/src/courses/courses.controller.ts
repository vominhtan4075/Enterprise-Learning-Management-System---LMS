import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { CoursesService } from './courses.service.js';
import {
  CreateCourseDto,
  PublishCourseDto,
  QueryCoursesDto,
  UpdateCourseDto,
} from './dto/course.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';

@ApiTags('Courses')
@ApiBearerAuth()
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo khóa học mới ở trạng thái nháp (TRAINER, ADMIN)',
  })
  @ApiResponse({ status: 201, description: 'Tạo khóa học thành công' })
  @ApiResponse({ status: 409, description: 'Trùng mã khóa học (code)' })
  create(
    @Body() dto: CreateCourseDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.coursesService.create(dto, actor);
  }

  @Get()
  @ApiOperation({
    summary:
      'Lấy danh sách khóa học có phân trang & bộ lọc (EMPLOYEE chỉ thấy khóa học được giao)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách khóa học phân trang' })
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryCoursesDto,
  ) {
    return this.coursesService.findAll(actor, query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Lấy chi tiết khóa học kèm cây học phần (modules), bài giảng (lessons) và quiz',
  })
  @ApiParam({ name: 'id', description: 'ID của khóa học' })
  @ApiResponse({ status: 200, description: 'Cây cấu trúc khóa học' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy khóa học' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.coursesService.findOne(id, actor);
  }

  @Put(':id')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary: 'Cập nhật thông tin khóa học (Owner TRAINER, ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID của khóa học' })
  @ApiResponse({ status: 200, description: 'Cập nhật khóa học thành công' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.coursesService.update(id, dto, actor);
  }

  @Patch(':id/publish')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Xuất bản hoặc hủy xuất bản khóa học (Yêu cầu >= 1 module và >= 1 lesson)',
  })
  @ApiParam({ name: 'id', description: 'ID của khóa học' })
  @ApiResponse({ status: 200, description: 'Thay đổi trạng thái xuất bản thành công' })
  publish(
    @Param('id') id: string,
    @Body() dto: PublishCourseDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.coursesService.publish(id, dto, actor);
  }

  @Delete(':id')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Xóa mềm khóa học (Chặn nếu khóa học đang nằm trong Lộ trình hoặc có học viên đang học)',
  })
  @ApiParam({ name: 'id', description: 'ID của khóa học' })
  @ApiResponse({ status: 200, description: 'Xóa mềm khóa học thành công' })
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.coursesService.remove(id, actor);
  }
}

