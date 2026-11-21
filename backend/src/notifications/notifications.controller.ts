import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { QueryNotificationsDto } from './dto/notification.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lấy danh sách thông báo in-app của người dùng hiện tại kèm số lượng chưa đọc (unreadCount)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Danh sách thông báo phân trang kèm unreadCount',
  })
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.findAll(actor, query);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Đánh dấu đã đọc toàn bộ thông báo của người dùng hiện tại',
  })
  @ApiResponse({
    status: 200,
    description: 'Đánh dấu đã đọc tất cả thông báo thành công (updatedCount)',
  })
  markAllAsRead(@CurrentUser() actor: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(actor);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Đánh dấu đã đọc 1 thông báo của chính mình',
  })
  @ApiParam({ name: 'id', description: 'ID của thông báo' })
  @ApiResponse({ status: 200, description: 'Đánh dấu đã đọc thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy thông báo' })
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.notificationsService.markAsRead(id, actor);
  }

  @Post('reminders/run')
  @Roles(RoleCode.ADMIN, RoleCode.HR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Chạy thủ công tiến trình quét nhắc hạn (D-3, D-1, D-0) và đánh dấu quá hạn (OVERDUE) (ADMIN, HR – Hỗ trợ Demo/QA)',
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả quét nhắc hạn (scannedCount, remindersSent, overdueMarked)',
  })
  runRemindersNow() {
    return this.notificationsService.runDeadlineRemindersJob();
  }
}
