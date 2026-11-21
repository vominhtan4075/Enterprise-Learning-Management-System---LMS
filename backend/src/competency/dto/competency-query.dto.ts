import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PositionEnum } from '../competency.constants.js';

export class CompetencyMatrixQueryDto {
  @ApiPropertyOptional({
    example: 'Backend Division',
    description: 'Lọc theo tên phòng ban (department)',
  })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    example: 'path-uuid-1',
    description: 'Lọc theo ID lộ trình học tập (learningPathId)',
  })
  @IsOptional()
  @IsString()
  learningPathId?: string;

  @ApiPropertyOptional({
    enum: PositionEnum,
    example: PositionEnum.FRESHER,
    description: 'Lọc theo vị trí công việc (INTERN, FRESHER, JUNIOR, SENIOR, LEAD)',
  })
  @IsOptional()
  @IsEnum(PositionEnum)
  position?: PositionEnum;
}