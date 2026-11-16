import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdateProgressDto {
  @ApiProperty({
    example: 'lesson-uuid-1',
    description: 'ID của bài học cần đánh dấu hoàn thành',
  })
  @IsString()
  @IsNotEmpty({ message: 'lessonId không được để trống.' })
  lessonId: string;

  @ApiProperty({
    example: true,
    description:
      'Trạng thái hoàn thành bài học (Bắt buộc là true – Hệ thống không hỗ trợ bỏ hoàn thành isCompleted=false trong MVP)',
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'isCompleted phải là kiểu boolean.' })
  isCompleted: boolean;
}
