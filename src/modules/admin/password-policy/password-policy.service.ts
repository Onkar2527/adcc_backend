import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/database.service';
import { UpdatePasswordPolicyDto } from './dto/password-policy.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordPolicyService implements OnModuleInit {
  private readonly logger = new Logger(PasswordPolicyService.name);

  constructor(private readonly db: DatabaseService) { }

  async onModuleInit() {
    try {
      const query = `ALTER TABLE password_policy DROP COLUMN IF EXISTS default_password;`;
      await this.db.query(query);
      this.logger.log('Database migrated: dropped default_password from password_policy if exists.');
    } catch (err) {
      this.logger.error('Failed to run migration for password_policy:', err);
    }
  }

  async getPolicy() {
    const query = `SELECT * FROM password_policy WHERE deleted_at IS NULL ORDER BY id LIMIT 1`;
    const result = await this.db.query(query);
    return result.rows[0];
  }

  async updatePolicy(data: UpdatePasswordPolicyDto, adminId: number) {
    const existing = await this.getPolicy();

    if (existing) {
      const query = `
        UPDATE password_policy 
        SET min_length = $1, num_cnt = $2, uppercase_cnt = $3, 
            lowercase_cnt = $4, symbol_cnt = $5, admin_id = $6, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
      `;
      const values = [
        data.min_length, data.num_cnt, data.uppercase_cnt,
        data.lowercase_cnt, data.symbol_cnt, adminId,
        existing.id
      ];
      await this.db.query(query, values);
    } else {
      const query = `
        INSERT INTO password_policy (
          min_length, num_cnt, uppercase_cnt, lowercase_cnt, symbol_cnt, admin_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;
      const values = [
        data.min_length, data.num_cnt, data.uppercase_cnt,
        data.lowercase_cnt, data.symbol_cnt, adminId
      ];
      await this.db.query(query, values);
    }

    // Crucial: Reset password_policy flag to 1 for all active employees
    const resetUsersQuery = `
      UPDATE employee_master 
      SET password_policy = 1, updated_at = CURRENT_TIMESTAMP
      WHERE deleted_at IS NULL AND is_active = 1
    `;
    await this.db.query(resetUsersQuery);

    return this.getPolicy();
  }

  validatePasswordAgainstPolicy(password: string, policy: any): { isValid: boolean; message?: string } {
    if (!policy) return { isValid: true };

    if (password.length < (policy.min_length || 0)) {
      return { isValid: false, message: `Password must be at least ${policy.min_length} characters long` };
    }

    const uppercaseMatches = password.match(/[A-Z]/g) || [];
    if (uppercaseMatches.length < (policy.uppercase_cnt || 0)) {
      return { isValid: false, message: `Password must contain at least ${policy.uppercase_cnt} uppercase letter(s)` };
    }

    const lowercaseMatches = password.match(/[a-z]/g) || [];
    if (lowercaseMatches.length < (policy.lowercase_cnt || 0)) {
      return { isValid: false, message: `Password must contain at least ${policy.lowercase_cnt} lowercase letter(s)` };
    }

    const numberMatches = password.match(/[0-9]/g) || [];
    if (numberMatches.length < (policy.num_cnt || 0)) {
      return { isValid: false, message: `Password must contain at least ${policy.num_cnt} number(s)` };
    }

    const symbolMatches = password.match(/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\];'`~]/g) || [];
    if (symbolMatches.length < (policy.symbol_cnt || 0)) {
      return { isValid: false, message: `Password must contain at least ${policy.symbol_cnt} special character(s)` };
    }

    return { isValid: true };
  }
}

