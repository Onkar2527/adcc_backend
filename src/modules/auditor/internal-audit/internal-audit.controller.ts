import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
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

  @Get(':assessmentId/category/:categoryId')
  getCategory(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('categoryId', ParseIntPipe)
    categoryId: number,

    @Query('employee_id')
    employeeId?: string,
  ) {

    return this.service.getCategory(
      assessmentId,
      categoryId,
      Number(employeeId || 0),
    );
  }

  @Post(':assessmentId/category/:categoryId/answers')
  saveCategoryAnswers(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('categoryId', ParseIntPipe)
    categoryId: number,

    @Body()
    body: any,
  ) {

    return this.service.saveCategoryAnswers(
      assessmentId,
      categoryId,
      Number(body?.employee_id || 0),
      body?.answers || [],
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

  @Post('unit/:auditUnitId/start/:yearId')
  startAssessment(
    @Param('auditUnitId', ParseIntPipe)
    auditUnitId: number,

    @Param('yearId', ParseIntPipe)
    yearId: number,

    @Body()
    body: any,
  ) {

    return this.service.startAssessment(
      auditUnitId,
      yearId,
      Number(body?.employee_id || 0),
    );
  }
}
