import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { NonAgriStatementService, NonAgriStatementDto } from './non-agri-statement.service';

@Controller('internal-audit/non-agri-statement')
export class NonAgriStatementController {
  constructor(private readonly service: NonAgriStatementService) {}

  @Get()
  getStatement(
    @Query('assessment_id') assessmentId?: string,
    @Query('audit_unit_id') auditUnitId?: string,
    @Query('year_id') yearId?: string,
  ) {
    return this.service.getStatement(
      assessmentId ? Number(assessmentId) : undefined,
      auditUnitId ? Number(auditUnitId) : undefined,
      yearId ? Number(yearId) : undefined,
    );
  }

  @Get(':assessmentId')
  getStatementByAssessmentId(@Param('assessmentId') assessmentId: string) {
    return this.service.getStatement(Number(assessmentId));
  }

  @Post()
  saveStatement(@Body() payload: NonAgriStatementDto, @Req() req: any) {
    const userId = req?.user?.id || req?.user?.userId || payload.updated_by || payload.created_by;
    return this.service.saveStatement(payload, userId);
  }
}
