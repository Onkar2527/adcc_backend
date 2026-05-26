import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import { AuditDashboardService }
  from './audit-dashboard.service';

import {
  AuditDashboardDto,
  OpenAssessmentDto,
} from './dto/audit-dashboard.dto';

@Controller('audit-dashboard')
export class AuditDashboardController {

  constructor(
    private readonly service:
      AuditDashboardService,
  ) { }

  @Post()
  findAll(
    @Body()
    dto: AuditDashboardDto,
  ) {

    return this.service.findAll(dto);
  }

  @Get(
    'not-started/:auditUnitId',
  )
  getNotStartedByUnit(

    @Param(
      'auditUnitId',
      ParseIntPipe,
    )

    auditUnitId: number,
  ) {

    return this.service
      .getNotStartedByUnit(
        auditUnitId,
      );
  }

  @Get(':auditUnitId')
  getAssessmentDetails(

    @Param(
      'auditUnitId',
      ParseIntPipe,
    )

    auditUnitId: number,
  ) {

    return this.service
      .getAssessmentDetails(
        auditUnitId,
      );
  }

  @Post('open-assessment')
  openAssessment(
    @Body()
    dto: OpenAssessmentDto,
  ) {

    return this.service
      .openAssessment(dto);
  }
  @Get('executive-summary/:assessment_id')
  getExecutiveSummary(
    @Param('assessment_id')
    assessment_id: number,

    @Query('employee_id')
    employeeId?: string,
  ) {

    return this.service
      .getExecutiveSummary(
        Number(assessment_id),
        Number(employeeId || 0),
      );

  }
  @Post('save-executive-summary')
  async saveExecutiveSummary(
    @Body() body: any,
    @Req() req: any,
  ) {

    return this.service.saveExecutiveSummary(
      body,
      Number(body?.employee_id || req.admin_id || 0),
    );

  }
  @Get('branch-financial-position/:assessmentId')
  async getBranchFinancialPosition(
    @Param('assessmentId')
    assessmentId: number,
  ) {

    return this.service.getBranchFinancialPosition(
      Number(assessmentId),
    );

  }
}
