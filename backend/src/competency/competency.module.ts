import { Module } from '@nestjs/common';
import { CompetencyService } from './competency.service.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  providers: [CompetencyService, PrismaService],
  exports: [CompetencyService],
})
export class CompetencyModule {}