import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateSpecialAuditDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsInt()
  @Min(1)
  year_id!: number;

  @IsInt()
  @Min(1)
  audit_unit_id!: number;

  @IsInt()
  @Min(1)
  control_master_id!: number;

  @IsInt()
  @Min(1)
  auditor_id!: number;

  @IsDateString()
  assesment_period_from!: string;

  @IsDateString()
  assesment_period_to!: string;

  @IsDateString()
  @IsOptional()
  audit_due_date?: string;
}

export class UpdateSpecialAuditDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  year_id?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  audit_unit_id?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  control_master_id?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  auditor_id?: number;

  @IsDateString()
  @IsOptional()
  assesment_period_from?: string;

  @IsDateString()
  @IsOptional()
  assesment_period_to?: string;

  @IsDateString()
  @IsOptional()
  audit_due_date?: string;
}
