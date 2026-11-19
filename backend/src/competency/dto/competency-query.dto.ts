import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PositionEnum } from '../competency.constants.js';

export class CompetencyMatrixQueryDto {
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  learningPathId?: string;

  @IsOptional()
  @IsEnum(PositionEnum)
  position?: PositionEnum;
}