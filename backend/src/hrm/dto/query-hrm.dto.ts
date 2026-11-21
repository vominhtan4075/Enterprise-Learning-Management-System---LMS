import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/utils/pagination.util.js';
import { HrmSyncStatus } from '../../generated/prisma/enums.js';

export class QueryHrmSyncLogsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: HrmSyncStatus,
    example: HrmSyncStatus.INITIATED,
    description: 'Lọc lịch sử đồng bộ theo trạng thái (INITIATED | SKIPPED | FAILED)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : undefined,
  )
  @IsEnum(HrmSyncStatus)
  status?: HrmSyncStatus;

  @ApiPropertyOptional({
    example: 'NV-2026-089',
    description: 'Tìm kiếm theo mã nhân viên hoặc email',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class QueryHrmTrainingStatusDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'NV-2026-089',
    description: 'Lọc theo mã nhân viên HRM (employeeCode)',
  })
  @IsOptional()
  @IsString()
  employeeCode?: string;

  @ApiPropertyOptional({
    example: 'tri.le@novatech.com',
    description: 'Lọc theo email nhân sự',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    example: 'Software Engineering',
    description: 'Lọc theo tên phòng ban',
  })
  @IsOptional()
  @IsString()
  department?: string;
}
