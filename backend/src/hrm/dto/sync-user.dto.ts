import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HrmEmployeeItemDto {
  @ApiProperty({
    example: 'NV-2026-089',
    description: 'Mã nhân viên từ hệ thống HRM NovaTech',
  })
  employeeCode!: string;

  @ApiProperty({
    example: 'Lê Minh Trí',
    description: 'Họ và tên đầy đủ của nhân sự',
  })
  fullName!: string;

  @ApiProperty({
    example: 'tri.le@novatech.com',
    description: 'Email công vụ NovaTech (duy nhất)',
  })
  email!: string;

  @ApiProperty({
    example: 'Fresher Backend Java',
    description: 'Vị trí công việc (Intern, Fresher, Junior, Senior, Lead...)',
  })
  position!: string;

  @ApiProperty({
    example: 'Software Engineering',
    description: 'Phòng ban công tác tại NovaTech',
  })
  department!: string;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Ngày bắt đầu làm việc (YYYY-MM-DD)',
  })
  startDate?: string;
}

export class SyncHrmUsersDto {
  @ApiPropertyOptional({
    example: 'NV-2026-089',
    description: 'Mã nhân viên (khi đồng bộ đơn lẻ)',
  })
  employeeCode?: string;

  @ApiPropertyOptional({
    example: 'Lê Minh Trí',
    description: 'Họ và tên đầy đủ của nhân sự (khi đồng bộ đơn lẻ)',
  })
  fullName?: string;

  @ApiPropertyOptional({
    example: 'tri.le@novatech.com',
    description: 'Email công vụ NovaTech (khi đồng bộ đơn lẻ)',
  })
  email?: string;

  @ApiPropertyOptional({
    example: 'Fresher Backend Java',
    description: 'Vị trí công tác (khi đồng bộ đơn lẻ)',
  })
  position?: string;

  @ApiPropertyOptional({
    example: 'Software Engineering',
    description: 'Phòng ban công tác (khi đồng bộ đơn lẻ)',
  })
  department?: string;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Ngày bắt đầu làm việc (YYYY-MM-DD)',
  })
  startDate?: string;

  @ApiPropertyOptional({
    type: [HrmEmployeeItemDto],
    description: 'Danh sách nhân sự cần đồng bộ hàng loạt từ HRM',
  })
  employees?: HrmEmployeeItemDto[];
}