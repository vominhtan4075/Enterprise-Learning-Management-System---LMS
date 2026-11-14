import { Module } from '@nestjs/common';
import { LessonsController } from './lessons.controller.js';
import { LessonsService } from './lessons.service.js';
import { CoursesModule } from '../courses/courses.module.js';
import { FilesModule } from '../files/files.module.js';

@Module({
  imports: [CoursesModule, FilesModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}

