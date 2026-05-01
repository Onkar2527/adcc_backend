import { Module } from '@nestjs/common';
import { LoanTypesService } from './loan-types.service';
import { LoanTypesController } from './loan-types.controller';
import { IdModule } from '../../core/id/id.module';

@Module({
  imports: [IdModule],
  controllers: [LoanTypesController],
  providers: [LoanTypesService],
  exports: [LoanTypesService],
})
export class LoanTypesModule {}
