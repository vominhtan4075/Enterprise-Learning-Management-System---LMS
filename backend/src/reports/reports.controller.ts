import {
  Controller,
  Get,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service.js';
import { QueryReportsDto } from './dto/report.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary:
      'Lấy số liệu thống kê Dashboard tự động tùy biến theo vai trò người dùng đăng nhập (ADMIN/HR, TRAINER, EMPLOYEE)',
  })
  @ApiResponse({ status: 200, description: 'Dữ liệu thống kê Dashboard theo Role' })
  getDashboard(@CurrentUser() actor: AuthenticatedUser) {
    return this.reportsService.getDashboard(actor);
  }

  @Get('competency-matrix/me')
  @ApiOperation({
    summary:
      'Lấy Hồ sơ & Ma trận Năng lực cá nhân của người dùng đang đăng nhập (So sánh với ngưỡng điểm chuẩn của vị trí hiện tại)',
  })
  @ApiResponse({
    status: 200,
    description: 'Hồ sơ năng lực cá nhân (avgScore, requiredScore, competencies[])',
  })
  getMyCompetencyMatrix(@CurrentUser() actor: AuthenticatedUser) {
    return this.reportsService.getMyCompetencyMatrix(actor);
  }

  @Get('competency-matrix/export')
  @Roles(RoleCode.HR, RoleCode.ADMIN, RoleCode.TRAINER)
  @ApiOperation({
    summary:
      'Xuất báo cáo Ma trận Năng lực nhân sự ra file Excel (.xlsx) (HR, ADMIN, TRAINER)',
  })
  @ApiResponse({ status: 200, description: 'Luồng tệp Excel (.xlsx)' })
  async exportCompetencyMatrix(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryReportsDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.reportsService.exportCompetencyMatrixExcel(
      actor,
      query,
    );
    const dateStr = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="novatech-competency-matrix-${dateStr}.xlsx"`,
    });
    return file;
  }

  @Get('competency-matrix')
  @Roles(RoleCode.HR, RoleCode.ADMIN, RoleCode.TRAINER)
  @ApiOperation({
    summary:
      'Lấy báo cáo Ma trận Năng lực toàn công ty hoặc theo phạm vi lớp phụ trách của Trainer ([W2] /reports/competency-matrix)',
  })
  @ApiResponse({
    status: 200,
    description: 'Ma trận năng lực nhân sự (skills, employees, positionSummary)',
  })
  getCompetencyMatrix(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryReportsDto,
  ) {
    return this.reportsService.getCompetencyMatrix(actor, query);
  }

  @Get('competency')
  @Roles(RoleCode.HR, RoleCode.ADMIN, RoleCode.TRAINER)
  @ApiOperation({
    summary:
      'Alias của GET /api/v1/reports/competency-matrix ([SRS]/[V3] tương thích ngược)',
  })
  @ApiResponse({ status: 200, description: 'Ma trận năng lực nhân sự' })
  getCompetencyAlias(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryReportsDto,
  ) {
    return this.reportsService.getCompetencyMatrix(actor, query);
  }

  @Get('completion')
  @Roles(RoleCode.HR, RoleCode.ADMIN, RoleCode.TRAINER)
  @ApiOperation({
    summary:
      'Báo cáo tỷ lệ hoàn thành đào tạo theo từng phòng ban và cá nhân (HR, ADMIN; TRAINER theo scope)',
  })
  @ApiResponse({
    status: 200,
    description: 'Báo cáo tỷ lệ hoàn thành (summary, byDepartment, byEmployee)',
  })
  getCompletionReport(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryReportsDto,
  ) {
    return this.reportsService.getCompletionReport(actor, query);
  }

  @Get('quiz-scores')
  @Roles(RoleCode.HR, RoleCode.ADMIN, RoleCode.TRAINER)
  @ApiOperation({
    summary:
      'Báo cáo điểm trung bình và tỷ lệ đạt của các bài kiểm tra Quiz (HR, ADMIN; TRAINER theo scope)',
  })
  @ApiResponse({
    status: 200,
    description: 'Thống kê điểm Quiz (totalQuizzes, totalAttempts, overallAvgScore, quizzes[])',
  })
  getQuizScoresReport(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryReportsDto,
  ) {
    return this.reportsService.getQuizScoresReport(actor, query);
  }
}
