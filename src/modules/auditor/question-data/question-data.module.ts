import { Module } from '@nestjs/common';
import { QuestionDataService } from './question-data.service';
import { QuestionDataController } from './question-data.controller';
import { IdModule } from '../../../core/id/id.module';

@Module({
  imports: [IdModule],
  controllers: [QuestionDataController],
  providers: [QuestionDataService],
  exports: [QuestionDataService],
})
export class QuestionDataModule { }
