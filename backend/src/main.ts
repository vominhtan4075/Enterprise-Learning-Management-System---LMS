import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // Cấu hình CORS cho Next.js Frontend (port 3000)
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Thiết lập tiền tố toàn cục /api/v1 chuẩn theo [W2] và v4 plan
  app.setGlobalPrefix('api/v1');

  // Kích hoạt ValidationPipe toàn cục
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Cấu hình Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Corporate LMS API')
    .setDescription(
      'Tài liệu RESTful API hệ thống Quản lý Đào tạo Nội bộ & Đánh giá Năng lực (NovaTech Solutions)',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Health', 'Kiểm tra trạng thái hệ thống, kết nối CSDL và CORS')
    .addTag('Users', 'Quản lý tài khoản và người dùng')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  console.log(`🚀 LMS Backend running at:      http://localhost:${port}/api/v1`);
  console.log(`📑 Swagger Documentation:       http://localhost:${port}/api/docs`);
  console.log(`🩺 Healthcheck API:             http://localhost:${port}/api/v1/health`);
  console.log(`👥 Users API:                   http://localhost:${port}/api/v1/users`);
}
bootstrap();
