import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import twilio from 'twilio';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
}

export interface SendSmsOptions {
  to: string; // E.164 format: +1XXXXXXXXXX
  body: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly twilioClient: twilio.Twilio;
  private readonly twilioFrom: string;

  constructor(private readonly config: ConfigService) {
    const sendgridKey = this.config.getOrThrow<string>('SENDGRID_API_KEY');
    sgMail.setApiKey(sendgridKey);

    const accountSid = this.config.getOrThrow<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.getOrThrow<string>('TWILIO_AUTH_TOKEN');
    this.twilioClient = twilio(accountSid, authToken);
    this.twilioFrom = this.config.getOrThrow<string>('TWILIO_FROM_NUMBER');
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const from = this.config.get<string>('SENDGRID_FROM_EMAIL', 'noreply@exitforge.com');

    const msg: Parameters<typeof sgMail.send>[0] = {
      to: options.to,
      from,
      subject: options.subject,
      text: options.text,
    };

    if (options.html) msg.html = options.html;
    if (options.templateId) {
      msg.templateId = options.templateId;
      if (options.dynamicTemplateData) {
        (msg as Record<string, unknown>).dynamicTemplateData = options.dynamicTemplateData;
      }
    }

    await sgMail.send(msg);
    this.logger.log('Email sent', { to: options.to, subject: options.subject });
  }

  async sendSms(options: SendSmsOptions): Promise<void> {
    await this.twilioClient.messages.create({
      to: options.to,
      from: this.twilioFrom,
      body: options.body,
    });
    this.logger.log('SMS sent', { to: options.to });
  }

  /**
   * Sends case status update notifications via the client's preferred channel.
   */
  async notifyCaseStatusChange(params: {
    clientEmail: string;
    clientPhone: string | null;
    caseId: string;
    newStatus: string;
    message: string;
    preferredChannel?: 'email' | 'sms' | 'both';
  }): Promise<void> {
    const channel = params.preferredChannel ?? 'email';

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Case Update — ExitForge</h2>
        <p>Your case status has been updated.</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <strong>Status:</strong> ${params.newStatus}<br/>
          <strong>Case ID:</strong> ${params.caseId.slice(-8).toUpperCase()}
        </div>
        <p>${params.message}</p>
        <p>Log in to your portal to view full details.</p>
        <a href="https://app.exitforge.com/cases/${params.caseId}" 
           style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Case
        </a>
      </div>
    `;

    if (channel === 'email' || channel === 'both') {
      await this.sendEmail({
        to: params.clientEmail,
        subject: `Case Update: ${params.newStatus} — ExitForge`,
        text: params.message,
        html: emailHtml,
      });
    }

    if ((channel === 'sms' || channel === 'both') && params.clientPhone) {
      await this.sendSms({
        to: params.clientPhone,
        body: `ExitForge: ${params.message} Case #${params.caseId.slice(-8).toUpperCase()} — Reply STOP to opt out`,
      });
    }
  }
}
