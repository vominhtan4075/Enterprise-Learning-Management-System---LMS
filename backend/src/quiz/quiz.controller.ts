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
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { QuizService } from './quiz.service.js';
import type { ExcelUploadPayload } from './quiz.service.js';
import {
  CreateQuestionDto,
  CreateQuizDto,
  SubmitQuizDto,
  UpdateQuestionDto,
  UpdateQuizDto,
} from './quiz.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';

@ApiTags('Quizzes')
@ApiBearerAuth()
@Controller()
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post('modules/:moduleId/quiz')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Tạo đề kiểm tra Quiz mới cho Học phần (1-1 với Module, Owner TRAINER / ADMIN)',
  })
  @ApiParam({ name: 'moduleId', description: 'ID của học phần' })
  @ApiResponse({ status: 201, description: 'Tạo đề kiểm tra thành công' })
  createQuizForModule(
    @Param('moduleId') moduleId: string,
    @Body() dto: CreateQuizDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.quizService.createQuizForModule(moduleId, dto, actor);
  }

  @Get('quizzes/questions-template')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Tải xuống tệp Excel mẫu (.xlsx) chuẩn hóa để nhập nhanh danh sách câu hỏi trắc nghiệm',
  })
  @ApiResponse({ status: 200, description: 'Luồng tệp Excel mẫu (.xlsx)' })
  async downloadQuestionsTemplate(
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.quizService.generateQuestionsTemplateExcel();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="mau-nhap-cau-hoi-quiz.xlsx"',
    });
    return file;
  }

  @Get('quizzes/:id/retake-suggestions')
  @ApiOperation({
    summary: 'Lấy danh sách gợi ý bài học cần ôn tập khi thi trượt (BR-03)',
  })
  @ApiResponse({ status: 200, description: 'Trả về danh sách gợi ý ôn tập' })
  async getRetakeSuggestions(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.quizService.getRetakeSuggestions(id, actor.id);
  }

  @Get('quizzes/:id')
  @ApiOperation({
    summary:
      'Lấy thông tin đề thi Quiz theo vai trò: EMPLOYEE nhận đề thi ẩn đáp án kèm lịch sử lượt thi (kiểm tra khóa BR-02); Owner TRAINER / ADMIN / HR nhận đầy đủ đáp án & cấu hình biên soạn',
  })
  @ApiParam({ name: 'id', description: 'ID của bài kiểm tra Quiz' })
  @ApiResponse({ status: 200, description: 'Thông tin đề thi và danh sách câu hỏi' })
  @ApiResponse({
    status: 422,
    description: 'Bài kiểm tra đang bị khóa (BR02_LOCK_CONSTRAINT)',
  })
  async getQuiz(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.quizService.getQuizForTaking(id, actor);
  }

  @Put('quizzes/:id')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Cập nhật cấu hình đề kiểm tra Quiz (Owner TRAINER / ADMIN; chỉ xuất bản khi có >= 1 câu hỏi active)',
  })
  @ApiParam({ name: 'id', description: 'ID của bài kiểm tra Quiz' })
  @ApiResponse({ status: 200, description: 'Cập nhật đề kiểm tra thành công' })
  updateQuiz(
    @Param('id') id: string,
    @Body() dto: UpdateQuizDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.quizService.updateQuiz(id, dto, actor);
  }

  @Delete('quizzes/:id')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Xóa đề kiểm tra Quiz (Chặn nếu đã có lượt thi hoặc đang thuộc lộ trình có học viên)',
  })
  @ApiParam({ name: 'id', description: 'ID của bài kiểm tra Quiz' })
  @ApiResponse({ status: 200, description: 'Xóa đề kiểm tra thành công' })
  deleteQuiz(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.quizService.deleteQuiz(id, actor);
  }

  @Post('quizzes/:id/submit')
  @ApiOperation({
    summary:
      'Nộp bài kiểm tra Quiz và chấm điểm tự động (BR-01, BR-03, chặn vượt maxAttempts)',
  })
  @ApiResponse({
    status: 201,
    description: 'Chấm điểm thành công và trả về kết quả',
  })
  async submitQuiz(
    @Param('id') id: string,
    @Body() submitQuizDto: SubmitQuizDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.quizService.submitQuiz(id, actor.id, submitQuizDto, actor);
  }

  @Post('quizzes/:id/questions/import-excel')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Nhập hàng loạt câu hỏi trắc nghiệm từ tệp Excel (.xlsx) vào đề kiểm tra Quiz (Owner TRAINER / ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID của bài kiểm tra Quiz' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Tệp Excel (.xlsx) chứa danh sách câu hỏi',
        },
        mode: {
          type: 'string',
          enum: ['append', 'replace'],
          default: 'append',
          description:
            'append: cộng thêm vào danh sách hiện có; replace: thay thế các câu hỏi hiện có',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Nhập danh sách câu hỏi từ Excel thành công',
  })
  importQuestionsFromExcel(
    @Param('id') quizId: string,
    @UploadedFile() file: ExcelUploadPayload,
    @Body('mode') mode: string | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const normalizedMode = mode === 'replace' ? 'replace' : 'append';
    return this.quizService.importQuestionsFromExcel(
      quizId,
      file,
      normalizedMode,
      actor,
    );
  }

  @Post('quizzes/:id/questions')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Thêm câu hỏi trắc nghiệm mới vào đề kiểm tra Quiz (Owner TRAINER / ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID của bài kiểm tra Quiz' })
  @ApiResponse({ status: 201, description: 'Tạo câu hỏi thành công' })
  createQuestion(
    @Param('id') quizId: string,
    @Body() dto: CreateQuestionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.quizService.createQuestion(quizId, dto, actor);
  }

  @Put('questions/:id')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary: 'Cập nhật nội dung câu hỏi trắc nghiệm (Owner TRAINER / ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID của câu hỏi' })
  @ApiResponse({ status: 200, description: 'Cập nhật câu hỏi thành công' })
  updateQuestion(
    @Param('id') questionId: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.quizService.updateQuestion(questionId, dto, actor);
  }

  @Delete('questions/:id')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Xóa mềm câu hỏi trắc nghiệm (Bảo toàn lịch sử QuizAttempt; chặn xóa câu active cuối cùng của đề đang xuất bản)',
  })
  @ApiParam({ name: 'id', description: 'ID của câu hỏi' })
  @ApiResponse({ status: 200, description: 'Xóa câu hỏi thành công' })
  deleteQuestion(
    @Param('id') questionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.quizService.deleteQuestion(questionId, actor);
  }
}
