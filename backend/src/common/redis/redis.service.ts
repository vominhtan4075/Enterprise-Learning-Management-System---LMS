import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 1500,
      retryStrategy: (times) => {
        if (times > 2) {
          return null;
        }
        return Math.min(times * 200, 1000);
      },
    });

    this.client.on('error', (err: Error) => {
      this.logger.debug(`Redis connection warning (fallback DB): ${err.message}`);
    });
  }

  private async ensureConnected(): Promise<boolean> {
    if (this.client.status === 'ready') {
      return true;
    }
    if (
      this.client.status === 'wait' ||
      this.client.status === 'close' ||
      this.client.status === 'end'
    ) {
      try {
        await this.client.connect();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  async ping(): Promise<boolean> {
    try {
      const ok = await this.ensureConnected();
      if (!ok) return false;
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const ok = await this.ensureConnected();
      if (!ok) return null;
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`Redis GET failed for key=${key}: ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    try {
      const ok = await this.ensureConnected();
      if (!ok) return;
      const serialized = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (err) {
      this.logger.warn(`Redis SET failed for key=${key}: ${(err as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      const ok = await this.ensureConnected();
      if (!ok) return;
      await this.client.del(key);
    } catch (err) {
      this.logger.warn(`Redis DEL failed for key=${key}: ${(err as Error).message}`);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      const ok = await this.ensureConnected();
      if (!ok) return;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err) {
      this.logger.warn(
        `Redis DEL pattern failed for pattern=${pattern}: ${(err as Error).message}`,
      );
    }
  }

  async remember<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await factory();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.client.status === 'ready' || this.client.status === 'connecting') {
        await this.client.quit();
      } else {
        this.client.disconnect();
      }
    } catch {
      // Ignore disconnect errors during shutdown
    }
  }
}

