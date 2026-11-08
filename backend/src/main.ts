import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { AppModule, ObserveInstrument } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // Bảo mật HTTP headers & nén Gzip
  app.use(helmet());
  app.use(compression());

  // Giới hạn kích thước body JSON 1 MB theo chuẩn WP1
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // Cấu hình CORS theo biến môi trường CORS_ORIGINS
  const corsOrigins = (
    process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Thiết lập tiền tố toàn cục /api/v1 chuẩn theo [W2] và v4 plan
  app.setGlobalPrefix('api/v1');

  // Kích hoạt ValidationPipe, AllExceptionsFilter và ResponseInterceptor toàn cục
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Cấu hình Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Corporate LMS API')
    .setDescription(
      'Tài liệu RESTful API hệ thống Quản lý Đào tạo Nội bộ & Đánh giá Năng lực (NovaTech Solutions)',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .addTag('Health', 'Kiểm tra trạng thái hệ thống, kết nối CSDL & Redis')
    .addTag('Auth', 'Xác thực JWT và quản lý phiên đăng nhập')
    .addTag('Users', 'Quản lý tài khoản và người dùng')
    .addTag('Courses', 'Quản lý khóa học, học phần, bài giảng & tài liệu')
    .addTag('Learning Paths', 'Quản lý lộ trình học tập theo vị trí')
    .addTag('Enrollments', 'Ghi danh và phân công lộ trình đào tạo')
    .addTag('Progress', 'Theo dõi tiến độ học tập và mở khóa tuần tự (BR-02)')
    .addTag('Quizzes', 'Ngân hàng câu hỏi và kiểm tra đánh giá (BR-01, BR-03)')
    .addTag('Reports', 'Báo cáo thống kê và Ma trận năng lực (Competency Matrix)')
    .addTag('Notifications', 'Thông báo hệ thống và nhắc hạn tự động')
    .addTag('HRM Integration', 'Tích hợp đồng bộ nhân sự với hệ thống HRM')
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
