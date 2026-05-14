import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private configService: ConfigService) { }

  onModuleInit() {
    const isSsl = this.configService.get<string>('DB_SSL') === 'true';

    this.pool = new Pool({
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      user: this.configService.get<string>('DB_USER', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD', 'postgres'),
      database: this.configService.get<string>('DB_NAME', 'postgres'),
      ssl: isSsl ? { rejectUnauthorized: false } : false,
      max: 20, // Increase max pool size for better concurrency
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err: any) => {
      this.logger.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    this.logger.log('Database connection pool initialized');
  }

  async onModuleDestroy() {
    this.logger.log('Closing database connection pool');
    await this.pool.end();
  }

  /**
   * Executes a database query.
   * @param text The SQL query string.
   * @param params The query parameters.
   * @returns The query result.
   */
  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      this.logger.debug(`Executed query`, { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      this.logger.error(`Error executing query: ${text}`, error);
      throw error;
    }
  }

  /**
   * Executes a query and returns the first row or null if not found.
   * @param text The SQL query string.
   * @param params The query parameters.
   * @returns The first row or null.
   */
  async findOne<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T | null> {
    const res = await this.query<T>(text, params);
    return res.rows[0] || null;
  }

  /**
   * Executes a callback within a managed database transaction.
   * @param callback The function to execute within the transaction.
   * @returns The result of the callback.
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
