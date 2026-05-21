import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { InternalAuditService } from './internal-audit.service';

@Controller('internal-audit')
export class InternalAuditController {
  constructor(
    private readonly service:
      InternalAuditService,
  ) { }

  @Get(':assessmentId/overview')
  getOverview(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Query('employee_id')
    employeeId?: string,
  ) {

    return this.service.getOverview(
      assessmentId,
      Number(employeeId || 0),
    );
  }

  @Get(':assessmentId/menu')
  getMenu(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Query('employee_id')
    employeeId?: string,
  ) {

    return this.service.getMenu(
      assessmentId,
      Number(employeeId || 0),
    );
  }

  @Get('unit/:auditUnitId')
  getAuditUnitDashboard(
    @Param('auditUnitId', ParseIntPipe)
    auditUnitId: number,

    @Query('employee_id')
    employeeId?: string,
  ) {

    return this.service.getAuditUnitDashboard(
      auditUnitId,
      Number(employeeId || 0),
    );
  }

  @Get('unit/:auditUnitId/start/:yearId')
  getStartAssessmentPreview(
    @Param('auditUnitId', ParseIntPipe)
    auditUnitId: number,

    @Param('yearId', ParseIntPipe)
    yearId: number,

    @Query('employee_id')
    employeeId?: string,
  ) {

    return this.service.getStartAssessmentPreview(
      auditUnitId,
      yearId,
      Number(employeeId || 0),
    );
  }
}
