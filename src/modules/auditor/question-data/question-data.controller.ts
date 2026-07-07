import {
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Query,
} from '@nestjs/common';

import { QuestionDataService }
    from './question-data.service';

@Controller('question-data')
export class QuestionDataController {

    constructor(
        private readonly service: QuestionDataService,
    ) { }

      @Get(':assessment_id')
    getQuestionData(
        @Param(
            'assessment_id',
            ParseIntPipe,
        )
        assessment_id: number,
        @Query('language_id')
        language_id?: string,
    ) {

        return this.service.getQuestionData(
            assessment_id,
            language_id ? Number(language_id) : undefined,
        );

    }
   
}