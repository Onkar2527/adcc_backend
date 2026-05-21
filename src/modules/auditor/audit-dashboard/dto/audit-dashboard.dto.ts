import {
    IsInt,
    IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AuditDashboardDto {

    @IsInt()
    @Type(() => Number)
    employee_id!: number;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    financial_year_id?: number;
}

export class OpenAssessmentDto {

    @IsInt()
    @Type(() => Number)
    employee_id!: number;

    @IsInt()
    @Type(() => Number)
    audit_unit_id!: number;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    financial_year_id?: number;
}
