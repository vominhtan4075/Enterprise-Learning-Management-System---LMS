import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsEnum, IsInt } from 'class-validator';
import { PositionLevel } from '../../generated/prisma/client.js';

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

  @ApiProperty({
    example: 'Password123!',
    description: 'Mật khẩu khởi tạo',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

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
