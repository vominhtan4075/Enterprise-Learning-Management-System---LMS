import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Email đăng nhập của nhân viên',
    example: 'fresher.java@novatech.com',
  })
  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  @IsNotEmpty({ message: 'Email không được để trống.' })
  email: string;

  @ApiProperty({
    description: 'Mật khẩu đăng nhập',
    example: 'Password123!',
  })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống.' })
  password: string;
}

export class UpdateProfileDto {
  @ApiProperty({
    description: 'Họ và tên hiển thị mới',
    example: 'Nguyễn Văn Huấn',
  })
  @IsString()
  @IsNotEmpty({ message: 'Họ và tên không được để trống.' })
  @MinLength(2, { message: 'Họ và tên phải có ít nhất 2 ký tự.' })
  @MaxLength(100, { message: 'Họ và tên không vượt quá 100 ký tự.' })
  fullName: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Mật khẩu hiện tại',
    example: 'Password123!',
  })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu hiện tại không được để trống.' })
  currentPassword: string;

  @ApiProperty({
    description:
      'Mật khẩu mới (tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt)',
    example: 'NewPass2026@!',
  })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/, {
    message:
      'Mật khẩu mới phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt.',
  })
  newPassword: string;
}

