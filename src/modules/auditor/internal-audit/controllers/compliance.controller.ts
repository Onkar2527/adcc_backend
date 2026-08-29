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
import { ComplianceService } from '../services/compliance.service';
import type { FastifyReply, FastifyRequest } from 'fastify';
import * as fs from 'fs';
import '@fastify/multipart';

/**
 * ComplianceController
 * Handles all routes under: /internal-audit/compliance/*
 */
@Controller('internal-audit')
export class ComplianceController {
  constructor(
    private readonly service: ComplianceService,
  ) { }

  // ─── Pending List ─────────────────────────────────────────────────────────

  @Get('compliance/pending')
  getCompliancePending(
    @Query('employee_id')
    employeeId?: string,

    @Query('live_manager_compliance')
    liveManagerCompliance?: string,
  ) {
    return this.service.getCompliancePending(
      Number(employeeId || 0),
      String(liveManagerCompliance) === 'true',
    );
  }

  // ─── Compliance Assessment ────────────────────────────────────────────────

  @Get('compliance/:assessmentId')
  getComplianceAssessment(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Query('employee_id')
    employeeId?: string,

    @Query('live_manager_compliance')
    liveManagerCompliance?: string,
  ) {
    return this.service.getComplianceAssessment(
      assessmentId,
      Number(employeeId || 0),
      String(liveManagerCompliance) === 'true',
    );
  }

  @Get('compliance/:assessmentId/evidence/:evidenceId/view')
  async viewComplianceEvidence(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('evidenceId', ParseIntPipe)
    evidenceId: number,

    @Query('employee_id')
    employeeId: string,

    @Res()
    reply: FastifyReply,
  ) {
    const evidence =
      await this.service.getComplianceEvidenceFile(
        assessmentId,
        evidenceId,
        Number(employeeId || 0),
      );

    reply.header('Content-Type', evidence.mimetype);
    reply.header(
      'Content-Disposition',
      `inline; filename="${evidence.filename}"`,
    );

    return reply.send(fs.createReadStream(evidence.path));
  }

  @Get('compliance/:assessmentId/compliance-evidence/:evidenceId/view')
  async viewComplianceUploadedEvidence(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('evidenceId', ParseIntPipe)
    evidenceId: number,

    @Query('employee_id')
    employeeId: string,

    @Res()
    reply: FastifyReply,
  ) {
    const evidence =
      await this.service.getComplianceUploadedEvidenceFile(
        assessmentId,
        evidenceId,
        Number(employeeId || 0),
      );

    reply.header('Content-Type', evidence.mimetype);
    reply.header(
      'Content-Disposition',
      `inline; filename="${evidence.filename}"`,
    );

    return reply.send(fs.createReadStream(evidence.path));
  }

  @Post('compliance/:assessmentId/observation/:targetType/:observationId/evidence/upload')
  async uploadComplianceEvidence(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('targetType')
    targetType: string,

    @Param('observationId', ParseIntPipe)
    observationId: number,

    @Req()
    req: FastifyRequest,
  ) {
    const part = await req.file();

    if (!part) {
      return {
        success: false,
        message: 'Please select evidence file.',
      };
    }

    const fields: any = {};

    for (const key in part.fields) {
      fields[key] = (part.fields as any)[key]?.value;
    }

    return this.service.uploadComplianceEvidence(
      assessmentId,
      targetType,
      observationId,
      Number(fields.employee_id || 0),
      {
        filename: part.filename,
        mimetype: part.mimetype,
        buffer: await part.toBuffer(),
      },
    );
  }

  @Post('compliance/:assessmentId/evidence/:evidenceId/delete')
  deleteComplianceEvidence(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('evidenceId', ParseIntPipe)
    evidenceId: number,

    @Body()
    body: any,
  ) {
    return this.service.deleteComplianceEvidence(
      assessmentId,
      evidenceId,
      Number(body?.employee_id || 0),
    );
  }

  @Post('compliance/:assessmentId/observation/:targetType/:observationId/response')
  saveComplianceResponse(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('targetType')
    targetType: string,

    @Param('observationId', ParseIntPipe)
    observationId: number,

    @Body()
    body: any,
  ) {
    return this.service.saveComplianceResponse(
      assessmentId,
      targetType,
      observationId,
      Number(body?.employee_id || 0),
      String(body?.response || ''),
      body?.live_manager_compliance === true
      || String(body?.live_manager_compliance) === 'true',
    );
  }

  @Get('compliance/:assessmentId/submission-preview')
  getComplianceSubmissionPreview(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Query('employee_id')
    employeeId?: string,

    @Query('live_manager_compliance')
    liveManagerCompliance?: string,
  ) {
    return this.service.getComplianceSubmissionPreview(
      assessmentId,
      Number(employeeId || 0),
      String(liveManagerCompliance) === 'true',
    );
  }

  @Post('compliance/:assessmentId/submit')
  submitComplianceAssessment(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Body()
    body: any,
  ) {
    return this.service.submitComplianceAssessment(
      assessmentId,
      Number(body?.employee_id || 0),
      body?.live_manager_compliance === true
      || String(body?.live_manager_compliance) === 'true',
    );
  }

  @Post('compliance/:assessmentId/assign-to-maker')
  assignToMaker(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Body()
    body: any,
  ) {
    return this.service.assignToMaker(
      assessmentId,
      Number(body?.maker_emp_id || 0),
      String(body?.target_type || 'all'),
      Array.isArray(body?.observation_ids) ? body.observation_ids.map(Number) : [],
      Number(body?.employee_id || 0),
    );
  }

  @Post('compliance/:assessmentId/observation/:targetType/:observationId/maker-response')
  saveMakerResponse(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('targetType')
    targetType: string,

    @Param('observationId', ParseIntPipe)
    observationId: number,

    @Body()
    body: any,
  ) {
    return this.service.saveMakerResponse(
      assessmentId,
      targetType,
      observationId,
      Number(body?.employee_id || 0),
      String(body?.comment || ''),
    );
  }

  @Post('compliance/:assessmentId/observation/:targetType/:observationId/return-to-maker')
  returnToMaker(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('targetType')
    targetType: string,

    @Param('observationId', ParseIntPipe)
    observationId: number,

    @Body()
    body: any,
  ) {
    return this.service.returnToMaker(
      assessmentId,
      targetType,
      observationId,
      Number(body?.employee_id || 0),
      String(body?.comment || ''),
    );
  }
}
