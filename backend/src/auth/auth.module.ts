import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { MustChangePasswordGuard } from './guards/must-change-password.guard.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret:
          process.env.JWT_SECRET ??
          'novatech-lms-super-secret-jwt-key-2026-dev',
        signOptions: {
          expiresIn: (process.env.JWT_EXPIRES_IN ?? '24h') as '24h',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    MustChangePasswordGuard,
  ],
  exports: [
    AuthService,
    PasswordService,
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
    MustChangePasswordGuard,
  ],
})
export class AuthModule {}

