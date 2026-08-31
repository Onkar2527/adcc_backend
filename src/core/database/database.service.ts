import { Injectable, OnModuleDestroy, OnModuleInit, Logger, RequestTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow, types } from 'pg';

// Force node-pg to parse DATE columns (type OID 1082) as UTC Date objects
// to prevent JavaScript timezone conversion and day shifting.
types.setTypeParser(1082, (val) => new Date(val + 'T00:00:00Z'));

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
      max: this.configService.get<number>('DB_POOL_MAX', 30), // Increased default max pool size for better concurrency
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: this.configService.get<number>('DB_CONNECTION_TIMEOUT', 10000),
    });

    this.pool.on('error', (err: any) => {
      this.logger.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    this.logger.log('Database connection pool initialized');

    // Run table migrations to add super_reviewer_comment
    this.query(`
      ALTER TABLE answers_data ADD COLUMN IF NOT EXISTS super_reviewer_comment TEXT;
    `).then(() => {
      this.logger.log('answers_data table successfully migrated for super_reviewer_comment');
    }).catch(err => {
      this.logger.error('Failed to migrate answers_data for super_reviewer_comment', err);
    });

    this.query(`
      ALTER TABLE answers_data_annexure ADD COLUMN IF NOT EXISTS super_reviewer_comment TEXT;
    `).then(() => {
      this.logger.log('answers_data_annexure table successfully migrated for super_reviewer_comment');
    }).catch(err => {
      this.logger.error('Failed to migrate answers_data_annexure for super_reviewer_comment', err);
    });

    this.query(`
      ALTER TABLE answers_data_timeline ADD COLUMN IF NOT EXISTS super_reviewer_comment TEXT;
    `).then(async () => {
      this.logger.log('answers_data_timeline table successfully migrated for super_reviewer_comment');

      // Recreate answers_data trigger function
      await this.query(`
        CREATE OR REPLACE FUNCTION public.log_answers_data_to_timeline()
        RETURNS TRIGGER AS $$
        BEGIN
            IF (TG_OP = 'UPDATE') THEN
                IF (
                    COALESCE(NEW.answer_given, '') = COALESCE(OLD.answer_given, '') AND
                    COALESCE(NEW.audit_comment, '') = COALESCE(OLD.audit_comment, '') AND
                    COALESCE(NEW.audit_reviewer_comment, '') = COALESCE(OLD.audit_reviewer_comment, '') AND
                    COALESCE(NEW.audit_commpliance, '') = COALESCE(OLD.audit_commpliance, '') AND
                    COALESCE(NEW.compliance_reviewer_comment, '') = COALESCE(OLD.compliance_reviewer_comment, '') AND
                    COALESCE(NEW.super_reviewer_comment, '') = COALESCE(OLD.super_reviewer_comment, '') AND
                    COALESCE(NEW.compliance_maker_comment, '') = COALESCE(OLD.compliance_maker_comment, '') AND
                    COALESCE(NEW.compliance_maker_emp_id, 0) = COALESCE(OLD.compliance_maker_emp_id, 0) AND
                    COALESCE(NEW.audit_status_id, 0) = COALESCE(OLD.audit_status_id, 0) AND
                    COALESCE(NEW.compliance_status_id, 0) = COALESCE(OLD.compliance_status_id, 0) AND
                    COALESCE(NEW.audit_evidance_upload, '') = COALESCE(OLD.audit_evidance_upload, '') AND
                    COALESCE(NEW.compliance_evidance_upload, '') = COALESCE(OLD.compliance_evidance_upload, '')
                ) THEN
                    RETURN NEW;
                END IF;
            END IF;

            INSERT INTO public.answers_data_timeline (
                answer_id, annex_id, assesment_id, answer_given, audit_comment, audit_emp_id,
                audit_status_id, audit_reviewer_emp_id, audit_reviewer_comment, audit_commpliance,
                audit_evidance_upload, audit_compulsary_ev_upload, compliance_evidance_upload,
                compliance_compulsary_ev_upload, compliance_emp_id, compliance_status_id,
                compliance_reviewer_emp_id, compliance_reviewer_comment, super_reviewer_comment,
                compliance_maker_comment, compliance_maker_emp_id, compliance_maker_date,
                business_risk, control_risk, batch_key, created_at, updated_at
            ) VALUES (
                NEW.id, 0, NEW.assesment_id, NEW.answer_given, NEW.audit_comment, NEW.audit_emp_id,
                NEW.audit_status_id, NEW.audit_reviewer_emp_id, NEW.audit_reviewer_comment, NEW.audit_commpliance,
                NEW.audit_evidance_upload, NEW.audit_compulsary_ev_upload, NEW.compliance_evidance_upload,
                NEW.compliance_compulsary_ev_upload, NEW.compliance_emp_id, NEW.compliance_status_id,
                NEW.compliance_reviewer_emp_id, NEW.compliance_reviewer_comment, NEW.super_reviewer_comment,
                NEW.compliance_maker_comment, NEW.compliance_maker_emp_id, NEW.compliance_maker_date,
                NEW.business_risk, NEW.control_risk, NEW.batch_key, NOW(), NOW()
            );
            RETURN NEW;
        END IF;
        $$ LANGUAGE plpgsql;
      `);

      // Recreate answers_data_annexure trigger function
      await this.query(`
        CREATE OR REPLACE FUNCTION public.log_answers_data_annexure_to_timeline()
        RETURNS TRIGGER AS $$
        BEGIN
            IF (TG_OP = 'UPDATE') THEN
                IF (
                    COALESCE(NEW.answer_given, '') = COALESCE(OLD.answer_given, '') AND
                    COALESCE(NEW.audit_comment, '') = COALESCE(OLD.audit_comment, '') AND
                    COALESCE(NEW.audit_reviewer_comment, '') = COALESCE(OLD.audit_reviewer_comment, '') AND
                    COALESCE(NEW.audit_commpliance, '') = COALESCE(OLD.audit_commpliance, '') AND
                    COALESCE(NEW.compliance_reviewer_comment, '') = COALESCE(OLD.compliance_reviewer_comment, '') AND
                    COALESCE(NEW.super_reviewer_comment, '') = COALESCE(OLD.super_reviewer_comment, '') AND
                    COALESCE(NEW.compliance_maker_comment, '') = COALESCE(OLD.compliance_maker_comment, '') AND
                    COALESCE(NEW.compliance_maker_emp_id, 0) = COALESCE(OLD.compliance_maker_emp_id, 0) AND
                    COALESCE(NEW.audit_status_id, 0) = COALESCE(OLD.audit_status_id, 0) AND
                    COALESCE(NEW.compliance_status_id, 0) = COALESCE(OLD.compliance_status_id, 0) AND
                    COALESCE(NEW.audit_evidance_upload, '') = COALESCE(OLD.audit_evidance_upload, '') AND
                    COALESCE(NEW.compliance_evidance_upload, '') = COALESCE(OLD.compliance_evidance_upload, '') AND
                    COALESCE(NEW.risk_cat_id, 0) = COALESCE(OLD.risk_cat_id, 0)
                ) THEN
                    RETURN NEW;
                END IF;
            END IF;

            INSERT INTO public.answers_data_timeline (
                answer_id, annex_id, assesment_id, answer_given, audit_comment, audit_emp_id,
                audit_status_id, audit_reviewer_emp_id, audit_reviewer_comment, audit_commpliance,
                audit_evidance_upload, audit_compulsary_ev_upload, compliance_evidance_upload,
                compliance_compulsary_ev_upload, compliance_emp_id, compliance_status_id,
                compliance_reviewer_emp_id, compliance_reviewer_comment, super_reviewer_comment,
                compliance_maker_comment, compliance_maker_emp_id, compliance_maker_date,
                business_risk, control_risk, batch_key, created_at, updated_at
            ) VALUES (
                NEW.answer_id, NEW.id, NEW.assesment_id, NEW.answer_given, NEW.audit_comment, NEW.audit_emp_id,
                NEW.audit_status_id, NEW.audit_reviewer_emp_id, NEW.audit_reviewer_comment, NEW.audit_commpliance,
                NEW.audit_evidance_upload, NEW.audit_compulsary_ev_upload, NEW.compliance_evidance_upload,
                NEW.compliance_compulsary_ev_upload, NEW.compliance_emp_id, NEW.compliance_status_id,
                NEW.compliance_reviewer_emp_id, NEW.compliance_reviewer_comment, NEW.super_reviewer_comment,
                NEW.compliance_maker_comment, NEW.compliance_maker_emp_id, NEW.compliance_maker_date,
                NEW.business_risk, NEW.control_risk, NEW.batch_key, NOW(), NOW()
            );
            RETURN NEW;
        END IF;
        $$ LANGUAGE plpgsql;
      `);

      this.logger.log('Database triggers successfully updated for super_reviewer_comment');
    }).catch(err => {
      this.logger.error('Failed to migrate answers_data_timeline or triggers for super_reviewer_comment', err);
    });
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
    } catch (error: any) {
      const poolStatus = this.pool ? {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
      } : 'No Pool';
      this.logger.error(
        `Error executing query: ${text.substring(0, 500)}... | Pool Status: ${JSON.stringify(poolStatus)}`,
        error,
      );
      if (error?.message && (error.message.includes('timeout exceeded') || error.message.includes('timeout'))) {
        throw new RequestTimeoutException(
          'Database request timed out due to high load. Please try again in a few moments.',
        );
      }
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
    let client: PoolClient;
    try {
      client = await this.pool.connect();
    } catch (error: any) {
      const poolStatus = this.pool ? {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
      } : 'No Pool';
      this.logger.error(
        `Error connecting for transaction | Pool Status: ${JSON.stringify(poolStatus)}`,
        error,
      );
      if (error?.message && (error.message.includes('timeout exceeded') || error.message.includes('timeout'))) {
        throw new RequestTimeoutException(
          'Database request timed out due to high load. Please try again in a few moments.',
        );
      }
      throw error;
    }

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (e: any) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        this.logger.error('Error during transaction rollback', rollbackError);
      }
      if (e?.message && (e.message.includes('timeout exceeded') || e.message.includes('timeout'))) {
        throw new RequestTimeoutException(
          'Database request timed out due to high load. Please try again in a few moments.',
        );
      }
      throw e;
    } finally {
      client.release();
    }
  }
}
