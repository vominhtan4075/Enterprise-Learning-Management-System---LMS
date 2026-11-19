import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly mailFrom: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST') ?? 'localhost';
    const port = this.configService.get<number>('SMTP_PORT') ?? 1025;
    const user = this.configService.get<string>('SMTP_USER') ?? '';
    const pass = this.configService.get<string>('SMTP_PASS') ?? '';
    this.mailFrom =
      this.configService.get<string>('MAIL_FROM') ??
      '"NovaTech LMS" <no-reply@novatech.com>';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }

  /**
   * Gửi email không đồng bộ (best-effort): nếu SMTP/MailHog không phản hồi,
   * chỉ ghi log cảnh báo chứ không làm hỏng luồng giao dịch chính (WP10).
   */
  async sendMailSafe(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: this.mailFrom,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html:
          options.html ??
          `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
            <h3 style="color: #2563eb;">NovaTech Corporate LMS</h3>
            <p>${options.text.replace(/\n/g, '<br/>')}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
            <small style="color: #6b7280;">Email tự động từ Hệ thống Quản lý Đào tạo NovaTech Solutions.</small>
          </div>`,
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `Không thể gửi email tới ${options.to} (subject="${options.subject}"): ${(err as Error).message}`,
      );
      return false;
    }
  }
}
