import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({
    example: 'Học phần 1: Làm quen Java Core & OOP',
    description: 'Tiêu đề học phần (Module)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề học phần không được để trống.' })
  @MinLength(2, { message: 'Tiêu đề học phần phải có ít nhất 2 ký tự.' })
  @MaxLength(200, { message: 'Tiêu đề học phần không vượt quá 200 ký tự.' })
  title: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Thứ tự học phần (> 0). Nếu bỏ trống sẽ tự động xếp vào cuối khóa học.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thứ tự học phần (moduleOrder) phải là số nguyên.' })
  @Min(1, { message: 'Thứ tự học phần (moduleOrder) phải >= 1.' })
  moduleOrder?: number;

  @ApiPropertyOptional({
    example: 'Nắm vững cú pháp Java, cấu trúc dữ liệu và lập trình hướng đối tượng.',
    description: 'Mô tả nội dung học phần',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Mốc ngày bắt đầu gợi ý trong lộ trình Onboarding (> 0)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Ngày bắt đầu (dayStart) phải là số nguyên.' })
  @Min(1, { message: 'Ngày bắt đầu (dayStart) phải >= 1.' })
  dayStart?: number;

  @ApiPropertyOptional({
    example: 7,
    description: 'Mốc ngày kết thúc gợi ý (>= dayStart)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Ngày kết thúc (dayEnd) phải là số nguyên.' })
  @Min(1, { message: 'Ngày kết thúc (dayEnd) phải >= 1.' })
  dayEnd?: number;
}

export class UpdateModuleDto extends PartialType(CreateModuleDto) {}

export class ReorderModulesDto {
  @ApiProperty({
    example: ['mod-uuid-1', 'mod-uuid-2', 'mod-uuid-3'],
    description: 'Danh sách đầy đủ ID các học phần trong khóa học theo thứ tự mới (1..n)',
    type: [String],
  })
  @IsArray({ message: 'orderedIds phải là một mảng ID.' })
  @ArrayMinSize(1, { message: 'orderedIds phải chứa ít nhất 1 ID học phần.' })
  @IsString({ each: true, message: 'Mỗi phần tử trong orderedIds phải là chuỗi.' })
  orderedIds: string[];
}

