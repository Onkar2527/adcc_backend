import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../core/database/database.module';
import { PolicyDocumentsController } from './policy-documents.controller';
import { PolicyDocumentsService } from './policy-documents.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PolicyDocumentsController],
  providers: [PolicyDocumentsService],
  exports: [PolicyDocumentsService],
})
export class PolicyDocumentsModule {}
