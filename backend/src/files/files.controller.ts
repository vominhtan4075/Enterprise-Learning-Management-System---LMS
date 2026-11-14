import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { FilesService } from './files.service.js';
import type { UploadedFilePayload } from './files.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Tải lên tệp tài liệu PDF (Kiểm tra magic bytes %PDF-, SHA-256 checksum, tối đa MAX_UPLOAD_MB)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Tệp tài liệu định dạng PDF',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Tải lên tệp PDF thành công' })
  @ApiResponse({
    status: 400,
    description: 'Tệp không đúng định dạng PDF hoặc vượt quá dung lượng',
  })
  upload(
    @UploadedFile() file: UploadedFilePayload,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.filesService.uploadPdf(file, actor);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Tải xuống / xem trực tiếp tệp PDF bài học (Kiểm tra quyền ghi danh khóa học với EMPLOYEE)',
  })
  @ApiParam({ name: 'id', description: 'ID của tệp tài liệu' })
  @ApiResponse({ status: 200, description: 'Luồng nhị phân tệp PDF' })
  @ApiResponse({ status: 403, description: 'Chưa ghi danh vào khóa học chứa tài liệu' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tệp' })
  async download(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { streamable, originalName, mimeType } =
      await this.filesService.downloadFile(id, actor);
    const safeFilename = encodeURIComponent(originalName);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
    });
    return streamable;
  }

  @Delete(':id')
  @Roles(RoleCode.TRAINER, RoleCode.ADMIN)
  @ApiOperation({
    summary:
      'Xóa tệp tài liệu (Owner TRAINER, ADMIN – Chặn nếu còn bài học đang tham chiếu)',
  })
  @ApiParam({ name: 'id', description: 'ID của tệp tài liệu' })
  @ApiResponse({ status: 200, description: 'Xóa tệp thành công' })
  @ApiResponse({ status: 422, description: 'Tệp đang được gắn với bài học' })
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.filesService.remove(id, actor);
  }
}

