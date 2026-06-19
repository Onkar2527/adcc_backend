import { IsArray, IsOptional } from 'class-validator';

export class MasterBulkUploadDto {
  @IsOptional()
  @IsArray()
  rows: any[];
}
