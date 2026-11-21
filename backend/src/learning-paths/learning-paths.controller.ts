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
import { LearningPathsService } from './learning-paths.service.js';
import {
  AddCourseToPathDto,
  CreateLearningPathDto,
  QueryLearningPathsDto,
  ReorderPathCoursesDto,
  UpdateLearningPathDto,
} from './dto/learning-path.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';

@ApiTags('Learning Paths')
@ApiBearerAuth()
@Controller('learning-paths')
export class LearningPathsController {
  constructor(private readonly learningPathsService: LearningPathsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lấy danh sách lộ trình học tập theo vị trí (EMPLOYEE chỉ thấy lộ trình được giao)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách lộ trình học tập' })
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryLearningPathsDto,
  ) {
    return this.learningPathsService.findAll(actor, query);
  }

  @Post()
  @Roles(RoleCode.HR, RoleCode.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Tạo lộ trình học tập mới theo vị trí công việc (HR, ADMIN – Tự sinh slug code nếu thiếu)',
  })
  @ApiResponse({ status: 201, description: 'Tạo lộ trình thành công' })
  @ApiResponse({ status: 409, description: 'Trùng mã lộ trình (code)' })
  create(
    @Body() dto: CreateLearningPathDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.learningPathsService.create(dto, actor);
  }

  @Get(':id/validation')
  @Roles(RoleCode.HR, RoleCode.ADMIN, RoleCode.TRAINER)
  @ApiOperation({
    summary:
      'Kiểm tra cấu trúc chuẩn của lộ trình (4 học phần MODULE + 1 bài kiểm tra FINAL ở cuối – LP-1..LP-3)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID hoặc mã code của lộ trình (VD: path-fresher-java)',
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả kiểm tra cấu trúc lộ trình (valid, unitCount, hasFinal, finalIsLast, issues)',
  })
  validateStructure(@Param('id') idOrCode: string) {
    return this.learningPathsService.validateStructure(idOrCode);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Xem chi tiết cấu trúc lộ trình kèm danh sách khóa học, học phần, bài học và quiz (Hỗ trợ tra theo id hoặc code)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID hoặc mã code của lộ trình (VD: path-fresher-java)',
  })
  @ApiResponse({ status: 200, description: 'Cấu trúc chi tiết lộ trình' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lộ trình' })
  findOne(
    @Param('id') idOrCode: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.learningPathsService.findOne(idOrCode, actor);
  }

  @Put(':id')
  @Roles(RoleCode.HR, RoleCode.ADMIN)
  @ApiOperation({
    summary: 'Cập nhật thông tin lộ trình học tập (HR, ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID của lộ trình' })
  @ApiResponse({ status: 200, description: 'Cập nhật lộ trình thành công' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLearningPathDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.learningPathsService.update(id, dto, actor);
  }

  @Delete(':id')
  @Roles(RoleCode.HR, RoleCode.ADMIN)
  @ApiOperation({
    summary: 'Lưu trữ (archive) lộ trình học tập (HR, ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID của lộ trình' })
  @ApiResponse({ status: 200, description: 'Lưu trữ lộ trình thành công' })
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.learningPathsService.remove(id, actor);
  }

  @Post(':id/courses')
  @Roles(RoleCode.HR, RoleCode.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Thêm khóa học đã xuất bản vào lộ trình (Chặn 422 PATH_IN_USE nếu lộ trình đã có học viên theo LP-6)',
  })
  @ApiParam({ name: 'id', description: 'ID của lộ trình' })
  @ApiResponse({ status: 201, description: 'Thêm khóa học vào lộ trình thành công' })
  @ApiResponse({ status: 409, description: 'Khóa học đã có trong lộ trình' })
  @ApiResponse({ status: 422, description: 'Khóa học chưa publish hoặc lộ trình đang được sử dụng (PATH_IN_USE)' })
  addCourse(
    @Param('id') pathId: string,
    @Body() dto: AddCourseToPathDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.learningPathsService.addCourse(pathId, dto, actor);
  }

  @Put(':id/courses/order')
  @Roles(RoleCode.HR, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Sắp xếp lại thứ tự các khóa học trong lộ trình bằng thao tác kéo-thả (Transaction 2 bước – HR, ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID của lộ trình' })
  @ApiResponse({ status: 200, description: 'Sắp xếp thứ tự khóa học thành công' })
  reorderCourses(
    @Param('id') pathId: string,
    @Body() dto: ReorderPathCoursesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.learningPathsService.reorderCourses(pathId, dto, actor);
  }

  @Delete(':id/courses/:courseId')
  @Roles(RoleCode.HR, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Gỡ khóa học khỏi lộ trình & dồn lại stepOrder (Chặn 422 PATH_IN_USE nếu lộ trình đã được giao)',
  })
  @ApiParam({ name: 'id', description: 'ID của lộ trình' })
  @ApiParam({ name: 'courseId', description: 'ID của khóa học cần gỡ' })
  @ApiResponse({ status: 200, description: 'Gỡ khóa học khỏi lộ trình thành công' })
  removeCourse(
    @Param('id') pathId: string,
    @Param('courseId') courseId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.learningPathsService.removeCourse(pathId, courseId, actor);
  }
}
