import { Module } from '@nestjs/common';
import { AuditCalendarModule } from '../audit-calendar/audit-calendar.module';
import { AuditSchemesModule } from '../audit-scheme-master/audit-schemes.module';
import { AuditSectionsModule } from '../audit-section-master/audit-sections.module';
import { AuditUnitsModule } from '../audit-unit-master/audit-units.module';
import { BroaderAreaMasterModule } from '../broader-area-master/broader-area-master.module';
import { EmployeesModule } from '../employee-master/employees.module';
import { RegionMasterModule } from '../region-master/region-master.module';
import { MasterBulkUploadController } from './master-bulk-upload.controller';
import { MasterBulkUploadService } from './master-bulk-upload.service';

@Module({
  imports: [
    EmployeesModule,
    AuditSectionsModule,
    AuditSchemesModule,
    AuditUnitsModule,
    RegionMasterModule,
    BroaderAreaMasterModule,
    AuditCalendarModule,
  ],
  controllers: [MasterBulkUploadController],
  providers: [MasterBulkUploadService],
})
export class MasterBulkUploadModule {}
