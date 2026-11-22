import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CompetencyService } from './competency.service.js';
import { CompetencyMatrixQueryDto } from './dto/competency-query.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';

@ApiTags('Competency Matrix')
@ApiBearerAuth()
@Controller('competency')
export class CompetencyController {
  constructor(private readonly competencyService: CompetencyService) {}

  @Get('matrix')
  @Roles(RoleCode.HR, RoleCode.ADMIN, RoleCode.TRAINER)
  @ApiOperation({
    summary:
      'Lấy Ma trận Năng lực nhân sự kèm phân tích thiếu hụt kỹ năng (PASSED/GAP) và tổng hợp theo 5 cấp bậc (HR, ADMIN, TRAINER theo scope)',
  })
  @ApiResponse({
    status: 200,
    description: 'Dữ liệu ma trận năng lực (skills, employees, positionSummary)',
  })
  getMatrix(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: CompetencyMatrixQueryDto,
  ) {
    return this.competencyService.getCompetencyMatrixForActor(actor, query);
  }

  @Post('recalculate')
  @Roles(RoleCode.ADMIN, RoleCode.HR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Tính toán lại toàn bộ Ma trận Năng lực từ lịch sử làm bài kiểm tra Quiz (ADMIN, HR)',
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả đồng bộ (processedUsers, updatedRecords)',
  })
  recalculateAll() {
    return this.competencyService.recalculateAllCompetencies();
  }

  @Post('sync/:quizId')
  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.TRAINER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Đồng bộ thủ công điểm năng lực của người dùng hiện tại cho 1 bài Quiz cụ thể',
  })
  @ApiParam({ name: 'quizId', description: 'ID của bài kiểm tra Quiz' })
  @ApiResponse({ status: 200, description: 'Bản ghi CompetencyMatrix đã cập nhật' })
  syncFromQuiz(
    @Param('quizId') quizId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.competencyService.syncCompetencyFromQuiz(actor.id, quizId);
  }
}
