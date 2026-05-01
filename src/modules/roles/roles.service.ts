import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { IdService } from '../../core/id/id.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly idService: IdService,
  ) {}

  async findAll() {
    const query = `
      SELECT id, role_name, description, is_active, created_at, updated_at
      FROM roles
      ORDER BY role_name ASC
    `;
    const result = await this.db.query(query);
    return result.rows;
  }

  async findOne(id: string) {
    const query = `SELECT * FROM roles WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rows[0];
  }

  async create(data: CreateRoleDto) {
    const id = this.idService.generate();
    const query = `
      INSERT INTO roles (id, role_name, description, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [
      id,
      data.role_name,
      data.description ?? null,
      data.is_active ?? true,
    ];
    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  async update(id: string, data: UpdateRoleDto) {
    const query = `
      UPDATE roles SET
        role_name = COALESCE($2, role_name),
        description = COALESCE($3, description),
        is_active = COALESCE($4, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const values = [
      id,
      data.role_name ?? null,
      data.description ?? null,
      data.is_active ?? null,
    ];
    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  async remove(id: string) {
    const query = `DELETE FROM roles WHERE id = $1`;
    await this.db.query(query, [id]);
    return { deleted: true };
  }
}
