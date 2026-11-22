import { CanActivate, DynamicModule, Injectable, Module } from '@nestjs/common';

export const Throttle =
  (_options?: unknown): MethodDecorator & ClassDecorator =>
  () =>
    undefined;

export const SkipThrottle =
  (_skip?: unknown): MethodDecorator & ClassDecorator =>
  () =>
    undefined;

@Injectable()
export class ThrottlerGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

@Module({})
export class ThrottlerModule {
  static forRoot(_options?: unknown): DynamicModule {
    return { module: ThrottlerModule };
  }
}
