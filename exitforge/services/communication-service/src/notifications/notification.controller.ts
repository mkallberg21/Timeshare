import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationService } from './notification.service';

class SendEmailDto {
  @ApiProperty()
  @IsEmail()
  to!: string;

  @ApiProperty()
  @IsString()
  subject!: string;

  @ApiProperty()
  @IsString()
  text!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  html?: string;
}

class SendSmsDto {
  @ApiProperty({ description: 'E.164 format: +1XXXXXXXXXX' })
  @IsString()
  to!: string;

  @ApiProperty()
  @IsString()
  body!: string;
}

class CaseStatusNotificationDto {
  @ApiProperty()
  @IsEmail()
  clientEmail!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  clientPhone?: string;

  @ApiProperty()
  @IsString()
  caseId!: string;

  @ApiProperty()
  @IsString()
  newStatus!: string;

  @ApiProperty()
  @IsString()
  message!: string;

  @ApiPropertyOptional({ enum: ['email', 'sms', 'both'] })
  @IsEnum(['email', 'sms', 'both'])
  @IsOptional()
  preferredChannel?: 'email' | 'sms' | 'both';
}

@ApiTags('Communications')
@Controller('api/v1/communications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Post('email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a transactional email via SendGrid' })
  async sendEmail(@Body() dto: SendEmailDto) {
    await this.notificationService.sendEmail(dto);
    return { success: true, data: { sent: true } };
  }

  @Post('sms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an SMS via Twilio' })
  async sendSms(@Body() dto: SendSmsDto) {
    await this.notificationService.sendSms(dto);
    return { success: true, data: { sent: true } };
  }

  @Post('case-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Notify client of case status change via preferred channel' })
  async notifyCaseStatus(@Body() dto: CaseStatusNotificationDto) {
    await this.notificationService.notifyCaseStatusChange({
      clientEmail: dto.clientEmail,
      clientPhone: dto.clientPhone ?? null,
      caseId: dto.caseId,
      newStatus: dto.newStatus,
      message: dto.message,
      preferredChannel: dto.preferredChannel,
    });
    return { success: true, data: { sent: true } };
  }

  @Post('health')
  health() {
    return { status: 'healthy', service: 'communication-service' };
  }
}
