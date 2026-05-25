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
import { InternalAuditService } from './internal-audit.service';
import type { FastifyRequest } from 'fastify';
import '@fastify/multipart';

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

  @Post(':assessmentId/category/:categoryId/question/:questionId/annexure')
  saveAnnexureRow(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('categoryId', ParseIntPipe)
    categoryId: number,

    @Param('questionId', ParseIntPipe)
    questionId: number,

    @Body()
    body: any,
  ) {

    return this.service.saveAnnexureRow(
      assessmentId,
      categoryId,
      questionId,
      Number(body?.employee_id || 0),
      body || {},
    );
  }

  @Get(':assessmentId/category/:categoryId/question/:questionId/annexure/sample')
  getAnnexureCsvSample(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('categoryId', ParseIntPipe)
    categoryId: number,

    @Param('questionId', ParseIntPipe)
    questionId: number,

    @Query('employee_id')
    employeeId?: string,
  ) {

    return this.service.getAnnexureCsvSample(
      assessmentId,
      categoryId,
      questionId,
      Number(employeeId || 0),
    );
  }

  @Post(':assessmentId/category/:categoryId/question/:questionId/annexure/upload')
  async uploadAnnexureCsv(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('categoryId', ParseIntPipe)
    categoryId: number,

    @Param('questionId', ParseIntPipe)
    questionId: number,

    @Req()
    req: FastifyRequest,
  ) {

    const part =
      await req.file();

    if (!part) {
      return {
        success:
          false,
        message:
          'Please select CSV file.',
      };
    }

    const fields: any = {};

    for (const key in part.fields) {
      fields[key] =
        (part.fields as any)[key]?.value;
    }

    const buffer =
      await part.toBuffer();

    return this.service.uploadAnnexureCsv(
      assessmentId,
      categoryId,
      questionId,
      Number(fields.employee_id || 0),
      {
        filename:
          part.filename,
        mimetype:
          part.mimetype,
        buffer,
      },
    );
  }

  @Post(':assessmentId/category/:categoryId/question/:questionId/annexure/:annexureRowId/delete')
  deleteAnnexureRow(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('categoryId', ParseIntPipe)
    categoryId: number,

    @Param('questionId', ParseIntPipe)
    questionId: number,

    @Param('annexureRowId', ParseIntPipe)
    annexureRowId: number,

    @Body()
    body: any,
  ) {

    return this.service.deleteAnnexureRow(
      assessmentId,
      categoryId,
      questionId,
      annexureRowId,
      Number(body?.employee_id || 0),
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
