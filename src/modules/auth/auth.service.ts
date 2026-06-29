import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { EmailService } from '../../core/email/email.service';
import { DatabaseService } from '../../core/database/database.service';
import { PasswordPolicyService } from '../admin/password-policy/password-policy.service';

@Injectable()
export class AuthService {
  private readonly otpStore = new Map<
    string,
    { code: string; expires: number }
  >();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
    private readonly emailService: EmailService,
    private readonly db: DatabaseService,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findByUsername(username);

    if (!user) return null;

    let isValid = false;

    if (
      user.password &&
      (user.password.startsWith('$2a$') ||
        user.password.startsWith('$2b$') ||
        user.password.startsWith('$2y$'))
    ) {
      isValid = await bcrypt.compare(pass, user.password);
    } else {
      isValid = pass === user.password;
    }

    if (!isValid) return null;

    const { password, ...result } = user;
    return result;
  }

  async login(
    username: string,
    pass: string,
    ipAddress?: string,
    enable2fa?: boolean,
  ) {
    console.log(
      `[AuthService] Login attempt for user: "${username}", enable2fa: ${enable2fa}`,
    );
    const user = await this.validateUser(username, pass);
    if (!user) {
      console.warn(`[AuthService] Invalid credentials for user: "${username}"`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (enable2fa) {
      const email = user.email;
      console.log(
        `[AuthService] User found. Email registered in DB: "${email}"`,
      );
      if (!email) {
        console.warn(
          `[AuthService] Login failed: No email set for user: "${username}"`,
        );
        throw new UnauthorizedException(
          'No email address registered for this account',
        );
      }

      // Generate 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 5 * 60 * 1000; // 5 minutes expiration
      this.otpStore.set(username, { code, expires });
      console.log(
        `[AuthService] Generated 2FA verification code: "${code}" for user: "${username}". Expires at: ${new Date(expires).toLocaleTimeString()}`,
      );

      // Send the email
      console.log(`[AuthService] Dispatching 2FA email to: "${email}"`);
      const mailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #333;">AuditPro Security Verification</h2>
          <p>You are attempting to log in to AuditPro. Use the following verification code to complete your sign-in:</p>
          <div style="font-size: 24px; font-weight: bold; background-color: #f7f7f7; padding: 10px 20px; border-radius: 4px; display: inline-block; letter-spacing: 2px; color: #4F46E5;">
            ${code}
          </div>
          <p style="margin-top: 20px; color: #666; font-size: 12px;">This code will expire in 5 minutes. If you did not request this code, please secure your account immediately.</p>
        </div>
      `;
      await this.emailService.sendMail(
        email,
        'Your 2FA Verification Code',
        `Your verification code is: ${code}. It will expire in 5 minutes.`,
        mailHtml,
      );
      console.log(`[AuthService] 2FA email dispatched successfully.`);

      return {
        requires2fa: true,
        username,
        emailMasked: this.maskEmail(email),
      };
    }

    return this.generateLoginResponse(user, ipAddress);
  }

  async verify2fa(username: string, code: string, ipAddress?: string) {
    const entry = this.otpStore.get(username);
    if (!entry) {
      throw new UnauthorizedException('No active verification code found');
    }

    if (Date.now() > entry.expires) {
      this.otpStore.delete(username);
      throw new UnauthorizedException('Verification code has expired');
    }

    if (entry.code !== code) {
      throw new UnauthorizedException('Invalid verification code');
    }

    this.otpStore.delete(username);

    const user = await this.usersService.findByUsername(username);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.generateLoginResponse(user, ipAddress);
  }

  private maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) return `**@${domain}`;
    return `${name.substring(0, 2)}***${name.substring(name.length - 2)}@${domain}`;
  }

  // Refactored to global EmailService.

  private async generateLoginResponse(user: any, ipAddress?: string) {
    // Log the LOGIN event
    await this.auditLogService.createLog('LOGIN', {
      employeeId: user.id,
      ipAddress,
      description: `User ${user.emp_code} (${user.name}) logged in successfully.`,
    });

    const payload = {
      username: user.username,
      sub: user.id,
      fullName: user.full_name,
      roleId: user.role_id,
      branchId: user.branch_id,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        emp_type: user.user_type_id,
        user_type_id: user.user_type_id,
        emp_code: user.emp_code,
        designation: user.designation,
        audit_unit_authority: user.audit_unit_authority || user.audit_unit_ids,
        password_policy: user.password_policy === null ? 0 : Number(user.password_policy),
      },
    };
  }

  async resetPassword(username: string, newPassword: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      throw new NotFoundException(`User with employee code "${username}" not found`);
    }

    const policy = await this.passwordPolicyService.getPolicy();
    const validation = this.passwordPolicyService.validatePasswordAgainstPolicy(newPassword, policy);
    if (!validation.isValid) {
      throw new BadRequestException(validation.message);
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const query = `
      UPDATE employee_master 
      SET password = $1, password_policy = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await this.db.query(query, [hash, user.id]);
    return { success: true };
  }

  async logout(employeeId: number, ipAddress?: string) {
    await this.auditLogService.createLog('LOGOUT', {
      employeeId,
      ipAddress,
      description: `User logged out successfully.`,
    });
  }
}
