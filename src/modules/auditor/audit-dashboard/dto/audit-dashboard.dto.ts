import {
    IsInt,
    IsOptional,
} from 'class-validator';

export class AuditDashboardDto {

    @IsInt()
    employee_id!: number;

    @IsOptional()
    @IsInt()
    financial_year_id?: number;
}

export class OpenAssessmentDto {

    @IsInt()
    employee_id!: number;

    @IsInt()
    audit_unit_id!: number;

    @IsOptional()
    @IsInt()
    financial_year_id?: number;
}