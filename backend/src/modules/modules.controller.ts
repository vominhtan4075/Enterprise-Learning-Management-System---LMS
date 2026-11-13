import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ModulesService } from './modules.service.js';
import {
  CreateModuleDto,
  ReorderModulesDto,
  UpdateModuleDto,
} from './dto/module.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';

@ApiTags('Modules')
@ApiBearerAuth()
@Controller()
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Post('courses/:id/modules')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Tạo học phần (Module) mới trong khóa học (Owner TRAINER, ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID của khóa học (courseId)' })
  @ApiResponse({ status: 201, description: 'Tạo học phần thành công' })
  create(
    @Param('id') courseId: string,
    @Body() dto: CreateModuleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.modulesService.create(courseId, dto, actor);
  }

  @Put('modules/:id')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary: 'Cập nhật thông tin học phần (Owner TRAINER, ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID của học phần (moduleId)' })
  @ApiResponse({ status: 200, description: 'Cập nhật học phần thành công' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateModuleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.modulesService.update(id, dto, actor);
  }

  @Delete('modules/:id')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Xóa mềm học phần & dồn lại thứ tự (Chặn nếu đã có lượt làm bài Quiz hoặc bài học hoàn thành)',
  })
  @ApiParam({ name: 'id', description: 'ID của học phần (moduleId)' })
  @ApiResponse({ status: 200, description: 'Xóa mềm học phần thành công' })
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.modulesService.remove(id, actor);
  }

  @Put('courses/:id/modules/order')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Sắp xếp lại thứ tự toàn bộ học phần trong khóa học bằng transaction 2 bước (Owner TRAINER, ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID của khóa học (courseId)' })
  @ApiResponse({ status: 200, description: 'Sắp xếp thứ tự học phần thành công' })
  reorder(
    @Param('id') courseId: string,
    @Body() dto: ReorderModulesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.modulesService.reorder(courseId, dto, actor);
  }
}

