import { Module } from '@nestjs/common';
import { InternalAuditController } from './internal-audit.controller';
import { InternalAuditService } from './internal-audit.service';
import { AuditTypeModule } from '../../admin/audit-type-master/audit-type.module';

@Module({
  imports: [AuditTypeModule],
  controllers: [InternalAuditController],
  providers: [InternalAuditService],
})
export class InternalAuditModule { }
