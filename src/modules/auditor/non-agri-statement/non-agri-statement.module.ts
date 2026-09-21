import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../core/database/database.module';
import { NonAgriStatementController } from './non-agri-statement.controller';
import { NonAgriStatementService } from './non-agri-statement.service';

@Module({
  imports: [DatabaseModule],
  controllers: [NonAgriStatementController],
  providers: [NonAgriStatementService],
  exports: [NonAgriStatementService],
})
export class NonAgriStatementModule {}
