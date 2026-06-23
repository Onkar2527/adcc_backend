import { Module } from '@nestjs/common';
import { AuditTypeController } from './audit-type.controller';
import { AuditTypeService } from './audit-type.service';

@Module({
    controllers: [AuditTypeController],
    providers: [AuditTypeService],
    exports: [AuditTypeService],
})
export class AuditTypeModule { }
