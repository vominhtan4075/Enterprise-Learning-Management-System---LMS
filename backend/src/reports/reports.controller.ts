import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RoleCode } from '../generated/prisma/enums.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ReportsService } from './reports.service.js';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.TRAINER)
  @ApiOperation({ summary: 'Thống kê dashboard theo khoảng thời gian' })
  getDashboard(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getDashboard({ from, to });
  }

  @Get('competency-matrix')
  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.TRAINER)
  @ApiOperation({ summary: 'Lấy ma trận năng lực theo phòng ban và cấp bậc' })
  getCompetencyMatrix(
    @Query('department') department?: string,
    @Query('position') position?: string,
  ) {
    return this.reportsService.getCompetencyMatrix({ department, position });
  }

  @Get('competency-matrix/export')
  @Roles(RoleCode.ADMIN, RoleCode.HR)
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiOperation({ summary: 'Xuất ma trận năng lực ra Excel' })
  async exportCompetencyMatrix(
    @Res() res: Response,
    @Query('department') department?: string,
    @Query('position') position?: string,
  ) {
    const buffer = await this.reportsService.exportCompetencyMatrix({ department, position });
    res.setHeader('Content-Disposition', 'attachment; filename="competency-matrix.xlsx"');
    res.setHeader('Content-Length', buffer.length);
    res.end(Buffer.from(buffer));
  }
}
