import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';

export class CreatePolicyDocumentDto {
    @IsOptional()
    @IsString()
    document_code?: string;

    @IsNotEmpty()
    @IsString()
    document_title!: string;

    @IsOptional()
    @IsString()
    department?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNotEmpty()
    @IsString()
    version_no!: string;

    @IsOptional()
    @IsString()
    issue_date?: string;

    @IsOptional()
    @IsString()
    effective_date?: string;

    @IsOptional()
    @IsString()
    review_date?: string;

    @IsOptional()
    @IsString()
    expiry_date?: string;

    @IsOptional()
    @IsString()
    approved_by?: string;

    @IsOptional()
    @IsString()
    approved_date?: string;

    @IsOptional()
    @IsString()
    certified_authority?: string;

    @IsOptional()
    @IsString()
    certified_date?: string;

    @IsOptional()
    @IsString()
    certification_remarks?: string;

    @IsOptional()
    @IsString()
    user_access?: string;

    @IsOptional()
    @IsInt()
    is_active?: number;

    @IsOptional()
    @IsInt()
    uploaded_by?: number;
}

export class UpdatePolicyDocumentDto {
    @IsOptional()
    @IsString()
    document_code?: string;

    @IsOptional()
    @IsString()
    document_title?: string;

    @IsOptional()
    @IsString()
    department?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    version_no?: string;

    @IsOptional()
    @IsString()
    issue_date?: string;

    @IsOptional()
    @IsString()
    effective_date?: string;

    @IsOptional()
    @IsString()
    review_date?: string;

    @IsOptional()
    @IsString()
    expiry_date?: string;

    @IsOptional()
    @IsString()
    approved_by?: string;

    @IsOptional()
    @IsString()
    approved_date?: string;

    @IsOptional()
    @IsString()
    certified_authority?: string;

    @IsOptional()
    @IsString()
    certified_date?: string;

    @IsOptional()
    @IsString()
    certification_remarks?: string;

    @IsOptional()
    @IsString()
    user_access?: string;

    @IsOptional()
    @IsInt()
    is_active?: number;

    @IsOptional()
    @IsInt()
    uploaded_by?: number;
}
