import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../../core/database/database.service';

import {
    CreateQuestionSetDto,
    UpdateQuestionSetDto, CreateQuestionHeaderDto, UpdateQuestionHeaderDto, CreateQuestionDto, UpdateQuestionDto
} from './dto/audit-questions.dto';

interface QuestionSetRow {
    id: number;
    name: string;
    set_type_id: number;
    is_active: number;
    admin_id: number;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

@Injectable()
export class AuditQuestionMasterService {
    constructor(
        private readonly db: DatabaseService,
    ) { }

    async findAllSets(): Promise<QuestionSetRow[]> {
        return this.queryRows<QuestionSetRow>(
            `
      SELECT
        qsm.*,

        CASE
          WHEN qsm.set_type_id = 1
            THEN 'Main Set'

          WHEN qsm.set_type_id = 2
            THEN 'Sub Set'

          ELSE '-'
        END AS set_type_name

      FROM question_set_master qsm

      WHERE qsm.deleted_at IS NULL

      ORDER BY qsm.id DESC
      `,
        );
    }

    async findOneSet(
        id: number,
    ): Promise<QuestionSetRow> {
        const row =
            await this.queryOne<QuestionSetRow>(
                `
        SELECT *
        FROM question_set_master
        WHERE id = $1
        AND deleted_at IS NULL
        `,
                [id],
            );

        if (!row) {
            throw new NotFoundException(
                'Question set not found',
            );
        }

        return row;
    }

    async createSet(
        data: CreateQuestionSetDto,
    ): Promise<QuestionSetRow> {
        await this.validateQuestionSet(data);

        const row =
            await this.queryOne<QuestionSetRow>(
                `
        INSERT INTO question_set_master (
          name,
          set_type_id,
          is_active,
          admin_id
        )
        VALUES ($1, $2, $3, $4)

        RETURNING *
        `,
                [
                    data.name.toUpperCase(),

                    data.set_type_id,

                    data.is_active ?? 1,

                    data.admin_id ?? 1,
                ],
            );

        if (!row) {
            throw new BadRequestException(
                'Unable to create question set',
            );
        }

        return row;
    }

    async updateSet(
        id: number,
        data: UpdateQuestionSetDto,
    ): Promise<QuestionSetRow> {
        await this.findOneSet(id);

        await this.validateQuestionSet(
            data,
            id,
        );

        const row =
            await this.queryOne<QuestionSetRow>(
                `
        UPDATE question_set_master

        SET
          name = COALESCE($2, name),

          set_type_id = COALESCE(
            $3,
            set_type_id
          ),

          is_active = COALESCE(
            $4,
            is_active
          ),

          admin_id = COALESCE(
            $5,
            admin_id
          ),

          updated_at = CURRENT_TIMESTAMP

        WHERE id = $1

        RETURNING *
        `,
                [
                    id,

                    data.name?.toUpperCase(),

                    data.set_type_id,

                    data.is_active,

                    data.admin_id,
                ],
            );

        if (!row) {
            throw new BadRequestException(
                'Unable to update question set',
            );
        }

        return row;
    }

    async toggleSetStatus(id: number) {
        await this.findOneSet(id);

        const row = await this.queryOne(
            `
      UPDATE question_set_master

      SET
        is_active = CASE
          WHEN is_active = 1 THEN 0
          ELSE 1
        END,

        updated_at = CURRENT_TIMESTAMP

      WHERE id = $1

      RETURNING *
      `,
            [id],
        );

        if (!row) {
            throw new BadRequestException(
                'Unable to update status',
            );
        }

        return row;
    }

    async removeSet(id: number) {
        await this.findOneSet(id);

        const row = await this.queryOne(
            `
      UPDATE question_set_master

      SET
        deleted_at = CURRENT_TIMESTAMP,

        updated_at = CURRENT_TIMESTAMP

      WHERE id = $1

      RETURNING *
      `,
            [id],
        );

        if (!row) {
            throw new BadRequestException(
                'Unable to delete question set',
            );
        }

        return row;
    }

    private async validateQuestionSet(
        data: Partial<
            CreateQuestionSetDto &
            UpdateQuestionSetDto
        >,
        id?: number,
    ) {
        if (
            data.set_type_id &&
            ![1, 2].includes(data.set_type_id)
        ) {
            throw new BadRequestException(
                'Invalid set type',
            );
        }

        if (data.name) {
            let query = `
        SELECT id
        FROM question_set_master
        WHERE UPPER(name) = $1
        AND deleted_at IS NULL
      `;

            const params: any[] = [
                data.name.toUpperCase(),
            ];

            if (id) {
                query += ` AND id != $2`;
                params.push(id);
            }

            const existing =
                await this.queryOne(
                    query,
                    params,
                );

            if (existing) {
                throw new BadRequestException(
                    'Question set already exists',
                );
            }
        }
    }

    private async queryRows<T>(
        query: string,
        params: any[] = [],
    ): Promise<T[]> {
        const result = await this.db.query(
            query,
            params,
        );

        return result.rows as T[];
    }

    private async queryOne<T>(
        query: string,
        params: any[] = [],
    ): Promise<T | null> {
        const rows = await this.queryRows<T>(
            query,
            params,
        );

        return rows[0] ?? null;
    }

    // Question Header

    async findHeadersBySet(
        setId: number,
    ) {
        return this.queryRows(
            `
    SELECT
      qhm.*,

      qsm.name AS set_name

    FROM question_header_master qhm

    LEFT JOIN question_set_master qsm
      ON qsm.id = qhm.question_set_id

    WHERE qhm.question_set_id = $1
    AND qhm.deleted_at IS NULL

    ORDER BY qhm.id DESC
    `,
            [setId],
        );
    }

    async findOneHeader(id: number) {
        const row = await this.queryOne(
            `
    SELECT *
    FROM question_header_master
    WHERE id = $1
    AND deleted_at IS NULL
    `,
            [id],
        );

        if (!row) {
            throw new NotFoundException(
                'Question header not found',
            );
        }

        return row;
    }

    async createHeader(
        data: CreateQuestionHeaderDto,
    ) {
        await this.validateQuestionHeader(data);

        const row = await this.queryOne(
            `
    INSERT INTO question_header_master (
      question_set_id,
      name,
      is_active,
      admin_id
    )
    VALUES ($1, $2, $3, $4)

    RETURNING *
    `,
            [
                data.question_set_id,

                data.name.toUpperCase(),

                data.is_active ?? 1,

                data.admin_id ?? 1,
            ],
        );

        if (!row) {
            throw new BadRequestException(
                'Unable to create question header',
            );
        }

        return row;
    }

    async updateHeader(
        id: number,
        data: UpdateQuestionHeaderDto,
    ) {
        await this.findOneHeader(id);

        await this.validateQuestionHeader(
            data,
            id,
        );

        const row = await this.queryOne(
            `
    UPDATE question_header_master

    SET
      question_set_id = COALESCE(
        $2,
        question_set_id
      ),

      name = COALESCE(
        $3,
        name
      ),

      is_active = COALESCE(
        $4,
        is_active
      ),

      admin_id = COALESCE(
        $5,
        admin_id
      ),

      updated_at = CURRENT_TIMESTAMP

    WHERE id = $1

    RETURNING *
    `,
            [
                id,

                data.question_set_id,

                data.name?.toUpperCase(),

                data.is_active,

                data.admin_id,
            ],
        );

        if (!row) {
            throw new BadRequestException(
                'Unable to update question header',
            );
        }

        return row;
    }

    async toggleHeaderStatus(id: number) {
        await this.findOneHeader(id);

        const row = await this.queryOne(
            `
    UPDATE question_header_master

    SET
      is_active = CASE
        WHEN is_active = 1 THEN 0
        ELSE 1
      END,

      updated_at = CURRENT_TIMESTAMP

    WHERE id = $1

    RETURNING *
    `,
            [id],
        );

        if (!row) {
            throw new BadRequestException(
                'Unable to update status',
            );
        }

        return row;
    }

    async removeHeader(id: number) {
        await this.findOneHeader(id);

        const row = await this.queryOne(
            `
    UPDATE question_header_master

    SET
      deleted_at = CURRENT_TIMESTAMP,

      updated_at = CURRENT_TIMESTAMP

    WHERE id = $1

    RETURNING *
    `,
            [id],
        );

        if (!row) {
            throw new BadRequestException(
                'Unable to delete question header',
            );
        }

        return row;
    }

    private async validateQuestionHeader(
        data: Partial<
            CreateQuestionHeaderDto &
            UpdateQuestionHeaderDto
        >,
        id?: number,
    ) {
        if (
            data.question_set_id &&
            !(await this.queryOne(
                `
      SELECT id
      FROM question_set_master
      WHERE id = $1
      AND deleted_at IS NULL
      `,
                [data.question_set_id],
            ))
        ) {
            throw new BadRequestException(
                'Question set not found',
            );
        }

        if (
            data.name &&
            data.question_set_id
        ) {
            let query = `
      SELECT id
      FROM question_header_master

      WHERE question_set_id = $1
      AND UPPER(name) = $2
      AND deleted_at IS NULL
    `;

            const params: any[] = [
                data.question_set_id,

                data.name.toUpperCase(),
            ];

            if (id) {
                query += ` AND id != $3`;
                params.push(id);
            }

            const existing =
                await this.queryOne(
                    query,
                    params,
                );

            if (existing) {
                throw new BadRequestException(
                    'Question header already exists in this set',
                );
            }
        }
    }

    // Question Master

    async getQuestionLookups() {
        return {
            setTypes: [
                {
                    label: 'MAINSET',
                    value: 1,
                },
                {
                    label: 'SUBSET',
                    value: 2,
                },
            ],

            questionTypes: [
                {
                    label: 'QUALITATIVE',
                    value: 1,
                },
                {
                    label: 'QUANTITATIVE',
                    value: 2,
                },
            ],

            questionInputMethods: [
                {
                    label:
                        'MULTIPLE - OPTION SELECT',
                    value: 1,
                },

                {
                    label:
                        'YES / NO TYPE - OPTION SELECT',
                    value: 2,
                },

                {
                    label:
                        'GENERAL QUESTION - ONLY TEXTAREA',
                    value: 3,
                },

                {
                    label: 'ANNEXURE',
                    value: 4,
                },

                {
                    label: 'SUBSET',
                    value: 5,
                },
            ],

            applicableTo: [
                {
                    label: 'GENERAL',
                    value: 1,
                },

                {
                    label: 'INDIVIDUAL',
                    value: 2,
                },

                {
                    label: 'NON-INDIVIDUAL',
                    value: 3,
                },

                {
                    label:
                        'INDIVIDUAL / NON-INDIVIDUAL',
                    value: 4,
                },
            ],

            riskParameters: [
                {
                    label: 'HIGH RISK',
                    value: 1,
                },

                {
                    label: 'MEDIUM RISK',
                    value: 2,
                },

                {
                    label: 'LOW RISK',
                    value: 3,
                },

                {
                    label: 'NO RISK',
                    value: 4,
                },
            ],
        };
    }

    // =========================
    // QUESTION MASTER
    // =========================

    async findQuestionsByHeader(
        headerId: number,
    ) {
        return this.queryRows(
            `
    SELECT
      qm.*,

      qhm.name AS header_name,

      qsm.name AS set_name,

      CASE
        WHEN qm.question_type_id = 1
          THEN 'QUALITATIVE'

        WHEN qm.question_type_id = 2
          THEN 'QUANTITATIVE'

        ELSE '-'
      END AS question_type_name,

      CASE
        WHEN qm.option_id = 1
          THEN 'MULTIPLE OPTION'

        WHEN qm.option_id = 2
          THEN 'YES / NO'

        WHEN qm.option_id = 3
          THEN 'TEXTAREA'

        WHEN qm.option_id = 4
          THEN 'ANNEXURE'

        WHEN qm.option_id = 5
          THEN 'SUBSET'

        ELSE '-'
      END AS option_name,

      CASE
        WHEN qm.risk_category_id = 1
          THEN 'HIGH RISK'

        WHEN qm.risk_category_id = 2
          THEN 'MEDIUM RISK'

        WHEN qm.risk_category_id = 3
          THEN 'LOW RISK'

        WHEN qm.risk_category_id = 4
          THEN 'NO RISK'

        ELSE '-'
      END AS risk_category_name

    FROM question_master qm

    LEFT JOIN question_header_master qhm
      ON qhm.id = qm.header_id

    LEFT JOIN question_set_master qsm
      ON qsm.id = qm.set_id

    WHERE qm.header_id = $1
    AND qm.deleted_at IS NULL

    ORDER BY qm.id DESC
    `,
            [headerId],
        );
    }

    async findOneQuestion(id: number) {
        const row = await this.queryOne(
            `
    SELECT *
    FROM question_master
    WHERE id = $1
    AND deleted_at IS NULL
    `,
            [id],
        );

        if (!row) {
            throw new NotFoundException(
                'Question not found',
            );
        }

        return row;
    }

    async createQuestion(
        data: CreateQuestionDto,
    ) {
        await this.validateQuestion(data);

        const row = await this.queryOne(
            `
    INSERT INTO question_master (
      set_id,
      header_id,
      question,
      question_type_id,
      option_id,
      applicable_id,
      risk_category_id,
      is_active,
      admin_id
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9
    )

    RETURNING *
    `,
            [
                data.set_id,

                data.header_id,

                data.question,

                data.question_type_id,

                data.option_id,

                data.applicable_id,

                data.risk_category_id,

                data.is_active ?? 1,

                data.admin_id ?? 1,
            ],
        );

        if (!row) {
            throw new BadRequestException(
                'Unable to create question',
            );
        }

        return row;
    }

    async updateQuestion(
        id: number,
        data: UpdateQuestionDto,
    ) {
        await this.findOneQuestion(id);

        await this.validateQuestion(
            data,
            id,
        );

        const row = await this.queryOne(
            `
    UPDATE question_master

    SET
      set_id = COALESCE(
        $2,
        set_id
      ),

      header_id = COALESCE(
        $3,
        header_id
      ),

      question = COALESCE(
        $4,
        question
      ),

      question_type_id = COALESCE(
        $5,
        question_type_id
      ),

      option_id = COALESCE(
        $6,
        option_id
      ),

      applicable_id = COALESCE(
        $7,
        applicable_id
      ),

      risk_category_id = COALESCE(
        $8,
        risk_category_id
      ),

      is_active = COALESCE(
        $9,
        is_active
      ),

      admin_id = COALESCE(
        $10,
        admin_id
      ),

      updated_at = CURRENT_TIMESTAMP

    WHERE id = $1

    RETURNING *
    `,
            [
                id,

                data.set_id,

                data.header_id,

                data.question,

                data.question_type_id,

                data.option_id,

                data.applicable_id,

                data.risk_category_id,

                data.is_active,

                data.admin_id,
            ],
        );

        if (!row) {
            throw new BadRequestException(
                'Unable to update question',
            );
        }

        return row;
    }

    async toggleQuestionStatus(
        id: number,
    ) {
        await this.findOneQuestion(id);

        const row = await this.queryOne(
            `
    UPDATE question_master

    SET
      is_active = CASE
        WHEN is_active = 1 THEN 0
        ELSE 1
      END,

      updated_at = CURRENT_TIMESTAMP

    WHERE id = $1

    RETURNING *
    `,
            [id],
        );

        if (!row) {
            throw new BadRequestException(
                'Unable to update status',
            );
        }

        return row;
    }

    async removeQuestion(id: number) {
        await this.findOneQuestion(id);

        const row = await this.queryOne(
            `
    UPDATE question_master

    SET
      deleted_at = CURRENT_TIMESTAMP,

      updated_at = CURRENT_TIMESTAMP

    WHERE id = $1

    RETURNING *
    `,
            [id],
        );

        if (!row) {
            throw new BadRequestException(
                'Unable to delete question',
            );
        }

        return row;
    }

    private async validateQuestion(
        data: Partial<
            CreateQuestionDto &
            UpdateQuestionDto
        >,
        id?: number,
    ) {
        if (
            data.set_id &&
            !(await this.queryOne(
                `
      SELECT id
      FROM question_set_master
      WHERE id = $1
      AND deleted_at IS NULL
      `,
                [data.set_id],
            ))
        ) {
            throw new BadRequestException(
                'Question set not found',
            );
        }

        if (
            data.header_id &&
            !(await this.queryOne(
                `
      SELECT id
      FROM question_header_master
      WHERE id = $1
      AND deleted_at IS NULL
      `,
                [data.header_id],
            ))
        ) {
            throw new BadRequestException(
                'Question header not found',
            );
        }
    }
}