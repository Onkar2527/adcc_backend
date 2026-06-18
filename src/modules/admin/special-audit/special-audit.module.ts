import { Module } from '@nestjs/common';
import { SpecialAuditController } from './special-audit.controller';
import { SpecialAuditService } from './special-audit.service';

@Module({
  controllers: [SpecialAuditController],
  providers: [SpecialAuditService],
})
export class SpecialAuditModule {}
