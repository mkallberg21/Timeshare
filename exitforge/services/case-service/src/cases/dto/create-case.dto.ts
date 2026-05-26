import { IsString, IsNumber, IsNotEmpty, Min, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCaseDto {
  @ApiProperty({ description: 'Resort ID from resort-intelligence service' })
  @IsString()
  @IsNotEmpty()
  resortId!: string;

  @ApiProperty({ example: 2015 })
  @IsNumber()
  @Min(1980)
  contractYear!: number;

  @ApiProperty({ example: 25000.0, description: 'Original purchase price in USD' })
  @IsNumber()
  @IsPositive()
  purchasePrice!: number;

  @ApiProperty({ example: 1800.0, description: 'Annual maintenance fee in USD' })
  @IsNumber()
  @IsPositive()
  maintenanceFeeAnnual!: number;

  @ApiProperty({ example: 8000.0, description: 'Remaining mortgage balance in USD (0 if paid)' })
  @IsNumber()
  @Min(0)
  outstandingMortgage!: number;

  @ApiProperty({ description: 'S3 key of the uploaded contract PDF' })
  @IsString()
  @IsNotEmpty()
  contractS3Key!: string;
}
