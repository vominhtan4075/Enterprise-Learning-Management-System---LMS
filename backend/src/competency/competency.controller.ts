import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CompetencyService } from './competency.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';

@ApiTags('Competency Matrix')
@ApiBearerAuth()
@Controller('competency')
export class CompetencyController {
  constructor(private readonly competencyService: CompetencyService) {}

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
}
