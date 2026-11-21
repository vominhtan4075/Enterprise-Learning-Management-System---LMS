import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PositionLevel } from '../../generated/prisma/enums.js';

export class QueryLearningPathsDto {
  @ApiPropertyOptional({
    enum: PositionLevel,
    description: 'Lọc theo vị trí công việc mục tiêu (INTERN, FRESHER, JUNIOR, SENIOR, LEAD)',
  })
  @IsOptional()
  @IsEnum(PositionLevel, {
    message: 'targetPosition phải thuộc INTERN, FRESHER, JUNIOR, SENIOR, LEAD.',
  })
  targetPosition?: PositionLevel;

  @ApiPropertyOptional({
    description: 'Lọc lộ trình bắt buộc (true/false)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isMandatory?: boolean;

  @ApiPropertyOptional({
    description: 'Tìm kiếm theo tiêu đề hoặc mã code của lộ trình',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateLearningPathDto {
  @ApiProperty({
    example: 'Lộ trình Onboarding 30 ngày cho Fresher Backend Java',
    description: 'Tiêu đề lộ trình học tập',
  })
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề lộ trình không được để trống.' })
  @MinLength(3, { message: 'Tiêu đề lộ trình phải có ít nhất 3 ký tự.' })
  @MaxLength(200, { message: 'Tiêu đề lộ trình không vượt quá 200 ký tự.' })
  title: string;

  @ApiProperty({
    enum: PositionLevel,
    example: PositionLevel.FRESHER,
    description: 'Vị trí nhân sự mục tiêu của lộ trình',
  })
  @IsEnum(PositionLevel, {
    message: 'targetPosition phải thuộc INTERN, FRESHER, JUNIOR, SENIOR, LEAD.',
  })
  targetPosition: PositionLevel;

  @ApiPropertyOptional({
    example: 'Lộ trình đào tạo hội nhập chuẩn hóa cho lập trình viên Java mới gia nhập NovaTech.',
    description: 'Mô tả chi tiết lộ trình',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Lộ trình bắt buộc hay tự chọn',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isMandatory?: boolean;

  @ApiPropertyOptional({
    example: 30,
    default: 30,
    description: 'Số ngày dự kiến hoàn thành lộ trình (>= 0)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedDays?: number;

  @ApiPropertyOptional({
    example: 'path-fresher-java',
    description:
      'Mã định danh slug duy nhất (Nếu bỏ trống sẽ tự động sinh từ targetPosition & title)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9_-]{3,60}$/, {
    message:
      'Mã lộ trình (code) chỉ gồm chữ thường a-z, số 0-9, dấu gạch ngang (-) hoặc gạch dưới (_), từ 3–60 ký tự.',
  })
  code?: string;
}

export class UpdateLearningPathDto extends PartialType(CreateLearningPathDto) {}

export class AddCourseToPathDto {
  @ApiProperty({
    example: 'course-uuid-1',
    description: 'ID khóa học (Course bắt buộc đã xuất bản và chưa xóa)',
  })
  @IsString()
  @IsNotEmpty({ message: 'courseId không được để trống.' })
  courseId: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Thứ tự bước học (stepOrder >= 1). Nếu bỏ trống sẽ tự động xếp vào cuối lộ trình.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'stepOrder phải là số nguyên.' })
  @Min(1, { message: 'stepOrder phải >= 1.' })
  stepOrder?: number;
}

export class ReorderPathCoursesDto {
  @ApiProperty({
    example: ['course-uuid-1', 'course-uuid-2', 'course-uuid-3'],
    description:
      'Danh sách đầy đủ ID các khóa học (courseId) trong lộ trình theo thứ tự mới (1..n)',
    type: [String],
  })
  @IsArray({ message: 'orderedCourseIds phải là một mảng ID.' })
  @ArrayMinSize(1, {
    message: 'orderedCourseIds phải chứa ít nhất 1 courseId.',
  })
  @IsString({
    each: true,
    message: 'Mỗi phần tử trong orderedCourseIds phải là chuỗi.',
  })
  orderedCourseIds: string[];
}
