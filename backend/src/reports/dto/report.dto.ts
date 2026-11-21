import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PositionLevel } from '../../generated/prisma/enums.js';

export class QueryDashboardDto {
  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Ngày bắt đầu lọc thống kê Dashboard (YYYY-MM-DD hoặc ISO 8601)',
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'Ngày kết thúc lọc thống kê Dashboard (YYYY-MM-DD hoặc ISO 8601)',
  })
  @IsOptional()
  @IsString()
  to?: string;
}

export class QueryReportsDto {
  @ApiPropertyOptional({
    example: 'Backend Development',
    description: 'Lọc theo tên phòng ban (department)',
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    example: 'Backend Development',
    description: 'Alias của department (departmentId) để tương thích với CompetencyMatrixQueryDto',
  })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    example: 'path-fresher-java',
    description: 'Lọc theo ID hoặc mã code lộ trình học tập (learningPathId)',
  })
  @IsOptional()
  @IsString()
  learningPathId?: string;

  @ApiPropertyOptional({
    example: 'course-uuid-1',
    description: 'Lọc theo ID khóa học (courseId)',
  })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({
    enum: PositionLevel,
    example: PositionLevel.FRESHER,
    description: 'Lọc theo vị trí/cấp bậc nhân sự (INTERN, FRESHER, JUNIOR, SENIOR, LEAD)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : undefined,
  )
  @IsEnum(PositionLevel)
  position?: PositionLevel;
}
