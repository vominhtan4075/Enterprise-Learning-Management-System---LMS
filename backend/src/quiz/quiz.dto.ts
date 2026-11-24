import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { QuizType } from '../generated/prisma/enums.js';

export class AnswerSubmissionDto {
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @IsOptional()
  @IsString()
  selectedOption?: string;

  @IsOptional()
  @IsString()
  answer?: string;
}

export class SubmitQuizDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  attemptId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerSubmissionDto)
  answers!: AnswerSubmissionDto[];
}

export class QuizOptionItemDto {
  @ApiProperty({ example: 'A', description: 'Mã đáp án (VD: A, B, C, D)' })
  @IsString()
  @IsNotEmpty({ message: 'Mã lựa chọn không được để trống.' })
  @MaxLength(10)
  key!: string;

  @ApiProperty({
    example: 'Đóng gói (Encapsulation)',
    description: 'Nội dung phương án lựa chọn',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung lựa chọn không được để trống.' })
  @MaxLength(1000)
  text!: string;
}

export class CreateQuizDto {
  @ApiProperty({
    example: 'Kiểm tra Học phần 1: Java Core & OOP',
    description: 'Tên đề kiểm tra Quiz',
  })
  @IsString()
  @IsNotEmpty({ message: 'Tên đề kiểm tra không được để trống.' })
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    enum: QuizType,
    default: QuizType.MODULE,
    description: 'Loại bài kiểm tra (MODULE hoặc FINAL)',
  })
  @IsOptional()
  @IsEnum(QuizType)
  quizType?: QuizType;

  @ApiPropertyOptional({
    example: 70,
    minimum: 70,
    maximum: 100,
    default: 70,
    description: 'Điểm chuẩn đạt yêu cầu từ 70 đến 100 (BR-01)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(70)
  @Max(100)
  passingScore?: number;

  @ApiPropertyOptional({
    example: 15,
    minimum: 1,
    maximum: 240,
    description: 'Thời gian làm bài (phút)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(240)
  timeLimitMin?: number | null;

  @ApiPropertyOptional({
    example: 3,
    minimum: 1,
    maximum: 20,
    default: 3,
    description: 'Số lượt thi tối đa',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxAttempts?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Trạng thái xuất bản đề thi',
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateQuizDto {
  @ApiPropertyOptional({ example: 'Kiểm tra Học phần 1 (Cập nhật)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên đề kiểm tra không được để trống.' })
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ enum: QuizType })
  @IsOptional()
  @IsEnum(QuizType)
  quizType?: QuizType;

  @ApiPropertyOptional({ minimum: 70, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(70)
  @Max(100)
  passingScore?: number;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 1,
    maximum: 240,
    description: 'Thời gian làm bài (phút), truyền null để bỏ giới hạn',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(240)
  timeLimitMin?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxAttempts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class CreateQuestionDto {
  @ApiProperty({
    example: 'Trong Java, tính chất nào giúp ẩn dữ liệu nội bộ của lớp?',
    description: 'Nội dung câu hỏi trắc nghiệm',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung câu hỏi không được để trống.' })
  questionText!: string;

  @ApiProperty({
    type: [QuizOptionItemDto],
    description: 'Danh sách từ 2 đến 6 phương án lựa chọn',
  })
  @IsArray()
  @ArrayMinSize(2, { message: 'Câu hỏi phải có tối thiểu 2 lựa chọn.' })
  @ArrayMaxSize(6, { message: 'Câu hỏi chỉ hỗ trợ tối đa 6 lựa chọn.' })
  @ValidateNested({ each: true })
  @Type(() => QuizOptionItemDto)
  options!: QuizOptionItemDto[];

  @ApiProperty({
    example: 'A',
    description: 'Mã đáp án đúng (trùng khớp với một trong các options[].key)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Đáp án đúng không được để trống.' })
  correctAnswer!: string;

  @ApiPropertyOptional({
    description: 'ID bài học liên quan cùng khóa học để gợi ý ôn tập BR-03',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  relatedLessonId?: string | null;

  @ApiPropertyOptional({
    example: 'Java Core & OOP',
    description: 'Nhãn kỹ năng phục vụ tổng hợp Ma trận Năng lực',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(150)
  skillName?: string | null;

  @ApiPropertyOptional({
    example: 'Encapsulation sử dụng private fields kết hợp getter/setter.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  explanation?: string | null;

  @ApiPropertyOptional({ example: 'OOP-Encapsulation' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  conceptTag?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Nội dung câu hỏi không được để trống.' })
  questionText?: string;

  @ApiPropertyOptional({ type: [QuizOptionItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2, { message: 'Câu hỏi phải có tối thiểu 2 lựa chọn.' })
  @ArrayMaxSize(6, { message: 'Câu hỏi chỉ hỗ trợ tối đa 6 lựa chọn.' })
  @ValidateNested({ each: true })
  @Type(() => QuizOptionItemDto)
  options?: QuizOptionItemDto[];

  @ApiPropertyOptional({ example: 'B' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Đáp án đúng không được để trống.' })
  correctAnswer?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  relatedLessonId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(150)
  skillName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  explanation?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  conceptTag?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
