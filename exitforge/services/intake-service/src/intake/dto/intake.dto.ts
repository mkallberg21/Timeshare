import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartIntakeDto {
  @ApiProperty({ description: 'Clerk user ID of the prospective client' })
  @IsString()
  @MinLength(1)
  clerkUserId!: string;

  @ApiProperty({ description: 'Client email' })
  @IsString()
  email!: string;

  @ApiProperty({ description: 'Client first name' })
  @IsString()
  firstName!: string;

  @ApiProperty({ description: 'Client last name' })
  @IsString()
  lastName!: string;
}

export class SubmitIntakeDto {
  @ApiProperty({ description: 'Resort / developer name' })
  @IsString()
  @MinLength(1)
  resortName!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  resortState?: string;

  @ApiProperty({ description: 'Year contract was signed' })
  @IsNumber()
  @Min(1970)
  @Max(new Date().getFullYear())
  contractYear!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  purchasePrice!: number;

  @ApiProperty({ description: 'Annual maintenance fee in USD' })
  @IsNumber()
  @Min(0)
  maintenanceFeeAnnual!: number;

  @ApiProperty({ description: 'Current outstanding mortgage balance (0 if paid off)' })
  @IsNumber()
  @Min(0)
  outstandingMortgage!: number;

  @ApiProperty({ description: 'Claims of what client was told vs reality', type: [String] })
  @IsArray()
  @IsString({ each: true })
  misrepresentationClaims!: string[];

  @ApiProperty({ description: 'Is the client experiencing financial hardship?' })
  @IsBoolean()
  financialHardship!: boolean;

  @ApiPropertyOptional({ description: 'Any additional notes from the client' })
  @IsString()
  @IsOptional()
  additionalNotes?: string;
}
