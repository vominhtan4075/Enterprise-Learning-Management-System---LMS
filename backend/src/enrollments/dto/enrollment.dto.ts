import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  EnrollmentStatus,
  PositionLevel,
} from '../../generated/prisma/enums.js';

export class CreateEnrollmentDto {
  @ApiPropertyOptional({
    example: 'user-uuid-1',
    description: 'ID của nhân viên nhận bài (Giao đơn lẻ theo [W2])',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: ['user-uuid-1', 'user-uuid-2'],
    description: 'Danh sách ID nhân viên (Giao hàng loạt theo mảng userIds)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @ApiPropertyOptional({
    example: 'Backend Division',
    description: 'Giao hàng loạt theo tên phòng ban (department)',
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    enum: PositionLevel,
    example: PositionLevel.FRESHER,
    description: 'Giao hàng loạt theo vị trí/cấp bậc (position)',
  })
  @IsOptional()
  @IsEnum(PositionLevel)
  position?: PositionLevel;

  @ApiPropertyOptional({
    example: 'course-uuid-1',
    description: 'ID khóa học cần giao (Truyền đúng 1 trong 2: courseId hoặc pathId)',
  })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({
    example: 'path-fresher-java',
    description:
      'ID hoặc mã code của lộ trình học tập cần giao (Truyền đúng 1 trong 2: courseId hoặc pathId)',
  })
  @IsOptional()
  @IsString()
  pathId?: string;

  @ApiProperty({
    example: '2026-12-31T23:59:59.000Z',
    description: 'Hạn chót hoàn thành (Phải ở trong tương lai, hỗ trợ ISO-8601 hoặc YYYY-MM-DD)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Hạn chót (deadline) không được để trống.' })
  deadline: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Cho phép ADMIN bỏ qua kiểm tra cấu trúc lộ trình khi demo',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  allowIncomplete?: boolean;
}

export class AssignPathDto {
  @ApiProperty({
    example: 'path-fresher-java',
    description: 'ID hoặc mã code của lộ trình học tập cần giao',
  })
  @IsString()
  @IsNotEmpty({ message: 'pathId không được để trống.' })
  pathId: string;

  @ApiPropertyOptional({
    enum: PositionLevel,
    example: PositionLevel.FRESHER,
    description: 'Vị trí nhân sự mục tiêu cần gán lộ trình ([W2] targetPosition)',
  })
  @IsOptional()
  @IsEnum(PositionLevel)
  targetPosition?: PositionLevel;

  @ApiPropertyOptional({
    example: 'Backend Division',
    description: 'Lọc bổ sung theo phòng ban (department)',
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    example: 'user-uuid-1',
    description: 'Giao lộ trình cho 1 nhân viên cụ thể',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: ['user-uuid-1', 'user-uuid-2'],
    description: 'Danh sách ID nhân viên cụ thể cần giao lộ trình',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @ApiProperty({
    example: '2026-12-31T23:59:59.000Z',
    description: 'Hạn chót hoàn thành lộ trình (Phải ở trong tương lai)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Hạn chót (deadline) không được để trống.' })
  deadline: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Cho phép ADMIN bỏ qua kiểm tra cấu trúc lộ trình khi demo',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  allowIncomplete?: boolean;
}

export class QueryEnrollmentsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: ['COURSE', 'PATH'],
    description: 'Lọc theo loại ghi danh: COURSE (khóa học lẻ) hoặc PATH (lộ trình)',
  })
  @IsOptional()
  @IsIn(['COURSE', 'PATH'])
  type?: 'COURSE' | 'PATH';

  @ApiPropertyOptional({ description: 'Lọc theo ID học viên (userId)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID khóa học (courseId)' })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID lộ trình (pathId)' })
  @IsOptional()
  @IsString()
  pathId?: string;

  @ApiPropertyOptional({
    enum: EnrollmentStatus,
    description: 'Lọc theo trạng thái: IN_PROGRESS | COMPLETED | OVERDUE',
  })
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @ApiPropertyOptional({ description: 'Lọc theo phòng ban của nhân viên' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    description: 'Chỉ lọc các bản ghi đã quá hạn (overdue = true)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  overdue?: boolean;
}

export class UpdateEnrollmentDto {
  @ApiProperty({
    example: '2027-01-15T23:59:59.000Z',
    description: 'Hạn chót mới (Phải lớn hơn thời điểm hiện tại)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Hạn chót mới (deadline) không được để trống.' })
  deadline: string;
}
