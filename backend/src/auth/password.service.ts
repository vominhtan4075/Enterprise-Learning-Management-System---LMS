import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private get rounds(): number {
    const parsed = Number(process.env.BCRYPT_ROUNDS ?? 10);
    return Number.isInteger(parsed) && parsed >= 4 && parsed <= 15
      ? parsed
      : 10;
  }

  async hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, this.rounds);
  }

  async compare(plainText: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plainText, hashed);
  }
}

