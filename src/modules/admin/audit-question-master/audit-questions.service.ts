import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../../../core/database/database.service';

import {
    CreateQuestionSetDto,
    UpdateQuestionSetDto, CreateQuestionHeaderDto, UpdateQuestionHeaderDto, CreateQuestionDto, UpdateQuestionDto,
    CreateQuestionRiskMappingDto
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

    async getDownloadLookups() {
        const sections = await this.queryRows<any>(
            `
            SELECT id, name
            FROM audit_section_master
            WHERE is_active = 1 AND deleted_at IS NULL
            ORDER BY id ASC
            `
        );

        const riskCategories = await this.queryRows<any>(
            `
            SELECT id, risk_category
            FROM risk_category_master
            WHERE is_active = 1 AND deleted_at IS NULL
            ORDER BY id ASC
            `
        );

        return {
            sections,
            riskCategories
        };
    }

    async getDownloadData(params: {
        section_id: number;
        risk_category_ids?: string;
        risk_levels?: string;
    }) {
        const sectionId = Number(params.section_id);
        const riskCategoryIds = params.risk_category_ids
            ? params.risk_category_ids.split(',').map(id => Number(id.trim())).filter(id => !isNaN(id))
            : [];
        const riskLevels = params.risk_levels
            ? params.risk_levels.split(',').map(lvl => lvl.trim()).filter(lvl => lvl)
            : [];

        // 1. Fetch Year
        const yearRow = await this.queryOne<any>(
            `
            SELECT id FROM year_master
            WHERE deleted_at IS NULL
            ORDER BY id DESC
            LIMIT 1
            `
        );
        const yearId = yearRow ? Number(yearRow.id) : 1;

        // 2. Fetch Risk Matrix for score lookup
        const riskMatrixRows = await this.queryRows<any>(
            `
            SELECT risk_parameter, business_risk_score, control_risk_score
            FROM risk_matrix
            WHERE year_id = $1 AND deleted_at IS NULL
            `,
            [yearId]
        );

        const businessRiskScores = new Map<number, number>();
        const controlRiskScores = new Map<number, number>();
        for (const rm of riskMatrixRows) {
            const p = Number(rm.risk_parameter);
            businessRiskScores.set(p, Number(rm.business_risk_score || 0));
            controlRiskScores.set(p, Number(rm.control_risk_score || 0));
        }

        // 3. Fetch Menus
        let menuQuery = `
            SELECT id, name
            FROM menu_master
            WHERE section_type_id = $1 AND deleted_at IS NULL
            ORDER BY name ASC
        `;
        let menuParams: any[] = [sectionId];
        if (sectionId === -999) {
            menuQuery = `
                SELECT id, name
                FROM menu_master
                WHERE section_type_id != 1 AND deleted_at IS NULL
                ORDER BY name ASC
            `;
            menuParams = [];
        }

        const menus = await this.queryRows<any>(menuQuery, menuParams);

        if (!menus.length) {
            return [];
        }

        const menuIds = menus.map(m => Number(m.id));

        // 4. Fetch Categories
        const categories = await this.queryRows<any>(
            `
            SELECT id, menu_id, name, question_set_ids, is_active
            FROM category_master
            WHERE menu_id = ANY($1::int[]) AND deleted_at IS NULL AND is_active = 1
            ORDER BY name ASC
            `,
            [menuIds]
        );

        if (!categories.length) {
            return [];
        }

        // Parse unique Set IDs
        const setIdsSet = new Set<number>();
        for (const cat of categories) {
            const ids = String(cat.question_set_ids || '')
                .split(',')
                .map(id => Number(id.trim()))
                .filter(id => !isNaN(id) && id > 0);
            ids.forEach(id => setIdsSet.add(id));
        }
        const setIds = Array.from(setIdsSet);

        if (!setIds.length) {
            return [];
        }

        // 5. Fetch Sets & Headers
        const setsAndHeaders = await this.queryRows<any>(
            `
            SELECT qsm.id AS set_id, qsm.name AS set_name,
                   qhm.id AS header_id, qhm.name AS header_name
            FROM question_set_master qsm
            JOIN question_header_master qhm ON qsm.id = qhm.question_set_id
            WHERE qsm.id = ANY($1::int[])
              AND qsm.deleted_at IS NULL
              AND qhm.deleted_at IS NULL
            `,
            [setIds]
        );

        if (!setsAndHeaders.length) {
            return [];
        }

        const headerIds = setsAndHeaders.map(sh => Number(sh.header_id));

        // 6. Fetch Questions
        let riskCategoryFilterClause = '';
        const queryParams: any[] = [yearId, headerIds, setIds];
        if (riskCategoryIds.length > 0) {
            queryParams.push(riskCategoryIds);
            riskCategoryFilterClause = `AND qm.risk_category_id = ANY($4::int[])`;
        }

        const questions = await this.queryRows<any>(
            `
            SELECT qm.id, qm.header_id, qm.set_id, qm.question, qm.parameters,
                   qm.risk_category_id, qm.area_of_audit_id, qm.option_id,
                   qm.annexure_id, qm.subset_multi_id, qm.applicable_id,
                   qm.control_risk_id, qm.key_aspect_id, qm.residual_risk_id,
                   qm.show_instances, qm.audit_ev_upload, qm.compliance_ev_upload,
                   qm.question_type_id,
                   aam.name AS audit_area_name,
                   rcm.risk_category AS risk_category_name,
                   COALESCE(rcw.risk_weight, 0) AS risk_weight,
                   anm.name AS annexure_name,
                   (
                       SELECT string_agg(name, ';')
                       FROM question_set_master
                       WHERE id::text = ANY(string_to_array(COALESCE(qm.subset_multi_id, ''), ','))
                         AND deleted_at IS NULL
                   ) AS subset_name
            FROM question_master qm
            LEFT JOIN audit_area_master aam ON aam.id = qm.area_of_audit_id AND aam.deleted_at IS NULL
            LEFT JOIN risk_category_master rcm ON rcm.id = qm.risk_category_id AND rcm.deleted_at IS NULL
            LEFT JOIN risk_category_weights rcw ON rcw.risk_category_id = qm.risk_category_id AND rcw.year_id = $1 AND rcw.deleted_at IS NULL
            LEFT JOIN annexure_master anm ON anm.id = qm.annexure_id AND anm.deleted_at IS NULL
            WHERE qm.header_id = ANY($2::int[])
              AND qm.set_id = ANY($3::int[])
              AND qm.deleted_at IS NULL
              ${riskCategoryFilterClause}
            `,
            queryParams
        );

        // Group structures and maps
        const inputTypeMap = {
            1: 'MULTIPLE - OPTION SELECT',
            2: 'YES / NO TYPE - OPTION SELECT',
            3: 'GENERAL QUESTION - ONLY TEXTAREA',
            4: 'ANNEXURE',
            5: 'SUBSET',
        };

        const getRiskLabel = (val: any) => {
            switch (String(val)) {
                case '1': return 'HIGH RISK';
                case '2': return 'MEDIUM RISK';
                case '3': return 'LOW RISK';
                case '4': return 'NO RISK';
                default: return 'NO RISK';
            }
        };

        const getControlRiskLabel = (val: any) => {
            switch (Number(val)) {
                case 1: return 'INTERNAL CONTROL RISK';
                case 2: return 'COMPLIANCE RISK';
                case 3: return 'IT RISK';
                default: return '';
            }
        };

        const getApplicableLabel = (val: any) => {
            switch (Number(val)) {
                case 0: return 'ALL';
                case 1: return 'GENERAL';
                case 2: return 'INDIVIDUAL';
                case 3: return 'NON-INDIVIDUAL';
                case 4: return 'INDIVIDUAL / NON-INDIVIDUAL';
                default: return '';
            }
        };

        const getKeyAspectLabel = (val: any) => {
            const map = {
                1: 'Internal Control by HO',
                2: 'Internal Control by BM',
                3: 'Internal Control by Branch',
                4: 'Compliance of Internal Guidelines',
                5: 'Compliance with Bank Policy',
                6: 'Statutory Compliance',
                7: 'Regulatory Compliance',
                8: 'Logical Access Control',
                9: 'Physical Access Control',
                10: 'Business Continuity Plan',
                11: 'Configuration Controls',
                12: 'Cyber Security Controls',
                13: 'Networking Controls'
            };
            return map[Number(val)] || '';
        };

        // Filter and map questions
        const filteredQuestions: any[] = [];
        for (const q of questions) {
            let paramsArray: any[] = [];
            try {
                paramsArray = typeof q.parameters === 'string' ? JSON.parse(q.parameters || '[]') : (q.parameters || []);
            } catch (e) {
                paramsArray = [];
            }
            if (!Array.isArray(paramsArray)) {
                paramsArray = [];
            }

            // Filter parameter rows by risk level if selected
            if (riskLevels.length > 0) {
                paramsArray = paramsArray.filter(p => {
                    return riskLevels.includes(String(p.br)) || riskLevels.includes(String(p.cr));
                });
                // If question has no parameters matching the risk level filter, exclude the question
                if (paramsArray.length === 0) {
                    continue;
                }
            }

            // If paramsArray is empty and there's no risk level filter, we represent as one empty row element
            const normalizedParams = paramsArray.length > 0 ? paramsArray : [{}];

            const questionRiskRows = normalizedParams.map(p => {
                const brVal = p.br ? Number(p.br) : null;
                const crVal = p.cr ? Number(p.cr) : null;
                const brScore = brVal ? (businessRiskScores.get(brVal) || 0) : 0;
                const crScore = crVal ? (controlRiskScores.get(crVal) || 0) : 0;
                const totalScore = brScore + crScore;
                const totalWeightScore = totalScore * Number(q.risk_weight || 0);

                return {
                    rt: p.rt || '-',
                    brLabel: getRiskLabel(p.br),
                    crLabel: getRiskLabel(p.cr),
                    brScore,
                    crScore,
                    totalScore,
                    totalWeightScore
                };
            });

            filteredQuestions.push({
                id: q.id,
                header_id: q.header_id,
                set_id: q.set_id,
                question: q.question,
                risk_category_name: q.risk_category_name || '-',
                audit_area_name: q.audit_area_name || '-',
                inputType: inputTypeMap[q.option_id] || '-',
                risk_weight: Number(q.risk_weight || 0),
                risk_rows: questionRiskRows,

                // Template formatting extra fields
                annexure_name: q.annexure_name || '',
                subset_name: q.subset_name || '',
                question_type: q.question_type_id === 1 ? 'Qualitative' : (q.question_type_id === 2 ? 'Quantitative' : ''),
                applicable_to: getApplicableLabel(q.applicable_id),
                control_risk_category: getControlRiskLabel(q.control_risk_id),
                key_aspect: getKeyAspectLabel(q.key_aspect_id),
                residual_risk: getRiskLabel(q.residual_risk_id),
                show_instances: q.show_instances !== null ? String(q.show_instances) : '0',
                auditor_evidence: q.audit_ev_upload === 1 ? 'Yes' : 'No',
                compliance_evidence: q.compliance_ev_upload === 1 ? 'Yes' : 'No',
                raw_parameters: paramsArray
            });
        }

        // Now build the tree structure like PHP
        const structuredData: any[] = [];

        for (const menu of menus) {
            const menuCategories = categories.filter(c => Number(c.menu_id) === Number(menu.id));
            const categoryList: any[] = [];
            let menuTotalQuestions = 0;

            for (const cat of menuCategories) {
                const catSetIds = String(cat.question_set_ids || '')
                    .split(',')
                    .map(id => Number(id.trim()))
                    .filter(id => !isNaN(id) && id > 0);

                const setList: any[] = [];
                let catTotalQuestions = 0;

                // Find sets and headers matching this category's set IDs
                const catSetsAndHeaders = setsAndHeaders.filter(sh => catSetIds.includes(Number(sh.set_id)));

                // Group by set_id
                const setGroups = new Map<number, { set_name: string; headers: any[] }>();
                for (const sh of catSetsAndHeaders) {
                    const sid = Number(sh.set_id);
                    if (!setGroups.has(sid)) {
                        setGroups.set(sid, { set_name: sh.set_name, headers: [] });
                    }
                    setGroups.get(sid)!.headers.push({
                        header_id: Number(sh.header_id),
                        header_name: sh.header_name
                    });
                }

                for (const [sid, setGroup] of setGroups.entries()) {
                    const headerList: any[] = [];
                    let setTotalQuestions = 0;

                    for (const header of setGroup.headers) {
                        const headerQuestions = filteredQuestions.filter(q => Number(q.header_id) === header.header_id && Number(q.set_id) === sid);
                        if (headerQuestions.length === 0) {
                            continue;
                        }

                        const count = headerQuestions.length;
                        setTotalQuestions += count;

                        headerList.push({
                            header_id: header.header_id,
                            header_name: header.header_name,
                            questions: headerQuestions,
                            question_count: count
                        });
                    }

                    if (headerList.length > 0) {
                        catTotalQuestions += setTotalQuestions;
                        setList.push({
                            set_id: sid,
                            set_name: setGroup.set_name,
                            headers: headerList,
                            question_count: setTotalQuestions
                        });
                    }
                }

                if (setList.length > 0) {
                    menuTotalQuestions += catTotalQuestions;
                    categoryList.push({
                        category_id: cat.id,
                        category_name: cat.name,
                        sets: setList,
                        total_questions: catTotalQuestions
                    });
                }
            }

            if (categoryList.length > 0) {
                structuredData.push({
                    menu_id: menu.id,
                    menu_name: menu.name,
                    categories: categoryList,
                    total_questions: menuTotalQuestions
                });
            }
        }

        return structuredData;
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
        const businessRiskCategories =
            await this.queryRows(
                `
        SELECT
            id::int AS value,
            risk_category AS label
        FROM risk_category_master
        WHERE deleted_at IS NULL
        ORDER BY risk_category
        `
            );

        const auditAreas =
            await this.queryRows(
                `
        SELECT
            id::int AS value,
            name AS label
        FROM audit_area_master
        WHERE deleted_at IS NULL
        ORDER BY name
        `
            );

        const annexures =
            await this.db.query(`
            SELECT
            id,
            name
            FROM annexure_master
            WHERE deleted_at IS NULL
            AND is_active = 1
            ORDER BY name
        `);

        const subsets =
            await this.db.query(`
            SELECT
            id,
            name
            FROM question_set_master
            WHERE set_type_id = 2
            AND deleted_at IS NULL
            AND is_active = 1
            ORDER BY name
        `);
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

            controlRiskCategories: [
                {
                    label: 'INTERNAL CONTROL RISK',
                    value: 1,
                },

                {
                    label: 'COMPLIANCE RISK',
                    value: 2,
                },

                {
                    label: 'IT RISK',
                    value: 3,
                },
            ],

            keyAspectMappings: {
                1: [
                    {
                        label:
                            'Internal Control by HO',
                        value: 1,
                    },

                    {
                        label:
                            'Internal Control by BM',
                        value: 2,
                    },

                    {
                        label:
                            'Internal Control by Branch',
                        value: 3,
                    },

                    {
                        label:
                            'Compliance of Internal Guidelines',
                        value: 4,
                    },

                    {
                        label:
                            'Compliance with Bank Policy',
                        value: 5,
                    },
                ],

                2: [
                    {
                        label:
                            'Statutory Compliance',
                        value: 6,
                    },

                    {
                        label:
                            'Regulatory Compliance',
                        value: 7,
                    },
                ],

                3: [
                    {
                        label:
                            'Logical Access Control',
                        value: 8,
                    },

                    {
                        label:
                            'Physical Access Control',
                        value: 9,
                    },

                    {
                        label:
                            'Business Continuity Plan',
                        value: 10,
                    },

                    {
                        label:
                            'Configuration Controls',
                        value: 11,
                    },

                    {
                        label:
                            'Cyber Security Controls',
                        value: 12,
                    },

                    {
                        label:
                            'Networking Controls',
                        value: 13,
                    },
                ],
            },

            residualRisks: [
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

            businessRiskCategories,
            auditAreas,
            annexures:
                annexures.rows.map((x) => ({
                    label: x.name,
                    value: Number(x.id),
                })),

            subsets:
                subsets.rows.map((x) => ({
                    label: x.name,
                    value: Number(x.id),
                })),

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
                    label: 'ALL',
                    value: 0,
                },

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


    async findQuestionsByHeader(
        headerId: number,
    ) {
        const rows = await this.queryRows(
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

      rcm.risk_category
        AS risk_category_name,

      aam.name AS audit_area_name

    FROM question_master qm

    LEFT JOIN question_header_master qhm
      ON qhm.id = qm.header_id

    LEFT JOIN question_set_master qsm
      ON qsm.id = qm.set_id

    LEFT JOIN risk_category_master rcm
      ON rcm.id = qm.risk_category_id

    LEFT JOIN audit_area_master aam
      ON aam.id = qm.area_of_audit_id

    WHERE qm.header_id = $1
    AND qm.deleted_at IS NULL

    ORDER BY qm.id DESC
    `,
            [headerId],
        );

        rows.forEach((row: any) => {
            if (row) {
                row.parameters = typeof row.parameters === 'string' ? JSON.parse(row.parameters || '[]') : (row.parameters || []);
            }
        });

        return rows;
    }

    async findOneQuestion(id: number) {
        const row: any = await this.queryOne(
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

        row.parameters = typeof row.parameters === 'string' ? JSON.parse(row.parameters || '[]') : (row.parameters || []);

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
            annexure_id,
            subset_multi_id,

            risk_category_id,

            question_type_id,

            area_of_audit_id,

            control_risk_id,

            key_aspect_id,

            residual_risk_id,

            show_instances,

            option_id,

            applicable_id,

            audit_ev_upload,

            compliance_ev_upload,

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
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18

        )

        RETURNING *
        `,
            [

                data.set_id,

                data.header_id,

                data.question,

                data.annexure_id,

                data.subset_multi_id,

                data.risk_category_id,

                data.question_type_id,

                data.area_of_audit_id,

                data.control_risk_id,

                data.key_aspect_id,

                data.residual_risk_id,

                data.show_instances ?? 0,

                data.option_id,

                data.applicable_id,

                data.audit_ev_upload ?? 0,

                data.compliance_ev_upload ?? 0,

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

      annexure_id = COALESCE(
        $11,
        annexure_id
      ),

      subset_multi_id = COALESCE(
        $12,
        subset_multi_id
      ),

      area_of_audit_id = COALESCE(
        $13,
        area_of_audit_id
        ),

        control_risk_id = COALESCE(
        $14,
        control_risk_id
        ),

        key_aspect_id = COALESCE(
        $15,
        key_aspect_id
        ),

        residual_risk_id = COALESCE(
        $16,
        residual_risk_id
        ),

        show_instances = COALESCE(
        $17,
        show_instances
        ),

        audit_ev_upload = COALESCE(
        $18,
        audit_ev_upload
        ),

        compliance_ev_upload = COALESCE(
        $19,
        compliance_ev_upload
        ),

        parameters = COALESCE(
        $20,
        parameters
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

                data.annexure_id,

                data.subset_multi_id,

                data.area_of_audit_id,

                data.control_risk_id,

                data.key_aspect_id,

                data.residual_risk_id,

                data.show_instances,

                data.audit_ev_upload,

                data.compliance_ev_upload,

                data.parameters,
            ]
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

    async findQuestionsBySet(
        setId: number,
    ) {
        return this.queryRows(
            `
        SELECT

          qm.*,

          qhm.name AS header_name,

          qsm.name AS set_name,

          rcm.risk_category
            AS risk_category_name,

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

          aam.name AS audit_area_name

        FROM question_master qm

        LEFT JOIN question_header_master qhm
          ON qhm.id = qm.header_id

        LEFT JOIN question_set_master qsm
          ON qsm.id = qm.set_id

        LEFT JOIN risk_category_master rcm
          ON rcm.id = qm.risk_category_id

        LEFT JOIN audit_area_master aam
          ON aam.id = qm.area_of_audit_id

        WHERE qm.set_id = $1
        AND qm.deleted_at IS NULL

        ORDER BY qm.id DESC
        `,
            [setId],
        );
    }

    // Question Risk Mapping

    async findRiskMappings(
        questionId: number,
    ) {
        const qm: any = await this.queryOne(
            `
            SELECT question, parameters
            FROM question_master
            WHERE id = $1 AND deleted_at IS NULL
            `,
            [questionId],
        );

        if (!qm) {
            return [];
        }

        let params: any[] = [];
        try {
            params = typeof qm.parameters === 'string' ? JSON.parse(qm.parameters || '[]') : (qm.parameters || []);
        } catch (e) {
            params = [];
        }

        if (!Array.isArray(params)) {
            params = [];
        }

        const brMap = { '1': 'HIGH RISK', '2': 'MEDIUM RISK', '3': 'LOW RISK', '4': 'NO RISK' };
        const crMap = { '1': 'HIGH RISK', '2': 'MEDIUM RISK', '3': 'LOW RISK', '4': 'NO RISK' };

        return params.map((p: any, idx: number) => ({
            id: questionId * 1000 + idx,
            question_id: questionId,
            risk_type: p.rt || '',
            business_risk: brMap[String(p.br)] || 'NO RISK',
            control_risk: crMap[String(p.cr)] || 'NO RISK',
            admin_id: 1,
            question: qm.question,
        }));
    }

    async createRiskMapping(
        data: CreateQuestionRiskMappingDto,
    ) {
        const qm: any = await this.findOneQuestion(data.question_id);

        let params: any[] = qm.parameters || [];
        if (!Array.isArray(params)) {
            params = [];
        }

        if (params.some((p: any) => String(p.rt).toLowerCase().trim() === String(data.risk_type).toLowerCase().trim())) {
            throw new BadRequestException(
                'Risk mapping for this risk type already exists',
            );
        }

        const brMapInverse = { 'HIGH RISK': 1, 'MEDIUM RISK': 2, 'LOW RISK': 3, 'NO RISK': 4 };
        const crMapInverse = { 'HIGH RISK': 1, 'MEDIUM RISK': 2, 'LOW RISK': 3, 'NO RISK': 4 };

        const newParam = {
            rt: data.risk_type.trim(),
            br: String(brMapInverse[data.business_risk] || 4),
            cr: String(crMapInverse[data.control_risk] || 4),
        };

        params.push(newParam);

        await this.queryOne(
            `
            UPDATE question_master
            SET parameters = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id
            `,
            [JSON.stringify(params), data.question_id],
        );

        const newIndex = params.length - 1;

        return {
            id: data.question_id * 1000 + newIndex,
            question_id: data.question_id,
            risk_type: data.risk_type,
            business_risk: data.business_risk,
            control_risk: data.control_risk,
            admin_id: data.admin_id ?? 1,
            question: qm.question,
        };
    }

    async removeRiskMapping(
        id: number,
    ) {
        const questionId = Math.floor(id / 1000);
        const index = id % 1000;

        const qm: any = await this.findOneQuestion(questionId);

        let params: any[] = qm.parameters || [];
        if (!Array.isArray(params)) {
            params = [];
        }

        if (index < 0 || index >= params.length) {
            throw new NotFoundException(
                'Risk mapping not found',
            );
        }

        const removed = params.splice(index, 1)[0];

        await this.queryOne(
            `
            UPDATE question_master
            SET parameters = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id
            `,
            [JSON.stringify(params), questionId],
        );

        const brMap = { '1': 'HIGH RISK', '2': 'MEDIUM RISK', '3': 'LOW RISK', '4': 'NO RISK' };
        const crMap = { '1': 'HIGH RISK', '2': 'MEDIUM RISK', '3': 'LOW RISK', '4': 'NO RISK' };

        return {
            id: id,
            question_id: questionId,
            risk_type: removed.rt || '',
            business_risk: brMap[String(removed.br)] || 'NO RISK',
            control_risk: crMap[String(removed.cr)] || 'NO RISK',
            admin_id: 1,
            question: qm.question,
        };
    }

    private async syncQuestionParameters(
        questionId: number,
    ) {
        return { id: questionId };
    }

    private async validateRiskMapping(
        data: CreateQuestionRiskMappingDto,
    ) {
    }
}
