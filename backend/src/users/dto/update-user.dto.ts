import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto.js';

/**
 * DTO cập nhật hồ sơ người dùng (WP4 4.4).
 * `roleId` bị loại trừ: thay đổi vai trò bắt buộc qua endpoint chuyên biệt `PATCH /users/:id/role`
 * để đảm bảo kiểm tra quy tắc Admin cuối cùng và ghi vết audit.
 * `employeeCode` bị loại trừ: mã nhân viên cố định định danh từ HRM.
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['roleId', 'employeeCode'] as const),
) {}
