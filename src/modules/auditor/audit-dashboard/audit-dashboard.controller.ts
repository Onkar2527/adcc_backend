import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
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
  ) {

    return this.service
      .getExecutiveSummary(
        Number(assessment_id),
      );

  }
  @Post('save-executive-summary')
  async saveExecutiveSummary(
    @Body() body: any,
    @Req() req: any,
  ) {

    return this.service.saveExecutiveSummary(
      body,
      req.admin_id,
    );

  }
  @Get('branch-financial-position/:branch_id')
async getBranchFinancialPosition(
    @Param('branch_id')
    branch_id: number,
) {

    return this.service.getBranchFinancialPosition(
        Number(branch_id),
    );

}
}