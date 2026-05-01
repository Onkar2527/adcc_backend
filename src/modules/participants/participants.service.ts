import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { IdService } from '../../core/id/id.service';

@Injectable()
export class ParticipantsService {
  private readonly logger = new Logger(ParticipantsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly idService: IdService,
  ) {}

  async findAllByProposal(proposalId: string) {
    const query = `
      SELECT id, proposal_id, entity_type, name, phone, email, created_at, updated_at
      FROM proposal_participants
      WHERE proposal_id = $1
      ORDER BY created_at ASC
    `;
    const res = await this.db.query(query, [proposalId]);
    return res.rows;
  }

  async create(proposalId: string, data: any) {
    const query = `
      INSERT INTO proposal_participants (
        proposal_id, entity_type, name, phone, email
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      proposalId,
      data.entity_type || 'G',
      data.name,
      data.phone || null,
      data.email || null
    ];
    const res = await this.db.query(query, values);
    return res.rows[0];
  }

  async update(id: string, data: any) {
    const query = `
      UPDATE proposal_participants SET
        name = $2, phone = $3, email = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const values = [id, data.name, data.phone || null, data.email || null];
    const res = await this.db.query(query, values);
    return res.rows[0];
  }

  async remove(id: string) {
    const query = `DELETE FROM proposal_participants WHERE id = $1`;
    await this.db.query(query, [id]);
    return { success: true };
  }
}
