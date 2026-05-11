import {
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
} from 'class-validator';

export class CreateQuestionSetDto {
    @IsNotEmpty()
    @IsString()
    @Matches(/^[a-zA-Z0-9 ]+$/)
    name!: string;

    @IsInt()
    @IsIn([1, 2])
    set_type_id!: number;

    @IsOptional()
    @IsInt()
    is_active?: number;

    @IsOptional()
    @IsInt()
    admin_id?: number;
}

export class UpdateQuestionSetDto {
    @IsOptional()
    @IsString()
    @Matches(/^[a-zA-Z0-9 ]+$/)
    name?: string;

    @IsOptional()
    @IsInt()
    @IsIn([1, 2])
    set_type_id?: number;

    @IsOptional()
    @IsInt()
    is_active?: number;

    @IsOptional()
    @IsInt()
    admin_id?: number;
}

export class CreateQuestionHeaderDto {
    @IsInt()
    question_set_id!: number;

    @IsNotEmpty()
    @IsString()
    @Matches(/^[a-zA-Z0-9 ]+$/)
    name!: string;

    @IsOptional()
    @IsInt()
    is_active?: number;

    @IsOptional()
    @IsInt()
    admin_id?: number;
}

export class UpdateQuestionHeaderDto {
    @IsOptional()
    @IsInt()
    question_set_id?: number;

    @IsOptional()
    @IsString()
    @Matches(/^[a-zA-Z0-9 ]+$/)
    name?: string;

    @IsOptional()
    @IsInt()
    is_active?: number;

    @IsOptional()
    @IsInt()
    admin_id?: number;
}

export class CreateQuestionDto {
    @IsInt()
    set_id!: number;

    @IsInt()
    header_id!: number;

    @IsNotEmpty()
    @IsString()
    question!: string;

    @IsInt()
    question_type_id!: number;

    @IsInt()
    option_id!: number;

    @IsInt()
    applicable_id!: number;

    @IsInt()
    risk_category_id!: number;

    @IsOptional()
    @IsInt()
    is_active?: number;

    @IsOptional()
    @IsInt()
    admin_id?: number;
}

export class UpdateQuestionDto {
    @IsOptional()
    @IsInt()
    set_id?: number;

    @IsOptional()
    @IsInt()
    header_id?: number;

    @IsOptional()
    @IsString()
    question?: string;

    @IsOptional()
    @IsInt()
    question_type_id?: number;

    @IsOptional()
    @IsInt()
    option_id?: number;

    @IsOptional()
    @IsInt()
    applicable_id?: number;

    @IsOptional()
    @IsInt()
    risk_category_id?: number;

    @IsOptional()
    @IsInt()
    is_active?: number;

    @IsOptional()
    @IsInt()
    admin_id?: number;
}