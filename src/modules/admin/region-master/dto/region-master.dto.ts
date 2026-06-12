import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator';

export class CreateRegionDto {
  @IsString()
  region_name: string;

  @IsArray()
  @IsNumber({}, { each: true })
  unit_ids: number[];

  @IsOptional()
  @IsNumber()
  is_active?: number;

  @IsOptional()
  @IsNumber()
  admin_id?: number;
}

export class UpdateRegionDto {
  @IsOptional()
  @IsString()
  region_name?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  unit_ids?: number[];

  @IsOptional()
  @IsNumber()
  is_active?: number;

  @IsOptional()
  @IsNumber()
  admin_id?: number;
}
