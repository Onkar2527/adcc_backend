import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { IdService } from '../../core/id/id.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly idService: IdService,
  ) {}

  async findAll() {
    const query = `
      SELECT id, branch_code, branch_name, address, contact_number, is_active, created_at, updated_at
      FROM branches
      ORDER BY branch_name ASC
    `;
    const result = await this.db.query(query);
    return result.rows;
  }

  async findOne(id: string) {
    const query = `SELECT * FROM branches WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rows[0];
  }

  async create(data: CreateBranchDto) {
    const id = this.idService.generate();
    const query = `
      INSERT INTO branches (id, branch_code, branch_name, address, contact_number, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      id,
      data.branch_code,
      data.branch_name,
      data.address ?? null,
      data.contact_number ?? null,
      data.is_active ?? true,
    ];
    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  async update(id: string, data: UpdateBranchDto) {
    const query = `
      UPDATE branches SET
        branch_code = COALESCE($2, branch_code),
        branch_name = COALESCE($3, branch_name),
        address = COALESCE($4, address),
        contact_number = COALESCE($5, contact_number),
        is_active = COALESCE($6, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const values = [
      id,
      data.branch_code ?? null,
      data.branch_name ?? null,
      data.address ?? null,
      data.contact_number ?? null,
      data.is_active ?? null,
    ];
    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  async remove(id: string) {
    const query = `DELETE FROM branches WHERE id = $1`;
    await this.db.query(query, [id]);
    return { deleted: true };
  }
}
