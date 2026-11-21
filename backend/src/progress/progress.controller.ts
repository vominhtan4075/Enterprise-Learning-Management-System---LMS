import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProgressService } from './progress.service.js';
import { UpdateProgressDto } from './dto/progress.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Progress')
@ApiBearerAuth()
@Controller()
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('progress/my-progress')
  @ApiOperation({
    summary:
      'Lấy tổng quan tiến độ học tập cá nhân kèm mục học tiếp theo (nextUp) và danh sách hạn chót sắp tới (WP8 8.3)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Tiến độ học tập cá nhân (paths, courses, nextUp, upcomingDeadlines)',
  })
  getMyProgress(@CurrentUser() actor: AuthenticatedUser) {
    return this.progressService.getMyProgress(actor);
  }

  @Post('progress/update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Đánh dấu hoàn thành bài học (Idempotent – Kiểm tra mở khóa BR-02 qua AccessService và tự động mở khóa học phần/quiz kế tiếp)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Cập nhật tiến độ thành công (lessonId, isCompleted, completedAt, moduleState, quizUnlocked, nextUnlocked)',
  })
  @ApiResponse({ status: 403, description: 'Chưa ghi danh (NOT_ENROLLED)' })
  @ApiResponse({
    status: 422,
    description:
      'Bài học đang bị khóa theo BR-02 (BR02_LOCK_CONSTRAINT) hoặc truyền isCompleted=false',
  })
  updateProgress(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.progressService.updateLessonProgress(actor, dto);
  }

  @Post('lessons/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Alias đánh dấu hoàn thành bài học theo ID trên URL (Tương đương POST /api/v1/progress/update với isCompleted=true)',
  })
  @ApiParam({ name: 'id', description: 'ID của bài học cần đánh dấu hoàn thành' })
  @ApiResponse({ status: 200, description: 'Đánh dấu hoàn thành bài học thành công' })
  completeLessonAlias(
    @Param('id') lessonId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.progressService.updateLessonProgress(actor, {
      lessonId,
      isCompleted: true,
    });
  }
}
