import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PositionLevel, RoleCode } from '../../generated/prisma/client.js';
import { PaginationQueryDto } from '../../common/utils/pagination.util.js';

export class CreateUserDto {
  @ApiProperty({
    example: 'fresher.java@novatech.com',
    description: 'Địa chỉ email nhân viên',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Nguyễn Văn A',
    description: 'Họ và tên đầy đủ',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({
    example: 'Password123!',
    description:
      'Mật khẩu khởi tạo (tùy chọn – nếu không truyền sẽ tự sinh mật khẩu ngẫu nhiên ≥ 12 ký tự và đặt mustChangePassword=true)',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiProperty({
    example: 1,
    description: 'ID vai trò (1: EMPLOYEE, 2: TRAINER, 3: HR, 4: ADMIN)',
  })
  @IsInt()
  roleId: number;

  @ApiProperty({
    example: 'FRESHER',
    enum: PositionLevel,
    description: 'Cấp bậc nhân sự: INTERN | FRESHER | JUNIOR | SENIOR | LEAD',
  })
  @IsEnum(PositionLevel)
  position: PositionLevel;

  @ApiPropertyOptional({
    example: 'Phòng Phát Triển Phần Mềm',
    description: 'Phòng ban làm việc',
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    example: 'NV003',
    description: 'Mã nhân viên HRM',
  })
  @IsOptional()
  @IsString()
  employeeCode?: string;

  @ApiPropertyOptional({
    example: 'Fresher Backend Developer',
    description: 'Chức danh công việc',
  })
  @IsOptional()
  @IsString()
  jobTitle?: string;
}

export class QueryUsersDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: RoleCode,
    description: 'Lọc theo mã vai trò (EMPLOYEE | TRAINER | HR | ADMIN)',
  })
  @IsOptional()
  @IsEnum(RoleCode)
  role?: RoleCode;

  @ApiPropertyOptional({
    description: 'Lọc theo tên phòng ban',
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    enum: PositionLevel,
    description: 'Lọc theo vị trí/cấp bậc',
  })
  @IsOptional()
  @IsEnum(PositionLevel)
  position?: PositionLevel;

  @ApiPropertyOptional({
    description: 'Tìm kiếm theo họ tên, email hoặc mã nhân viên (ILIKE)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái kích hoạt (true / false)',
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
  isActive?: boolean;
}

export class UpdateUserRoleDto {
  @ApiPropertyOptional({
    example: 2,
    description: 'ID vai trò mới (hoặc truyền role)',
  })
  @IsOptional()
  @IsInt()
  roleId?: number;

  @ApiPropertyOptional({
    enum: RoleCode,
    example: 'TRAINER',
    description: 'Mã vai trò mới (EMPLOYEE | TRAINER | HR | ADMIN)',
  })
  @IsOptional()
  @IsEnum(RoleCode)
  role?: RoleCode;
}

export class UpdateUserStatusDto {
  @ApiProperty({
    example: false,
    description: 'Trạng thái kích hoạt tài khoản (true = hoạt động, false = khóa)',
  })
  @IsBoolean()
  isActive: boolean;
}
