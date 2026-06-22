import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateIncidentDto {
  @IsNotEmpty()
  @IsInt()
  audit_unit_id!: number;

  @IsNotEmpty()
  @IsString()
  incident_type!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsOptional()
  @IsInt()
  reported_by?: number;
}

export class UpdateIncidentDto {
  @IsOptional()
  @IsInt()
  audit_unit_id?: number;

  @IsOptional()
  @IsString()
  incident_type?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  reported_by?: number;
}
