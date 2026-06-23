import {
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';

export class CreateAuditSectionDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    audit_type_id?: string;
}
