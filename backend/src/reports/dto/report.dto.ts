import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PositionLevel } from '../../generated/prisma/enums.js';

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
  @IsEnum(PositionLevel)
  position?: PositionLevel;
}
