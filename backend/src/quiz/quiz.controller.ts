import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { QuizService } from './quiz.service.js';
import { SubmitQuizDto } from './quiz.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Quizzes')
@ApiBearerAuth()
@Controller('quizzes')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get(':id')
  @ApiOperation({
    summary:
      'Lấy đề bài kiểm tra Quiz để làm bài (Ẩn đáp án đúng; kiểm tra điều kiện mở khóa BR-02 / LP-4 với EMPLOYEE)',
  })
  @ApiParam({ name: 'id', description: 'ID của bài kiểm tra Quiz' })
  @ApiResponse({ status: 200, description: 'Thông tin đề thi và danh sách câu hỏi' })
  @ApiResponse({ status: 422, description: 'Bài kiểm tra đang bị khóa (BR02_LOCK_CONSTRAINT)' })
  async getQuiz(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.quizService.getQuizForTaking(id, actor);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Nộp bài kiểm tra Quiz và chấm điểm tự động (BR-01, BR-03)' })
  @ApiResponse({ status: 201, description: 'Chấm điểm thành công và trả về kết quả' })
  async submitQuiz(
    @Param('id') id: string,
    @Body() submitQuizDto: SubmitQuizDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.quizService.submitQuiz(id, actor.id, submitQuizDto, actor);
  }

  @Get(':id/retake-suggestions')
  @ApiOperation({ summary: 'Lấy danh sách gợi ý bài học cần ôn tập khi thi trượt (BR-03)' })
  @ApiResponse({ status: 200, description: 'Trả về danh sách gợi ý ôn tập' })
  async getRetakeSuggestions(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.quizService.getRetakeSuggestions(id, actor.id);
  }
}
