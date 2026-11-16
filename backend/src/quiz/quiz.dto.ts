import {IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested,} from 'class-validator';
import { Type } from 'class-transformer';

export class AnswerSubmissionDto {
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @IsOptional()
  @IsString()
  selectedOption?: string;

  @IsOptional()
  @IsString()
  answer?: string;
}

export class SubmitQuizDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  attemptId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerSubmissionDto)
  answers!: AnswerSubmissionDto[];
}