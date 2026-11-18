import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { MailService } from './mail.service.js';

@Module({
  controllers: [NotificationsController],
  providers: [MailService, NotificationsService],
  exports: [MailService, NotificationsService],
})
export class NotificationsModule {}
