import { Global, Module } from '@nestjs/common';
import { ProgressController } from './progress.controller.js';
import { ProgressService } from './progress.service.js';
import { AccessService } from './access.service.js';
import { EnrollmentsModule } from '../enrollments/enrollments.module.js';

@Global()
@Module({
  imports: [EnrollmentsModule],
  controllers: [ProgressController],
  providers: [AccessService, ProgressService],
  exports: [AccessService, ProgressService],
})
export class ProgressModule {}
