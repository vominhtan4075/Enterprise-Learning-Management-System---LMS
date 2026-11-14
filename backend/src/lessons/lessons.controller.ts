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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LessonsService } from './lessons.service.js';
import {
  CreateLessonDto,
  ReorderLessonsDto,
  UpdateLessonDto,
} from './dto/lesson.dto.js';
import type { UploadedFilePayload } from '../files/files.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';

@ApiTags('Lessons')
@ApiBearerAuth()
@Controller()
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post('modules/:id/lessons')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({
    summary:
      'Tạo bài học mới trong học phần – Hỗ trợ VIDEO (URL http/https), PDF (multipart file hoặc fileId), MARKDOWN (contentText) (Owner TRAINER, ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID của học phần (moduleId)' })
  @ApiResponse({ status: 201, description: 'Tạo bài học thành công' })
  create(
    @Param('id') moduleId: string,
    @Body() dto: CreateLessonDto,
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile() file?: UploadedFilePayload,
  ) {
    return this.lessonsService.create(moduleId, dto, actor, file);
  }

  @Get('lessons/:id')
  @ApiOperation({
    summary:
      'Xem chi tiết bài học (EMPLOYEE bắt buộc đã ghi danh vào khóa học chứa bài học)',
  })
  @ApiParam({ name: 'id', description: 'ID của bài học (lessonId)' })
  @ApiResponse({ status: 200, description: 'Chi tiết bài học' })
  @ApiResponse({ status: 403, description: 'Chưa ghi danh vào khóa học' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài học' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.lessonsService.findOne(id, actor);
  }

  @Get('lessons/:id/content')
  @ApiOperation({
    summary:
      'Lấy nội dung bài học MARKDOWN nội tuyến (Endpoint đích của contentUrl /api/v1/lessons/:id/content)',
  })
  @ApiParam({ name: 'id', description: 'ID của bài học (lessonId)' })
  @ApiResponse({ status: 200, description: 'Nội dung bài học' })
  getContent(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.lessonsService.getContent(id, actor);
  }

  @Put('lessons/:id')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({
    summary: 'Cập nhật bài học (Owner TRAINER, ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID của bài học (lessonId)' })
  @ApiResponse({ status: 200, description: 'Cập nhật bài học thành công' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile() file?: UploadedFilePayload,
  ) {
    return this.lessonsService.update(id, dto, actor, file);
  }

  @Delete('lessons/:id')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Xóa mềm bài học & dồn lại thứ tự (Trả kèm referencedQuestionsCount nếu có câu hỏi Quiz trỏ tới)',
  })
  @ApiParam({ name: 'id', description: 'ID của bài học (lessonId)' })
  @ApiResponse({ status: 200, description: 'Xóa mềm bài học thành công' })
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.lessonsService.remove(id, actor);
  }

  @Put('modules/:id/lessons/order')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Sắp xếp lại thứ tự toàn bộ bài học trong học phần bằng transaction 2 bước (Owner TRAINER, ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID của học phần (moduleId)' })
  @ApiResponse({ status: 200, description: 'Sắp xếp thứ tự bài học thành công' })
  reorder(
    @Param('id') moduleId: string,
    @Body() dto: ReorderLessonsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.lessonsService.reorder(moduleId, dto, actor);
  }
}

