import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../core/database/database.module';
import { AuditCalendarController } from './audit-calendar.controller';
import { AuditCalendarService } from './audit-calendar.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AuditCalendarController],
  providers: [AuditCalendarService],
  exports: [AuditCalendarService],
})
export class AuditCalendarModule {}
