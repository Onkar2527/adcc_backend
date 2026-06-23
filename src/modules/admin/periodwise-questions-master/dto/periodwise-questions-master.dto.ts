import {
    ArrayUnique,
    IsArray,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString
} from "class-validator";

export class CreateMultiLevelControlMasterDto {

    @IsArray()
    @ArrayUnique()
    @IsInt({ each: true })
    audit_type_ids!: number[];

    @IsNotEmpty()
    @IsNumber()
    year_id!: number;

    @IsNotEmpty()
    @IsNumber()
    section_type_id!: number;

    @IsNotEmpty()
    @IsNumber()
    user_type_id!: number;

    @IsNotEmpty()
    @IsNumber()
    audit_unit_id!: number;

    @IsNotEmpty()
    @IsString()
    start_month_year!: string;

    @IsNotEmpty()
    @IsString()
    end_month_year!: string;

    @IsOptional()
    @IsString()
    menu_ids?: string;

    @IsOptional()
    @IsString()
    cat_ids?: string;

    @IsOptional()
    @IsString()
    header_ids?: string;

    @IsOptional()
    @IsString()
    question_ids?: string;

    @IsOptional()
    @IsString()
    advances_scheme_ids?: string;

    @IsOptional()
    @IsString()
    deposits_scheme_ids?: string;

    @IsOptional()
    @IsNumber()
    admin_id?: number;

}
