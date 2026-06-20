import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { AuditLogService } from '../audit-logs/audit-log.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
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

  async login(username: string, pass: string, ipAddress?: string) {
    const user = await this.validateUser(username, pass);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

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
      },
    };
  }

  async logout(employeeId: number, ipAddress?: string) {
    await this.auditLogService.createLog('LOGOUT', {
      employeeId,
      ipAddress,
      description: `User logged out successfully.`,
    });
  }
}
