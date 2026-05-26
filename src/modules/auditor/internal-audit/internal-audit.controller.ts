import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { InternalAuditService } from './internal-audit.service';
import type { FastifyReply, FastifyRequest } from 'fastify';
import * as fs from 'fs';
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

  @Get(':assessmentId/submission-preview')
  getSubmissionPreview(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Query('employee_id')
    employeeId?: string,
  ) {

    return this.service.getSubmissionPreview(
      assessmentId,
      Number(employeeId || 0),
    );
  }

  @Post(':assessmentId/submit')
  submitAssessment(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Body()
    body: any,
  ) {

    return this.service.submitAssessment(
      assessmentId,
      Number(body?.employee_id || 0),
    );
  }

  @Get(':assessmentId/remarks')
  getRemarks(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Query('employee_id')
    employeeId?: string,
  ) {

    return this.service.getRemarks(
      assessmentId,
      Number(employeeId || 0),
    );
  }

  @Post(':assessmentId/remarks')
  saveRemark(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Body()
    body: any,
  ) {

    return this.service.saveRemark(
      assessmentId,
      Number(body?.employee_id || 0),
      body || {},
    );
  }

  @Post(':assessmentId/remarks/:remarkId/read')
  markRemarkRead(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('remarkId', ParseIntPipe)
    remarkId: number,

    @Body()
    body: any,
  ) {

    return this.service.markRemarkRead(
      assessmentId,
      remarkId,
      Number(body?.employee_id || 0),
    );
  }

  @Post(':assessmentId/remarks/:remarkId/delete')
  deleteRemark(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('remarkId', ParseIntPipe)
    remarkId: number,

    @Body()
    body: any,
  ) {

    return this.service.deleteRemark(
      assessmentId,
      remarkId,
      Number(body?.employee_id || 0),
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

    @Query('dump_id')
    dumpId?: string,
  ) {

    return this.service.getCategory(
      assessmentId,
      categoryId,
      Number(employeeId || 0),
      Number(dumpId || 0),
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
      Number(body?.dump_id || 0),
    );
  }

  @Get(':assessmentId/category/:categoryId/sampling')
  getAccountSampling(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('categoryId', ParseIntPipe)
    categoryId: number,

    @Query('employee_id')
    employeeId?: string,

    @Query('filter_type')
    filterType?: string,

    @Query('primary_value')
    primaryValue?: string,

    @Query('secondary_value')
    secondaryValue?: string,
  ) {

    return this.service.getAccountSampling(
      assessmentId,
      categoryId,
      Number(employeeId || 0),
      Number(filterType || 0),
      primaryValue || '',
      secondaryValue || '',
    );
  }

  @Post(':assessmentId/category/:categoryId/sampling/apply')
  applyAccountSampling(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('categoryId', ParseIntPipe)
    categoryId: number,

    @Body()
    body: any,
  ) {

    return this.service.applyAccountSampling(
      assessmentId,
      categoryId,
      Number(body?.employee_id || 0),
      body?.account_ids || [],
    );
  }

  @Post(':assessmentId/category/:categoryId/account/:dumpId/remove-sampling')
  removeAccountSampling(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('categoryId', ParseIntPipe)
    categoryId: number,

    @Param('dumpId', ParseIntPipe)
    dumpId: number,

    @Body()
    body: any,
  ) {

    return this.service.removeAccountSampling(
      assessmentId,
      categoryId,
      dumpId,
      Number(body?.employee_id || 0),
    );
  }

  @Post(':assessmentId/category/:categoryId/account/:dumpId/complete')
  completeAccountAssessment(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('categoryId', ParseIntPipe)
    categoryId: number,

    @Param('dumpId', ParseIntPipe)
    dumpId: number,

    @Body()
    body: any,
  ) {

    return this.service.completeAccountAssessment(
      assessmentId,
      categoryId,
      dumpId,
      Number(body?.employee_id || 0),
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
      Number(body?.dump_id || 0),
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

    @Query('dump_id')
    dumpId?: string,
  ) {

    return this.service.getAnnexureCsvSample(
      assessmentId,
      categoryId,
      questionId,
      Number(employeeId || 0),
      Number(dumpId || 0),
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
      Number(fields.dump_id || 0),
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
      Number(body?.dump_id || 0),
    );
  }

  @Post(':assessmentId/category/:categoryId/question/:questionId/evidence/upload')
  async uploadQuestionEvidence(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('categoryId', ParseIntPipe)
    categoryId: number,

    @Param('questionId', ParseIntPipe)
    questionId: number,

    @Req()
    req: FastifyRequest,
  ) {

    return this.receiveEvidenceUpload(
      assessmentId,
      categoryId,
      questionId,
      0,
      req,
    );
  }

  @Post(':assessmentId/category/:categoryId/question/:questionId/annexure/:annexureRowId/evidence/upload')
  async uploadAnnexureEvidence(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('categoryId', ParseIntPipe)
    categoryId: number,

    @Param('questionId', ParseIntPipe)
    questionId: number,

    @Param('annexureRowId', ParseIntPipe)
    annexureRowId: number,

    @Req()
    req: FastifyRequest,
  ) {

    return this.receiveEvidenceUpload(
      assessmentId,
      categoryId,
      questionId,
      annexureRowId,
      req,
    );
  }

  @Get(':assessmentId/category/:categoryId/evidence/:evidenceId/view')
  async viewEvidence(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('categoryId', ParseIntPipe)
    categoryId: number,

    @Param('evidenceId', ParseIntPipe)
    evidenceId: number,

    @Query('employee_id')
    employeeId: string,

    @Query('dump_id')
    dumpId: string,

    @Res()
    reply: FastifyReply,
  ) {

    const evidence =
      await this.service.getEvidenceFile(
        assessmentId,
      categoryId,
      evidenceId,
      Number(employeeId || 0),
      Number(dumpId || 0),
    );

    reply.header(
      'Content-Type',
      evidence.mimetype,
    );
    reply.header(
      'Content-Disposition',
      `inline; filename="${evidence.filename}"`,
    );

    return reply.send(
      fs.createReadStream(evidence.path),
    );
  }

  @Post(':assessmentId/category/:categoryId/evidence/:evidenceId/delete')
  deleteEvidence(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('categoryId', ParseIntPipe)
    categoryId: number,

    @Param('evidenceId', ParseIntPipe)
    evidenceId: number,

    @Body()
    body: any,
  ) {

    return this.service.deleteEvidence(
      assessmentId,
      categoryId,
      evidenceId,
      Number(body?.employee_id || 0),
      Number(body?.dump_id || 0),
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

  private async receiveEvidenceUpload(
    assessmentId: number,
    categoryId: number,
    questionId: number,
    annexureRowId: number,
    req: FastifyRequest,
  ) {

    const part =
      await req.file();

    if (!part) {
      return {
        success:
          false,
        message:
          'Please select evidence file.',
      };
    }

    const fields: any = {};

    for (const key in part.fields) {
      fields[key] =
        (part.fields as any)[key]?.value;
    }

    return this.service.uploadEvidence(
      assessmentId,
      categoryId,
      questionId,
      annexureRowId,
      Number(fields.employee_id || 0),
      {
        filename:
          part.filename,
        mimetype:
          part.mimetype,
        buffer:
          await part.toBuffer(),
      },
      Number(fields.dump_id || 0),
    );
  }
}
