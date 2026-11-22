import { DynamicModule, Module } from '@nestjs/common';

@Module({})
export class LoggerModule {
  static forRoot(_options?: unknown): DynamicModule {
    return { module: LoggerModule };
  }
}
