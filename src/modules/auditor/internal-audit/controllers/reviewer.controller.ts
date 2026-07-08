import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ReviewerService } from '../services/reviewer.service';
import type { FastifyReply } from 'fastify';
import * as fs from 'fs';

/**
 * ReviewerController
 * Handles all routes under: /internal-audit/reviewer/*
 */
@Controller('internal-audit')
export class ReviewerController {
  constructor(
    private readonly service: ReviewerService,
  ) { }

  // ─── Reviewer Compliance (live-manager-compliance) ────────────────────────

  @Get('reviewer/compliance/:assessmentId')
  getReviewerComplianceAssessment(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Query('employee_id')
    employeeId?: string,

    @Query('live_manager_compliance')
    liveManagerCompliance?: string,
  ) {
    return this.service.getReviewerComplianceAssessment(
      assessmentId,
      Number(employeeId || 0),
      String(liveManagerCompliance) === 'true',
    );
  }

  @Get('reviewer/compliance/:assessmentId/evidence/:evidenceId/view')
  async viewReviewerComplianceEvidence(
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
      await this.service.getReviewerComplianceEvidenceFile(
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

  @Post('reviewer/compliance/:assessmentId/observation/:targetType/:observationId/action')
  saveReviewerComplianceAction(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('targetType')
    targetType: string,

    @Param('observationId', ParseIntPipe)
    observationId: number,

    @Body()
    body: any,
  ) {
    return this.service.saveReviewerComplianceAction(
      assessmentId,
      targetType,
      observationId,
      Number(body?.employee_id || 0),
      Number(body?.action || 0),
      String(body?.comment || ''),
      body?.live_manager_compliance === true
      || String(body?.live_manager_compliance) === 'true',
    );
  }

  @Post('reviewer/compliance/:assessmentId/submit')
  submitReviewerComplianceAssessment(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Body()
    body: any,
  ) {
    return this.service.submitReviewerComplianceAssessment(
      assessmentId,
      Number(body?.employee_id || 0),
      body?.live_manager_compliance === true
      || String(body?.live_manager_compliance) === 'true',
    );
  }

  // ─── Reviewer Pending ─────────────────────────────────────────────────────

  @Get('reviewer/pending')
  getReviewerPending(
    @Query('employee_id')
    employeeId?: string,

    @Query('live_manager_compliance')
    liveManagerCompliance?: string,
  ) {
    return this.service.getReviewerPending(
      Number(employeeId || 0),
      String(liveManagerCompliance) === 'true',
    );
  }

  // ─── Reviewer Assessment ──────────────────────────────────────────────────

  @Get('reviewer/:assessmentId')
  getReviewerAssessment(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Query('employee_id')
    employeeId?: string,
  ) {
    return this.service.getReviewerAssessment(
      assessmentId,
      Number(employeeId || 0),
    );
  }

  @Get('reviewer/:assessmentId/evidence/:evidenceId/view')
  async viewReviewerEvidence(
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
      await this.service.getReviewerEvidenceFile(
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

  @Post('reviewer/:assessmentId/observation/:targetType/:observationId/action')
  saveReviewerAction(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Param('targetType')
    targetType: string,

    @Param('observationId', ParseIntPipe)
    observationId: number,

    @Body()
    body: any,
  ) {
    return this.service.saveReviewerAction(
      assessmentId,
      targetType,
      observationId,
      Number(body?.employee_id || 0),
      Number(body?.action || 0),
      String(body?.comment || ''),
    );
  }

  @Post('reviewer/:assessmentId/submit')
  submitReviewerAssessment(
    @Param('assessmentId', ParseIntPipe)
    assessmentId: number,

    @Body()
    body: any,
  ) {
    return this.service.submitReviewerAssessment(
      assessmentId,
      Number(body?.employee_id || 0),
    );
  }
}
