import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { IdService } from '../../core/id/id.service';
import { CreateLoanTypeDto, UpdateLoanTypeDto } from './dto/loan-type.dto';

@Injectable()
export class LoanTypesService {
  private readonly logger = new Logger(LoanTypesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly idService: IdService,
  ) {}

  async findAll() {
    const query = `
      SELECT 
        id, type_code, type_name, description, interest_rate, max_tenure_months, 
        is_active, created_at, updated_at
      FROM loan_types
      ORDER BY type_name ASC
    `;
    const result = await this.db.query(query);
    return result.rows;
  }

  async findOne(id: string) {
    const query = `SELECT * FROM loan_types WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rows[0];
  }

  async create(data: CreateLoanTypeDto) {
    const id = this.idService.generate();
    const query = `
      INSERT INTO loan_types (
        id, type_code, type_name, description, 
        interest_rate, max_tenure_months, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      id,
      data.type_code,
      data.type_name,
      data.description ?? null,
      data.interest_rate ?? 0,
      data.max_tenure_months ?? 0,
      data.is_active ?? true,
    ];
    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  async update(id: string, data: UpdateLoanTypeDto) {
    const query = `
      UPDATE loan_types SET
        type_code = COALESCE($2, type_code),
        type_name = COALESCE($3, type_name),
        description = COALESCE($4, description),
        interest_rate = COALESCE($5, interest_rate),
        max_tenure_months = COALESCE($6, max_tenure_months),
        is_active = COALESCE($7, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const values = [
      id,
      data.type_code ?? null,
      data.type_name ?? null,
      data.description ?? null,
      data.interest_rate ?? null,
      data.max_tenure_months ?? null,
      data.is_active ?? null,
    ];
    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  async remove(id: string) {
    const query = `DELETE FROM loan_types WHERE id = $1`;
    await this.db.query(query, [id]);
    return { deleted: true };
  }
}
