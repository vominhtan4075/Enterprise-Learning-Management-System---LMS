import { Module } from '@nestjs/common';
import { CompetencyController } from './competency.controller.js';
import { CompetencyService } from './competency.service.js';

@Module({
  controllers: [CompetencyController],
  providers: [CompetencyService],
  exports: [CompetencyService],
})
export class CompetencyModule {}
