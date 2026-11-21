import { Module } from '@nestjs/common';
import { QuizController } from './quiz.controller.js';
import { QuizService } from './quiz.service.js';
import { CompetencyModule } from '../competency/competency.module.js';

@Module({
  imports: [CompetencyModule],
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}

