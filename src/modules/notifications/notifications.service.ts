import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(userId: number) {
    const result = await this.db.query(
      `
      SELECT id, title, message, is_read, created_at 
      FROM user_notifications 
      WHERE user_id = $1 AND deleted_at IS NULL 
      ORDER BY id DESC 
      LIMIT 100;
      `,
      [userId],
    );
    return result.rows;
  }

  async markAsRead(id: number, userId: number) {
    await this.db.query(
      `
      UPDATE user_notifications 
      SET is_read = TRUE 
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;
      `,
      [id, userId],
    );
    return { success: true };
  }

  async markAllAsRead(userId: number) {
    await this.db.query(
      `
      UPDATE user_notifications 
      SET is_read = TRUE 
      WHERE user_id = $1 AND is_read = FALSE AND deleted_at IS NULL;
      `,
      [userId],
    );
    return { success: true };
  }

  async create(userId: number, title: string, message: string) {
    const result = await this.db.query(
      `
      INSERT INTO user_notifications (user_id, title, message, is_read, created_at)
      VALUES ($1, $2, $3, FALSE, CURRENT_TIMESTAMP)
      RETURNING id;
      `,
      [userId, title.trim(), message.trim()],
    );
    return result.rows[0];
  }
}
