import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import {
  CreateUserDto,
  QueryUsersDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(RoleCode.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo tài khoản người dùng mới (ADMIN)' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({
    status: 409,
    description: 'Email hoặc mã nhân viên đã tồn tại',
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(RoleCode.ADMIN, RoleCode.HR, RoleCode.TRAINER)
  @ApiOperation({
    summary:
      'Lấy danh sách người dùng có phân trang & bộ lọc (ADMIN/HR: đầy đủ; TRAINER: chỉ EMPLOYEE rút gọn)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách người dùng phân trang' })
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryUsersDto,
  ) {
    return this.usersService.findAll(actor, query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Lấy thông tin một người dùng (chính chủ; ADMIN/HR; TRAINER chỉ xem EMPLOYEE rút gọn)',
  })
  @ApiParam({ name: 'id', description: 'ID của người dùng' })
  @ApiResponse({ status: 200, description: 'Thông tin người dùng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng' })
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.findOne(id, actor);
  }

  @Put(':id')
  @Roles(RoleCode.ADMIN)
  @ApiOperation({ summary: 'Cập nhật hồ sơ người dùng (ADMIN – chuẩn R6 PUT)' })
  @ApiParam({ name: 'id', description: 'ID của người dùng' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng' })
  updatePut(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.update(id, updateUserDto, actor);
  }

  @Patch(':id')
  @Roles(RoleCode.ADMIN)
  @ApiOperation({
    summary: 'Cập nhật hồ sơ người dùng (alias PATCH tương thích ngược)',
    deprecated: true,
  })
  @ApiParam({ name: 'id', description: 'ID của người dùng' })
  updatePatch(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.update(id, updateUserDto, actor);
  }

  @Patch(':id/role')
  @Roles(RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Thay đổi vai trò người dùng và thu hồi phiên đăng nhập cũ (ADMIN – WP4 4.4)',
  })
  @ApiParam({ name: 'id', description: 'ID của người dùng' })
  @ApiResponse({ status: 200, description: 'Đổi vai trò thành công' })
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.updateRole(id, dto, actor);
  }

  @Patch(':id/status')
  @Roles(RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Khóa / mở khóa tài khoản người dùng và thu hồi phiên đăng nhập cũ (ADMIN – WP4 4.4)',
  })
  @ApiParam({ name: 'id', description: 'ID của người dùng' })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thành công' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.updateStatus(id, dto, actor);
  }

  @Delete(':id')
  @Roles(RoleCode.ADMIN)
  @ApiOperation({ summary: 'Xóa mềm tài khoản người dùng (ADMIN)' })
  @ApiParam({ name: 'id', description: 'ID của người dùng' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng' })
  remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.remove(id, actor);
  }
}
