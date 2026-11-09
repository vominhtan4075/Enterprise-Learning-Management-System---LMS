import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import {
  ChangePasswordDto,
  LoginDto,
  UpdateProfileDto,
} from './dto/auth.dto.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng nhập bằng email và mật khẩu để nhận JWT Access Token',
  })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công và trả về accessToken kèm thông tin user',
  })
  @ApiResponse({
    status: 401,
    description: 'Sai email/mật khẩu hoặc tài khoản bị vô hiệu hóa',
  })
  login(@Body() dto: LoginDto, @Ip() clientIp?: string) {
    return this.authService.login(dto, clientIp);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin hồ sơ người dùng đang đăng nhập' })
  @ApiResponse({ status: 200, description: 'Thông tin hồ sơ người dùng' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @ApiBearerAuth()
  @Put('me')
  @ApiOperation({ summary: 'Cập nhật họ tên hiển thị của người dùng hiện tại' })
  @ApiResponse({ status: 200, description: 'Cập nhật hồ sơ thành công' })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateMe(user.id, dto);
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đổi mật khẩu và tự động thu hồi hiệu lực các token cũ',
  })
  @ApiResponse({ status: 200, description: 'Đổi mật khẩu thành công' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng xuất và vô hiệu hóa phiên đăng nhập hiện tại',
  })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.id, user.jti);
  }
}
