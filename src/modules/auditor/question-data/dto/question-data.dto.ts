import {
    IsInt,
    IsOptional,
} from 'class-validator';

export class QuestionDataDto {

    @IsInt()
    assessment_id!: number;

}
