import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { SubmitQuizDto } from './quiz.dto';
// Giả định bạn đã có JwtAuthGuard từ AuthModule
// import { JwtAuthGuard } from '../auth/jwt-auth.guard'; 

@Controller('api/v1/quizzes')
// @UseGuards(JwtAuthGuard) // Bảo mật endpoint
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post(':id/submit')
  async submitQuiz(
    @Param('id') id: string,
    @Body() submitQuizDto: SubmitQuizDto,
    @Request() req: any
  ) {
    const userId = req.user?.id || 'u-101-uuid'; // Mock userId nếu chưa gắn Auth
    return this.quizService.submitQuiz(id, userId, submitQuizDto);
  }

  @Get(':id/retake-suggestions')
  async getRetakeSuggestions(@Param('id') id: string, @Request() req) {
    const userId = req.user?.id || 'u-101-uuid';
    return this.quizService.getRetakeSuggestions(id, userId);
  }
}