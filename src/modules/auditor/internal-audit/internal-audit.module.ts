import { Module } from '@nestjs/common';
import { InternalAuditService } from './internal-audit.service';
import { AuditTypeModule } from '../../admin/audit-type-master/audit-type.module';

// Sub-services split by role
import { ReviewerService } from './services/reviewer.service';
import { ComplianceService } from './services/compliance.service';
import { SamplingService } from './services/sampling.service';

// Sub-controllers split by role
import { AuditorController } from './controllers/auditor.controller';
import { ReviewerController } from './controllers/reviewer.controller';
import { ComplianceController } from './controllers/compliance.controller';

@Module({
  imports: [AuditTypeModule],
  controllers: [
    AuditorController,
    ReviewerController,
    ComplianceController,
  ],
  providers: [
    InternalAuditService,
    ReviewerService,
    ComplianceService,
    SamplingService,
  ],
})
export class InternalAuditModule {}
