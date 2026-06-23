import {
    ArrayUnique,
    IsArray,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';

export class AuditTypeDto {
    @IsNotEmpty()
    @IsString()
    @MaxLength(50)
    code!: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(150)
    name!: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string | null;

    @IsInt()
    @IsIn([0, 1])
    is_system!: number;

    @IsInt()
    @IsIn([0, 1])
    is_active!: number;
}

export class AuditTypeQuestionSetupMappingDto {
    @IsArray()
    @ArrayUnique()
    @IsInt({ each: true })
    control_master_ids!: number[];
}
