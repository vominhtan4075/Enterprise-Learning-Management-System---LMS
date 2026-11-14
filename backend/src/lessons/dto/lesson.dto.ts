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
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ContentType } from '../../generated/prisma/enums.js';

export class CreateLessonDto {
  @ApiProperty({
    example: 'Bài 1: Cài đặt JDK 21 & IntelliJ IDEA',
    description: 'Tiêu đề bài học (Lesson)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề bài học không được để trống.' })
  @MinLength(2, { message: 'Tiêu đề bài học phải có ít nhất 2 ký tự.' })
  @MaxLength(200, { message: 'Tiêu đề bài học không vượt quá 200 ký tự.' })
  title: string;

  @ApiProperty({
    enum: ContentType,
    example: ContentType.VIDEO,
    description: 'Loại nội dung bài học: VIDEO | PDF | MARKDOWN',
  })
  @IsEnum(ContentType, {
    message: 'contentType phải là VIDEO, PDF hoặc MARKDOWN.',
  })
  contentType: ContentType;

  @ApiPropertyOptional({
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description:
      'URL nội dung (Bắt buộc với VIDEO là URL http/https; với PDF/MARKDOWN có thể tự động gán)',
  })
  @IsOptional()
  @IsString()
  contentUrl?: string;

  @ApiPropertyOptional({
    example: '# Hướng dẫn cài đặt JDK 21\nCác bước thiết lập biến môi trường JAVA_HOME...',
    description: 'Nội dung Markdown nội tuyến (Dùng khi contentType = MARKDOWN)',
  })
  @IsOptional()
  @IsString()
  contentText?: string;

  @ApiPropertyOptional({
    example: 'file-uuid-123',
    description: 'ID tệp PDF đã tải lên qua POST /api/v1/files (Dùng khi contentType = PDF)',
  })
  @IsOptional()
  @IsString()
  fileId?: string;

  @ApiPropertyOptional({
    example: 25,
    description: 'Thời lượng bài học tính bằng phút (>= 0)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thời lượng bài học (durationMinutes) phải là số nguyên.' })
  @Min(0, { message: 'Thời lượng bài học (durationMinutes) phải >= 0.' })
  durationMinutes?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Thứ tự bài học trong học phần (> 0). Nếu bỏ trống sẽ tự động xếp vào cuối học phần.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thứ tự bài học (lessonOrder) phải là số nguyên.' })
  @Min(1, { message: 'Thứ tự bài học (lessonOrder) phải >= 1.' })
  lessonOrder?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Bài học bắt buộc hoàn thành để mở khóa bài kiểm tra học phần (BR-02)',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'isRequired phải là kiểu boolean.' })
  isRequired?: boolean;
}

export class UpdateLessonDto extends PartialType(CreateLessonDto) {}

export class ReorderLessonsDto {
  @ApiProperty({
    example: ['lesson-uuid-1', 'lesson-uuid-2', 'lesson-uuid-3'],
    description:
      'Danh sách đầy đủ ID các bài học trong học phần theo thứ tự mới (1..n)',
    type: [String],
  })
  @IsArray({ message: 'orderedIds phải là một mảng ID.' })
  @ArrayMinSize(1, { message: 'orderedIds phải chứa ít nhất 1 ID bài học.' })
  @IsString({
    each: true,
    message: 'Mỗi phần tử trong orderedIds phải là chuỗi.',
  })
  orderedIds: string[];
}

