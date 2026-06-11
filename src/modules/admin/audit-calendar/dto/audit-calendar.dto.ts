import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';

export class CreateAuditCalendarDto {
  @IsInt()
  @IsNotEmpty()
  audit_unit_id!: number;

  @IsInt()
  @IsNotEmpty()
  audit_scheme_id!: number;

  @IsInt()
  @IsNotEmpty()
  auditor_id!: number;

  @IsDateString()
  @IsNotEmpty()
  start_date!: string;

  @IsDateString()
  @IsNotEmpty()
  end_date!: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsInt()
  @IsOptional()
  is_active?: number;
}

export class UpdateAuditCalendarDto {
  @IsInt()
  @IsOptional()
  audit_unit_id?: number;

  @IsInt()
  @IsOptional()
  audit_scheme_id?: number;

  @IsInt()
  @IsOptional()
  auditor_id?: number;

  @IsDateString()
  @IsOptional()
  start_date?: string;

  @IsDateString()
  @IsOptional()
  end_date?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsInt()
  @IsOptional()
  is_active?: number;
}
