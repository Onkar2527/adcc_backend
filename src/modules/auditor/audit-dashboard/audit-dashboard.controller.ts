import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
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
}