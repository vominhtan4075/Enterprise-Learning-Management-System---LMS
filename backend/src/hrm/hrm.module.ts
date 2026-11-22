import { Module } from '@nestjs/common';
import { HrmController } from './hrm.controller.js';
import { HrmService } from './hrm.service.js';

@Module({
  controllers: [HrmController],
  providers: [HrmService],
  exports: [HrmService],
})
export class HrmModule {}