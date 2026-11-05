import { Module } from '@nestjs/common';
import { HrmController } from './hrm.controller.js';
import { HrmService } from './hrm.service.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  controllers: [HrmController],
  providers: [HrmService, PrismaService],
})
export class HrmModule {}