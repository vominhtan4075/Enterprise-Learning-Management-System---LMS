import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'nhanvien1@novatech.com',
    description: 'Địa chỉ email nhân viên',
  })
  email?: string;

  @ApiPropertyOptional({
    example: 'Nguyễn Văn B',
    description: 'Họ và tên cập nhật',
  })
  fullName?: string;

  @ApiPropertyOptional({
    example: 'INSTRUCTOR',
    description: 'Vai trò trong hệ thống: EMPLOYEE | INSTRUCTOR | ADMIN',
  })
  role?: string;
}
