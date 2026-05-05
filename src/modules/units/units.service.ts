import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';

@Injectable()
export class UnitsService {
  private readonly logger = new Logger(UnitsService.name);

  constructor(private readonly db: DatabaseService) {}

  async findAll() {
    const query = `
      SELECT id, name, audit_unit_code 
      FROM audit_unit_master 
      WHERE deleted_at IS NULL AND is_active = 1
      ORDER BY name ASC
    `;
    const result = await this.db.query(query);
    return result.rows.map(row => ({
      ...row,
      id: Number(row.id)
    }));
  }
}
