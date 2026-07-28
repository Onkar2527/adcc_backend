import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
  ) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  // ─── Layout wrapper (matches layout.php) ─────────────────────────────────

  private buildLayout(title: string, content: string): string {
    const bankName = this.configService.get<string>('BANK_NAME', 'KREDPOOL SOLUTIONS PVT LTD.');
    const year = new Date().getFullYear();
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3577');

    // Replace {{APP_URL}} in the content block
    const resolvedContent = content.replace(/\{\{APP_URL\}\}/g, appUrl);

    return `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f7fafc; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #2d3748;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7fafc; padding: 20px 0;">
                    <tr>
                        <td align="center">
                            <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);">

                                <!-- Header -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #1a365d 0%, #2a4365 100%); padding: 30px; text-align: center;">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">AuditPro Security</h1>
                                        <p style="color: #90cdf4; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">Concurrent &amp; Risk-Based Audit Management System</p>
                                    </td>
                                </tr>

                                <!-- Content -->
                                <tr>
                                    <td style="padding: 40px 30px; line-height: 1.6; font-size: 16px;">
                                        ${resolvedContent}
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: #edf2f7; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                                        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #4a5568;">${bankName}</p>
                                        <p style="margin: 5px 0 0 0; font-size: 12px; color: #718096; line-height: 1.4;">
                                            This is a system-generated email notification from the AuditPro Security Platform.<br>
                                            Please do not reply directly to this email.
                                        </p>
                                        <p style="margin: 15px 0 0 0; font-size: 11px; color: #a0aec0;">
                                            &copy; ${year} AuditPro. All rights reserved.
                                        </p>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>`;
  }

  // ─── Core send helpers ────────────────────────────────────────────────────

  async sendMail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    const fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL', 'lukman@kredpool.com');
    const fromName = this.configService.get<string>('SMTP_FROM_NAME', 'AuditPro Security');

    try {
      this.logger.log(`[EmailService] Sending email to "${to}" — ${subject}`);
      const info = await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        text,
        html: html || text,
      });
      this.logger.log(`[EmailService] Sent! Message ID: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`[EmailService] Failed to send to "${to}": ${error.message}`);
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  private async sendHtmlEmail(recipients: string[], subject: string, html: string) {
    if (!recipients.length) {
      this.logger.warn(`No recipients for "${subject}". Email not sent.`);
      return;
    }

    const testRecipient = (this.configService.get<string>('TEST_EMAIL_RECIPIENT') || '').trim();
    const finalRecipients = testRecipient ? [testRecipient] : Array.from(new Set(recipients));

    for (const email of finalRecipients) {
      this.sendMail(email, subject, subject, html).catch((err) => {
        this.logger.error(`Failed workflow email to ${email} for "${subject}": ${err.message}`);
      });
    }
  }

  // ─── DB helpers ───────────────────────────────────────────────────────────

  private formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return dateStr; }
  }

  private formatPeriod(from: string | null, to: string | null): string {
    if (!from && !to) return '-';
    return `${this.formatDate(from)} – ${this.formatDate(to)}`;
  }

  private async getWorkflowRecipientsAndDetails(assessmentId: number) {
    const assessment = await this.db.findOne(`
      SELECT
        aam.id,
        aam.audit_unit_id,
        aam.audit_status_id,
        aam.assesment_period_from,
        aam.assesment_period_to,
        aam.audit_start_date,
        aam.audit_due_date,
        aam.audit_head_id AS auditor_id,
        aam.branch_head_id AS manager_id,
        aum.name AS branch_name,
        aum.audit_unit_code,
        ym.year AS financial_year,
        aud.name AS auditor_name,
        aud.email AS auditor_email,
        mgr.email AS manager_email,
        mgr.name AS manager_name
      FROM audit_assesment_master aam
      INNER JOIN audit_unit_master aum ON aam.audit_unit_id = aum.id
      LEFT JOIN year_master ym ON aam.year_id = ym.id
      LEFT JOIN employee_master aud ON aam.audit_head_id = aud.id
      LEFT JOIN employee_master mgr ON aam.branch_head_id = mgr.id
      WHERE aam.id = $1 AND aam.deleted_at IS NULL
    `, [assessmentId]);

    if (!assessment) {
      this.logger.warn(`No assessment found for ID ${assessmentId}.`);
      return null;
    }

    const reviewersRes = await this.db.query(`
      SELECT id, email, name FROM employee_master
      WHERE user_type_id = 4
        AND deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM unnest(string_to_array(COALESCE(audit_unit_authority, ''), ',')) unit_id
          WHERE trim(unit_id) = $1::text
        )
    `, [assessment.audit_unit_id]);

    const reviewerEmails = reviewersRes.rows.map((r: any) => r.email).filter(Boolean);
    const reviewerNames = reviewersRes.rows.map((r: any) => r.name).join(', ') || 'Reviewer';
    const reviewerIds = reviewersRes.rows.map((r: any) => Number(r.id)).filter(Boolean);

    return {
      assessment,
      managerEmail: assessment.manager_email,
      managerName: assessment.manager_name || 'Branch Manager',
      managerId: Number(assessment.manager_id || 0),
      auditorEmail: assessment.auditor_email,
      auditorName: assessment.auditor_name || 'Auditor',
      auditorId: Number(assessment.auditor_id || 0),
      reviewerEmails,
      reviewerNames,
      reviewerIds,
      period: this.formatPeriod(assessment.assesment_period_from, assessment.assesment_period_to),
      dueDate: this.formatDate(assessment.audit_due_date),
      startDate: this.formatDate(assessment.audit_start_date),
      today: this.formatDate(new Date().toISOString()),
    };
  }

  private async getTopLevelEmails(): Promise<string[]> {
    try {
      const res = await this.db.query(`
        SELECT email FROM employee_master
        WHERE user_type_id = 5
          AND deleted_at IS NULL
      `);
      return res.rows.map((r: any) => r.email).filter(Boolean);
    } catch (err) {
      this.logger.error(`Error fetching top level emails: ${err.message}`);
      return [];
    }
  }

  private async getTopLevelUserIds(): Promise<number[]> {
    try {
      const res = await this.db.query(`
        SELECT id FROM employee_master
        WHERE user_type_id = 5
          AND deleted_at IS NULL
      `);
      return res.rows.map((r: any) => Number(r.id)).filter(Boolean);
    } catch (err) {
      this.logger.error(`Error fetching top level user IDs: ${err.message}`);
      return [];
    }
  }

  private async createInternalNotification(userIds: number[], title: string, message: string) {
    if (!userIds || !userIds.length) return;
    const uniqueUserIds = Array.from(new Set(userIds)).filter(Boolean);
    for (const userId of uniqueUserIds) {
      try {
        await this.db.query(
          `
          INSERT INTO user_notifications (user_id, title, message, is_read, created_at)
          VALUES ($1, $2, $3, FALSE, CURRENT_TIMESTAMP);
          `,
          [userId, title.trim(), message.trim()],
        );
      } catch (err) {
        this.logger.error(`Failed to create internal notification for user ${userId}: ${err.message}`);
      }
    }
  }

  private async getRejectedCount(assessmentId: number): Promise<number> {
    // compliance_status_id = 3 means "Re-Compliance Needed" / rejected by reviewer
    const res = await this.db.findOne(`
      SELECT (
        (SELECT COUNT(*) FROM answers_data
         WHERE assesment_id = $1 AND is_compliance = 1
           AND compliance_status_id = 3 AND deleted_at IS NULL)
        +
        (SELECT COUNT(*) FROM answers_data_annexure aa
         WHERE aa.assesment_id = $1 AND aa.compliance_status_id = 3
           AND aa.deleted_at IS NULL
           AND EXISTS (
             SELECT 1 FROM answers_data ad
             WHERE ad.id = aa.answer_id AND ad.assesment_id = aa.assesment_id
               AND ad.is_compliance = 1 AND ad.deleted_at IS NULL
           ))
      )::int AS count
    `, [assessmentId]);
    return Number(res?.count || 0);
  }

  // ─── Status 1: Audit Started ──────────────────────────────────────────────

  async sendAuditStartedEmail(assessmentId: number) {
    try {
      const data = await this.getWorkflowRecipientsAndDetails(assessmentId);
      if (!data) return;
      const { assessment, managerEmail, reviewerEmails, reviewerNames, period, dueDate } = data;

      const subject = `[AuditPro] Audit Assessment Started – ${assessment.branch_name}`;
      const content = `
        <h2 style="color: #2b6cb0; margin-top: 0; font-size: 20px; font-weight: 600;">Audit Assessment Started</h2>
        <p>Dear Team,</p>
        <p>This is to inform you that a new audit assessment has been initiated for <strong>${assessment.branch_name}</strong>.</p>

        <table border="0" cellpadding="8" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 20px 0; background-color: #f8fafc; border-left: 4px solid #3182ce;">
          <tr><td width="35%" style="font-weight: 600; color: #4a5568;">Branch Name:</td><td style="color: #2d3748;">${assessment.branch_name} (${assessment.audit_unit_code})</td></tr>
          <tr><td style="font-weight: 600; color: #4a5568;">Assessment Period:</td><td style="color: #2d3748;">${period}</td></tr>
          <tr><td style="font-weight: 600; color: #4a5568;">Allocated Reviewer:</td><td style="color: #2d3748;">${reviewerNames}</td></tr>
          <tr><td style="font-weight: 600; color: #4a5568;">Auditor Name:</td><td style="color: #2d3748;">${assessment.auditor_name || '-'}</td></tr>
          <tr><td style="font-weight: 600; color: #4a5568;">Audit Due Date:</td><td style="color: #e53e3e; font-weight: 600;">${dueDate}</td></tr>
        </table>

        <p>Please ensure all records and documentation are kept up-to-date and available for the audit process.</p>
        <p>You can access the audit panel and check detailed guidelines by clicking the link below:</p>

        <p style="text-align: center; margin-top: 30px;">
          <a href="{{APP_URL}}" style="background-color: #3182ce; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(49, 130, 206, 0.3);">Go to Audit Portal</a>
        </p>

        <p style="margin-top: 30px;">Best regards,<br><strong>AuditPro Team</strong></p>`;

      const recipients = [managerEmail, ...reviewerEmails].filter(Boolean);
      await this.sendHtmlEmail(recipients, subject, this.buildLayout(subject, content));

      // Internal Notification
      const internalRecipients = [data.managerId, ...data.reviewerIds].filter(Boolean);
      const notificationMsg = `A new audit assessment has been initiated for ${assessment.branch_name} (${assessment.audit_unit_code}) for the period ${period}. Due date is ${dueDate}.`;
      await this.createInternalNotification(internalRecipients, subject, notificationMsg);
    } catch (err) {
      this.logger.error(`Error in sendAuditStartedEmail: ${err.message}`);
    }
  }

  // ─── Status 2: Audit Submitted (Under Review) ─────────────────────────────

  async sendAuditSubmittedEmail(assessmentId: number, isLiveFlow: boolean, targetStatus: number = 2) {
    try {
      const data = await this.getWorkflowRecipientsAndDetails(assessmentId);
      if (!data) return;
      const { assessment, managerEmail, reviewerEmails, reviewerNames, period, today } = data;

      const isSubmittingToReviewer = isLiveFlow && targetStatus === 5;
      
      let subject, title, introText, reviewerRow, nextStepsText, buttonText, recipients, greeting;

      if (isSubmittingToReviewer) {
        subject = `[AuditPro] Live Compliance Verification Completed – ${assessment.branch_name}`;
        title = `Live Compliance Verification Completed`;
        greeting = `Dear Reviewer,`;
        introText = `The auditor has completed the live compliance verification for <strong>${assessment.branch_name}</strong>. The assessment has now transitioned to the <strong>Review Stage</strong>.`;
        reviewerRow = ``;
        nextStepsText = `<p>Please log in to the portal to review the compliance observations and take necessary action.</p>`;
        buttonText = `Review Compliance`;
        recipients = reviewerEmails;
      } else {
        subject = isLiveFlow 
          ? `[AuditPro] Action Required: Start Compliance – ${assessment.branch_name}`
          : `[AuditPro] Audit Completed & Under Review – ${assessment.branch_name}`;
          
        title = isLiveFlow
          ? `Action Required: Start Compliance`
          : `Audit Completed &amp; Under Review`;
          
        greeting = `Dear Branch Manager,`;

        introText = isLiveFlow
          ? `The auditor has completed the audit assessment phase for <strong>${assessment.branch_name}</strong>. The assessment has now transitioned to the <strong>Manager Compliance Stage</strong>.`
          : `The auditor has completed the audit assessment phase for <strong>${assessment.branch_name}</strong>. The assessment has now transitioned to the <strong>Review Stage</strong>.`;
          
        reviewerRow = isLiveFlow
          ? ''
          : `<tr><td style="font-weight: 600; color: #4a5568;">Reviewer Name:</td><td style="color: #2d3748;">${reviewerNames}</td></tr>`;
          
        nextStepsText = isLiveFlow
          ? `<p>Please log in to the portal and submit the necessary compliance evidence and explanations for the audit observations.</p>`
          : `<p>The reviewer will inspect the observations recorded by the auditor. You will be notified once the review is completed and compliance is initiated.</p>`;
          
        buttonText = isLiveFlow
          ? `Start Compliance`
          : `Monitor Status`;

        recipients = isLiveFlow ? [managerEmail].filter(Boolean) : [managerEmail, ...reviewerEmails].filter(Boolean);
      }

      const content = `
        <h2 style="color: #2b6cb0; margin-top: 0; font-size: 20px; font-weight: 600;">${title}</h2>
        <p>${greeting}</p>
        <p>${introText}</p>

        <table border="0" cellpadding="8" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 20px 0; background-color: #f8fafc; border-left: 4px solid #3182ce;">
          <tr><td width="35%" style="font-weight: 600; color: #4a5568;">Branch Name:</td><td style="color: #2d3748;">${assessment.branch_name} (${assessment.audit_unit_code})</td></tr>
          <tr><td style="font-weight: 600; color: #4a5568;">Assessment Period:</td><td style="color: #2d3748;">${period}</td></tr>
          ${reviewerRow}
          <tr><td style="font-weight: 600; color: #4a5568;">Completion Date:</td><td style="color: #2d3748;">${today}</td></tr>
        </table>

        ${nextStepsText}
        <p>You can monitor the status on the portal:</p>

        <p style="text-align: center; margin-top: 30px;">
          <a href="{{APP_URL}}" style="background-color: #3182ce; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(49, 130, 206, 0.3);">${buttonText}</a>
        </p>

        <p style="margin-top: 30px;">Best regards,<br><strong>AuditPro Team</strong></p>`;

      await this.sendHtmlEmail(recipients, subject, this.buildLayout(subject, content));

      // Internal Notification
      const internalRecipients = isSubmittingToReviewer 
        ? data.reviewerIds 
        : (isLiveFlow ? [data.managerId].filter(Boolean) : [data.managerId, ...data.reviewerIds].filter(Boolean));
      
      const notificationMsg = isSubmittingToReviewer
        ? `The auditor has completed the live compliance verification for ${assessment.branch_name}. The assessment has transitioned to the Review Stage.`
        : (isLiveFlow 
            ? `The auditor has completed the audit assessment phase for ${assessment.branch_name}. The assessment has transitioned to the Manager Compliance Stage.`
            : `The auditor has completed the audit assessment phase for ${assessment.branch_name}. The assessment has transitioned to the Review Stage.`);
            
      await this.createInternalNotification(internalRecipients, subject, notificationMsg);
    } catch (err) {
      this.logger.error(`Error in sendAuditSubmittedEmail: ${err.message}`);
    }
  }

  // ─── Status 3 / 4 / 7 via Review Completed ───────────────────────────────

  async sendReviewCompletedEmail(assessmentId: number, nextStatus: number) {
    try {
      const data = await this.getWorkflowRecipientsAndDetails(assessmentId);
      if (!data) return;
      const { assessment, managerEmail, auditorEmail, reviewerEmails, reviewerNames, period, today, startDate, dueDate } = data;

      let subject = '';
      let html = '';
      let recipients: string[] = [];

      if (nextStatus === 3) {
        // Status 3 – Re-Audit Needed (sent to Auditor + team)
        const rejectedCount = await this.getRejectedCount(assessmentId);
        subject = `[AuditPro] Action Required: Re-Audit Needed – ${assessment.branch_name}`;
        const content = `
          <h2 style="color: #dd6b20; margin-top: 0; font-size: 20px; font-weight: 600;">Action Required: Re-Audit Needed</h2>
          <p>Dear Auditor,</p>
          <p>The reviewer has evaluated the audit assessment for <strong>${assessment.branch_name}</strong> and requested a <strong>Re-Audit / Re-Assessment</strong> on certain observations.</p>

          <table border="0" cellpadding="8" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 20px 0; background-color: #fffaf0; border-left: 4px solid #dd6b20;">
            <tr><td width="35%" style="font-weight: 600; color: #7b341e;">Branch Name:</td><td style="color: #2d3748;">${assessment.branch_name}</td></tr>
            <tr><td style="font-weight: 600; color: #7b341e;">Assessment Period:</td><td style="color: #2d3748;">${period}</td></tr>
            <tr><td style="font-weight: 600; color: #7b341e;">Reviewer Name:</td><td style="color: #2d3748;">${reviewerNames}</td></tr>
            <tr><td style="font-weight: 600; color: #7b341e;">Rejected Observations Count:</td><td style="color: #e53e3e; font-weight: bold;">${rejectedCount}</td></tr>
          </table>

          <p>Please review the comments left by the reviewer and update the assessment responses accordingly.</p>
          <p>Click the link below to view the rejected points and re-submit the audit:</p>

          <p style="text-align: center; margin-top: 30px;">
            <a href="{{APP_URL}}" style="background-color: #dd6b20; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(221, 107, 32, 0.3);">Start Re-Audit</a>
          </p>

          <p style="margin-top: 30px;">Best regards,<br><strong>AuditPro Team</strong></p>`;
        html = this.buildLayout(subject, content);
        recipients = [auditorEmail, ...reviewerEmails].filter(Boolean);

      } else if (nextStatus === 4) {
        // Status 4 – Action Required: Start Compliance (sent to Manager)
        subject = `[AuditPro] Action Required: Start Compliance – ${assessment.branch_name}`;
        const content = `
          <h2 style="color: #2b6cb0; margin-top: 0; font-size: 20px; font-weight: 600;">Action Required: Start Compliance</h2>
          <p>Dear Branch Manager,</p>
          <p>The audit review for <strong>${assessment.branch_name}</strong> is complete. You are requested to <strong>Start Compliance</strong> on the accepted audit observations.</p>

          <table border="0" cellpadding="8" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 20px 0; background-color: #f8fafc; border-left: 4px solid #3182ce;">
            <tr><td width="35%" style="font-weight: 600; color: #4a5568;">Branch Name:</td><td style="color: #2d3748;">${assessment.branch_name}</td></tr>
            <tr><td style="font-weight: 600; color: #4a5568;">Assessment Period:</td><td style="color: #2d3748;">${period}</td></tr>
            <tr><td style="font-weight: 600; color: #4a5568;">Compliance Start Date:</td><td style="color: #2d3748;">${startDate}</td></tr>
            <tr><td style="font-weight: 600; color: #4a5568;">Compliance Due Date:</td><td style="color: #e53e3e; font-weight: 600;">${dueDate}</td></tr>
          </table>

          <p>Please log in to the portal and submit the necessary compliance evidence and explanations for each observation.</p>
          <p>Click below to open the compliance dashboard:</p>

          <p style="text-align: center; margin-top: 30px;">
            <a href="{{APP_URL}}" style="background-color: #3182ce; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(49, 130, 206, 0.3);">Start Compliance Response</a>
          </p>

          <p style="margin-top: 30px;">Best regards,<br><strong>AuditPro Team</strong></p>`;
        html = this.buildLayout(subject, content);
        recipients = [managerEmail, ...reviewerEmails].filter(Boolean);

      } else if (nextStatus === 7) {
        // Status 7 – Audit Completed (no compliance needed)
        subject = `[AuditPro] Audit Assessment Completed – ${assessment.branch_name}`;
        const content = `
          <h2 style="color: #38a169; margin-top: 0; font-size: 20px; font-weight: 600;">Audit Assessment Completed Successfully</h2>
          <p>Dear Team,</p>
          <p>We are pleased to inform you that the audit and compliance verification process for <strong>${assessment.branch_name}</strong> has been <strong>Completed Successfully</strong>.</p>

          <table border="0" cellpadding="8" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 20px 0; background-color: #f0fff4; border-left: 4px solid #38a169;">
            <tr><td width="35%" style="font-weight: 600; color: #276749;">Branch Name:</td><td style="color: #2d3748;">${assessment.branch_name}</td></tr>
            <tr><td style="font-weight: 600; color: #276749;">Assessment Period:</td><td style="color: #2d3748;">${period}</td></tr>
            <tr><td style="font-weight: 600; color: #276749;">Auditor Name:</td><td style="color: #2d3748;">${assessment.auditor_name || '-'}</td></tr>
            <tr><td style="font-weight: 600; color: #276749;">Reviewer Name:</td><td style="color: #2d3748;">${reviewerNames}</td></tr>
            <tr><td style="font-weight: 600; color: #276749;">Completion Date:</td><td style="color: #276749; font-weight: 600;">${today}</td></tr>
          </table>

          <p>The audit assessment details, final ratings, and compliance reports are archived and accessible via the portal below:</p>

          <p style="text-align: center; margin-top: 30px;">
            <a href="{{APP_URL}}" style="background-color: #38a169; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(56, 161, 105, 0.3);">View Audit Report</a>
          </p>

          <p style="margin-top: 30px;">Best regards,<br><strong>AuditPro Team</strong></p>`;
        html = this.buildLayout(subject, content);
        const topLevelEmails = await this.getTopLevelEmails();
        recipients = [managerEmail, auditorEmail, ...reviewerEmails, ...topLevelEmails].filter(Boolean);

      } else {
        return;
      }

      await this.sendHtmlEmail(recipients, subject, html);

      // Internal Notification
      let internalRecipients: number[] = [];
      let notificationMsg = '';
      if (nextStatus === 3) {
        const rejectedCount = await this.getRejectedCount(assessmentId);
        internalRecipients = [data.auditorId, ...data.reviewerIds].filter(Boolean);
        notificationMsg = `The reviewer has evaluated the audit assessment for ${assessment.branch_name} and requested a Re-Audit / Re-Assessment on certain observations. Rejected observations: ${rejectedCount}.`;
      } else if (nextStatus === 4) {
        internalRecipients = [data.managerId, ...data.reviewerIds].filter(Boolean);
        notificationMsg = `The audit review for ${assessment.branch_name} is complete. You are requested to Start Compliance on the accepted audit observations. Due date is ${dueDate}.`;
      } else if (nextStatus === 7) {
        const topLevelUserIds = await this.getTopLevelUserIds();
        internalRecipients = [data.managerId, data.auditorId, ...data.reviewerIds, ...topLevelUserIds].filter(Boolean);
        notificationMsg = `The audit and compliance verification process for ${assessment.branch_name} has been Completed Successfully.`;
      }
      await this.createInternalNotification(internalRecipients, subject, notificationMsg);
    } catch (err) {
      this.logger.error(`Error in sendReviewCompletedEmail: ${err.message}`);
    }
  }

  // ─── Status 5: Compliance Submitted for Review ────────────────────────────

  async sendComplianceSubmittedEmail(assessmentId: number) {
    try {
      const data = await this.getWorkflowRecipientsAndDetails(assessmentId);
      if (!data) return;
      const { assessment, managerEmail, managerName, reviewerEmails, auditorEmail, period, today } = data;

      const isLiveFlowSubmitToAuditor = Number(assessment.audit_status_id) === 1;

      let subject, recipientName, introText, buttonText, recipients;

      if (isLiveFlowSubmitToAuditor) {
        subject = `[AuditPro] Compliance Submitted for Auditor Verification – ${assessment.branch_name}`;
        recipientName = `Auditor`;
        introText = `The branch compliance submission for <strong>${assessment.branch_name}</strong> is now complete and has been sent for your <strong>Verification</strong>.`;
        buttonText = `Verify Compliance`;
        recipients = [auditorEmail].filter(Boolean);
      } else {
        subject = `[AuditPro] Compliance Submitted for Review – ${assessment.branch_name}`;
        recipientName = `Reviewer`;
        introText = `The branch compliance submission for <strong>${assessment.branch_name}</strong> is now complete and has been sent for your <strong>Review &amp; Verification</strong>.`;
        buttonText = `Review Compliance`;
        recipients = [managerEmail, ...reviewerEmails].filter(Boolean);
      }

      const content = `
        <h2 style="color: #2b6cb0; margin-top: 0; font-size: 20px; font-weight: 600;">${isLiveFlowSubmitToAuditor ? 'Compliance Submitted for Verification' : 'Compliance Submitted for Review'}</h2>
        <p>Dear ${recipientName},</p>
        <p>${introText}</p>

        <table border="0" cellpadding="8" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 20px 0; background-color: #f8fafc; border-left: 4px solid #3182ce;">
          <tr><td width="35%" style="font-weight: 600; color: #4a5568;">Branch Name:</td><td style="color: #2d3748;">${assessment.branch_name}</td></tr>
          <tr><td style="font-weight: 600; color: #4a5568;">Assessment Period:</td><td style="color: #2d3748;">${period}</td></tr>
          <tr><td style="font-weight: 600; color: #4a5568;">Compliance User:</td><td style="color: #2d3748;">${managerName}</td></tr>
          <tr><td style="font-weight: 600; color: #4a5568;">Submission Date:</td><td style="color: #2d3748;">${today}</td></tr>
        </table>

        <p>Please review the compliance notes and verification evidence on the portal and mark them as Accepted or Re-Compliance needed.</p>
        <p>Click below to begin compliance verification:</p>

        <p style="text-align: center; margin-top: 30px;">
          <a href="{{APP_URL}}" style="background-color: #3182ce; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(49, 130, 206, 0.3);">${buttonText}</a>
        </p>

        <p style="margin-top: 30px;">Best regards,<br><strong>AuditPro Team</strong></p>`;

      await this.sendHtmlEmail(recipients, subject, this.buildLayout(subject, content));

      // Internal Notification
      const internalRecipients = isLiveFlowSubmitToAuditor 
        ? [data.auditorId].filter(Boolean)
        : [data.managerId, ...data.reviewerIds].filter(Boolean);

      const notificationMsg = isLiveFlowSubmitToAuditor
        ? `The branch compliance submission for ${assessment.branch_name} is complete and has been sent for your verification.`
        : `The branch compliance submission for ${assessment.branch_name} is complete and has been sent for Review & Verification.`;

      await this.createInternalNotification(internalRecipients, subject, notificationMsg);
    } catch (err) {
      this.logger.error(`Error in sendComplianceSubmittedEmail: ${err.message}`);
    }
  }

  // ─── Status 6 / 7 via Compliance Review Completed ─────────────────────────

  async sendComplianceReviewCompletedEmail(assessmentId: number, nextStatus: number) {
    try {
      const data = await this.getWorkflowRecipientsAndDetails(assessmentId);
      if (!data) return;
      const { assessment, managerEmail, auditorEmail, reviewerEmails, reviewerNames, period, today } = data;

      let subject = '';
      let html = '';
      let recipients: string[] = [];

      if (nextStatus === 6) {
        // Status 6 – Re-Compliance Needed
        const rejectedCount = await this.getRejectedCount(assessmentId);
        subject = `[AuditPro] Action Required: Re-Compliance Needed – ${assessment.branch_name}`;
        const content = `
          <h2 style="color: #dd6b20; margin-top: 0; font-size: 20px; font-weight: 600;">Action Required: Re-Compliance Needed</h2>
          <p>Dear Branch Manager,</p>
          <p>The reviewer has evaluated the compliance submission for <strong>${assessment.branch_name}</strong> and requested <strong>Re-Compliance</strong> for some rejected observations.</p>

          <table border="0" cellpadding="8" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 20px 0; background-color: #fffaf0; border-left: 4px solid #dd6b20;">
            <tr><td width="35%" style="font-weight: 600; color: #7b341e;">Branch Name:</td><td style="color: #2d3748;">${assessment.branch_name}</td></tr>
            <tr><td style="font-weight: 600; color: #7b341e;">Assessment Period:</td><td style="color: #2d3748;">${period}</td></tr>
            <tr><td style="font-weight: 600; color: #7b341e;">Reviewer Name:</td><td style="color: #2d3748;">${reviewerNames}</td></tr>
            <tr><td style="font-weight: 600; color: #7b341e;">Rejected Compliance Count:</td><td style="color: #e53e3e; font-weight: bold;">${rejectedCount}</td></tr>
          </table>

          <p>Please review the remarks from the reviewer, correct the compliance responses, upload any necessary evidence, and re-submit for review.</p>
          <p>Click below to open the re-compliance portal:</p>

          <p style="text-align: center; margin-top: 30px;">
            <a href="{{APP_URL}}" style="background-color: #dd6b20; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(221, 107, 32, 0.3);">Submit Re-Compliance</a>
          </p>

          <p style="margin-top: 30px;">Best regards,<br><strong>AuditPro Team</strong></p>`;
        html = this.buildLayout(subject, content);
        recipients = [managerEmail, ...reviewerEmails].filter(Boolean);

      } else if (nextStatus === 7) {
        // Status 7 – Audit Fully Completed
        subject = `[AuditPro] Audit Assessment Completed – ${assessment.branch_name}`;
        const content = `
          <h2 style="color: #38a169; margin-top: 0; font-size: 20px; font-weight: 600;">Audit Assessment Completed Successfully</h2>
          <p>Dear Team,</p>
          <p>We are pleased to inform you that the audit and compliance verification process for <strong>${assessment.branch_name}</strong> has been <strong>Completed Successfully</strong>.</p>

          <table border="0" cellpadding="8" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 20px 0; background-color: #f0fff4; border-left: 4px solid #38a169;">
            <tr><td width="35%" style="font-weight: 600; color: #276749;">Branch Name:</td><td style="color: #2d3748;">${assessment.branch_name}</td></tr>
            <tr><td style="font-weight: 600; color: #276749;">Assessment Period:</td><td style="color: #2d3748;">${period}</td></tr>
            <tr><td style="font-weight: 600; color: #276749;">Auditor Name:</td><td style="color: #2d3748;">${assessment.auditor_name || '-'}</td></tr>
            <tr><td style="font-weight: 600; color: #276749;">Reviewer Name:</td><td style="color: #2d3748;">${reviewerNames}</td></tr>
            <tr><td style="font-weight: 600; color: #276749;">Completion Date:</td><td style="color: #276749; font-weight: 600;">${today}</td></tr>
          </table>

          <p>The audit assessment details, final ratings, and compliance reports are archived and accessible via the portal below:</p>

          <p style="text-align: center; margin-top: 30px;">
            <a href="{{APP_URL}}" style="background-color: #38a169; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; box-shadow: 0 2px 4px rgba(56, 161, 105, 0.3);">View Audit Report</a>
          </p>

          <p style="margin-top: 30px;">Best regards,<br><strong>AuditPro Team</strong></p>`;
        html = this.buildLayout(subject, content);
        const topLevelEmails = await this.getTopLevelEmails();
        recipients = [managerEmail, auditorEmail, ...reviewerEmails, ...topLevelEmails].filter(Boolean);

      } else {
        return;
      }

      await this.sendHtmlEmail(recipients, subject, html);

      // Internal Notification
      let internalRecipients: number[] = [];
      let notificationMsg = '';
      if (nextStatus === 6) {
        const rejectedCount = await this.getRejectedCount(assessmentId);
        internalRecipients = [data.managerId, ...data.reviewerIds].filter(Boolean);
        notificationMsg = `The reviewer has evaluated the compliance submission for ${assessment.branch_name} and requested Re-Compliance for some observations. Rejected count: ${rejectedCount}.`;
      } else if (nextStatus === 7) {
        const topLevelUserIds = await this.getTopLevelUserIds();
        internalRecipients = [data.managerId, data.auditorId, ...data.reviewerIds, ...topLevelUserIds].filter(Boolean);
        notificationMsg = `The audit and compliance verification process for ${assessment.branch_name} has been Completed Successfully.`;
      }
      await this.createInternalNotification(internalRecipients, subject, notificationMsg);
    } catch (err) {
      this.logger.error(`Error in sendComplianceReviewCompletedEmail: ${err.message}`);
    }
  }
}
