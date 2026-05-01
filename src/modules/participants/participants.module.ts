import { Module } from '@nestjs/common';
import { ParticipantsController } from './participants.controller';
import { ParticipantsService } from './participants.service';
import { DatabaseModule } from '../../core/database/database.module';
import { IdModule } from '../../core/id/id.module';

@Module({
  imports: [DatabaseModule, IdModule],
  controllers: [ParticipantsController],
  providers: [ParticipantsService],
  exports: [ParticipantsService]
})
export class ParticipantsModule {}
