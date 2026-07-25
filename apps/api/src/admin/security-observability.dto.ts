import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum SecurityAlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export enum SecurityAlertSeverity {
  WARNING = 'WARNING',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class SecurityAlertQueryDto {
  @IsOptional()
  @IsEnum(SecurityAlertStatus)
  status?: SecurityAlertStatus;

  @IsOptional()
  @IsEnum(SecurityAlertSeverity)
  severity?: SecurityAlertSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ruleKey?: string;

  @IsOptional()
  @IsISO8601()
  before?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  beforeId?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SecurityAlertTransitionDto {
  @IsEnum(SecurityAlertStatus)
  status!: SecurityAlertStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class SecurityAlertAssignmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  assigneeUserId?: string | null;
}
