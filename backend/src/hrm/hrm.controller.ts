import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { HrmService } from './hrm.service.js';
import { SyncHrmUsersDto } from './dto/sync-user.dto.js';

@Controller('api/v1/hrm')
export class HrmController {
  constructor(private readonly hrmService: HrmService) {}

  @Get('employees')
  @HttpCode(HttpStatus.OK)
  getMockEmployees(@Query('department') department?: string) {
    return this.hrmService.getMockEmployees(department);
  }

  @Post('sync-users')
  @HttpCode(HttpStatus.CREATED)
  async syncUsers(@Body() payload: SyncHrmUsersDto) {
    return this.hrmService.syncUsers(payload);
  }
}