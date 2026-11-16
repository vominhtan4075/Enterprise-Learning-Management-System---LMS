import { Module } from '@nestjs/common';
import { LearningPathsController } from './learning-paths.controller.js';
import { LearningPathsService } from './learning-paths.service.js';

@Module({
  controllers: [LearningPathsController],
  providers: [LearningPathsService],
  exports: [LearningPathsService],
})
export class LearningPathsModule {}
