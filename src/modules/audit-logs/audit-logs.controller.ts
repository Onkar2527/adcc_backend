import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

@Controller('admin/audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async getLogs(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('employeeId') employeeId?: string,
    @Query('eventType') eventType?: string,
    @Query('branchId') branchId?: string,
    @Query('auditUnitId') auditUnitId?: string,
    @Query('assessmentId') assessmentId?: string,
  ) {
    return this.auditLogService.getLogs({
      startDate,
      endDate,
      employeeId,
      eventType,
      branchId,
      auditUnitId,
      assessmentId,
    });
  }

  @Get('filter-options')
  async getFilterOptions() {
    return this.auditLogService.getFilterOptions();
  }
}
