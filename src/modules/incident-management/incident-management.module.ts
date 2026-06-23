import { Module } from '@nestjs/common';
import { IncidentManagementService } from './incident-management.service';
import { IncidentManagementController } from './incident-management.controller';

@Module({
  controllers: [IncidentManagementController],
  providers: [IncidentManagementService],
  exports: [IncidentManagementService],
})
export class IncidentManagementModule {}
