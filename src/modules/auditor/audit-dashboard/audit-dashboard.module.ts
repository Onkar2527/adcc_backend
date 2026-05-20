import { Module } from '@nestjs/common';
import { AuditDashboardService } from './audit-dashboard.service';
import { AuditDashboardController } from './audit-dashboard.controller';
import { IdModule } from '../../../core/id/id.module';

@Module({
  imports: [IdModule],
  controllers: [AuditDashboardController],
  providers: [AuditDashboardService],
  exports: [AuditDashboardService],
})
export class AuditDashboardModule { }
