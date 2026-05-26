import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPresignedUrlDto {
  @ApiProperty({ example: 'timeshare-contract.pdf' })
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @ApiProperty({ enum: ['TIMESHARE_CONTRACT', 'DEED', 'MAINTENANCE_FEE_STATEMENT'] })
  @IsEnum(['TIMESHARE_CONTRACT', 'DEED', 'MAINTENANCE_FEE_STATEMENT'])
  documentType!: 'TIMESHARE_CONTRACT' | 'DEED' | 'MAINTENANCE_FEE_STATEMENT';
}
