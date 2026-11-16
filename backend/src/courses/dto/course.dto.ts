import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/utils/pagination.util.js';

export class CreateCourseDto {
  @ApiProperty({
    example: 'JAVA_SPRING_01',
    description: 'Mã khóa học duy nhất (in hoa, chữ số, gạch dưới hoặc gạch ngang, 3–40 ký tự)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Mã khóa học (code) không được để trống.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z0-9_-]{3,40}$/, {
    message:
      'Mã khóa học (code) chỉ gồm chữ in hoa A-Z, chữ số 0-9, dấu _ hoặc - (độ dài 3–40 ký tự).',
  })
  code: string;

  @ApiProperty({
    example: 'Lập trình Java Core & Spring Boot Enterprise',
    description: 'Tiêu đề khóa học',
  })
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề khóa học không được để trống.' })
  @MinLength(3, { message: 'Tiêu đề khóa học phải có ít nhất 3 ký tự.' })
  @MaxLength(200, { message: 'Tiêu đề khóa học không vượt quá 200 ký tự.' })
  title: string;

  @ApiPropertyOptional({
    example: 'Khóa học nền tảng về Java Core, OOP và Spring Boot cho kỹ sư Backend.',
    description: 'Mô tả chi tiết khóa học',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 16,
    default: 0,
    description: 'Thời lượng ước tính của khóa học (giờ, >= 0)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thời lượng ước tính (estimatedHours) phải là số nguyên.' })
  @Min(0, { message: 'Thời lượng ước tính (estimatedHours) phải >= 0.' })
  estimatedHours?: number = 0;
}

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}

export class PublishCourseDto {
  @ApiProperty({
    example: true,
    description: 'Trạng thái xuất bản khóa học (true = xuất bản, false = hủy xuất bản)',
  })
  @IsBoolean({ message: 'Trạng thái isPublished phải là kiểu boolean.' })
  isPublished: boolean;
}

export class QueryCoursesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Tìm kiếm theo tiêu đề hoặc mã khóa học (ILIKE)',
    example: 'Java',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái xuất bản (true / false)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  )
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    description: 'Chỉ lấy các khóa học do chính người đang đăng nhập tạo (true / false)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  )
  @IsBoolean()
  mine?: boolean;
}

