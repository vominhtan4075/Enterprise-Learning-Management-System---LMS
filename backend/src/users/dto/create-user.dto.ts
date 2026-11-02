import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    example: 'nhanvien1@novatech.com',
    description: 'Địa chỉ email nhân viên',
  })
  email: string;

  @ApiProperty({
    example: 'Nguyễn Văn A',
    description: 'Họ và tên đầy đủ',
  })
  fullName: string;

  @ApiProperty({
    example: 'EMPLOYEE',
    description: 'Vai trò trong hệ thống: EMPLOYEE | INSTRUCTOR | ADMIN',
    required: false,
    default: 'EMPLOYEE',
  })
  role?: string;
}
