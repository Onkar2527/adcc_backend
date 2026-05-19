import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import csv from 'csv-parser';

import {
    Readable,
} from 'stream';

import { DatabaseService } from '../../../core/database/database.service';

import { CreateDepositAccountDto, UpdateDepositAccountDto, DepositAccountFilterDto } from './dto/deposit-accounts.dto';

@Injectable()
export class DepositAccountsService {

    constructor(
        private readonly db: DatabaseService,
    ) { }

    async findAll(
        filters: DepositAccountFilterDto,
    ) {

        try {

            const page =
                Number(filters.page || 1);

            const limit =
                Number(filters.limit || 10);

            const offset =
                (page - 1) * limit;

            const conditions: string[] = [
                'dd.deleted_at IS NULL',
            ];

            const params: any[] = [];

            // SEARCH

            if (
                filters.search
                && filters.search_type
            ) {

                params.push(
                    `%${filters.search}%`,
                );

                switch (
                filters.search_type
                ) {

                    case 'account_no':

                        conditions.push(
                            `dd.account_no ILIKE $${params.length}`,
                        );

                        break;

                    case 'account_holder_name':

                        conditions.push(
                            `dd.account_holder_name ILIKE $${params.length}`,
                        );

                        break;

                    case 'ucic':

                        conditions.push(
                            `dd.ucic ILIKE $${params.length}`,
                        );

                        break;
                }
            }

            // BRANCH

            if (filters.branch_id) {

                params.push(
                    Number(
                        filters.branch_id,
                    ),
                );

                conditions.push(
                    `dd.branch_id = $${params.length}`,
                );
            }

            // SCHEME

            if (filters.scheme_id) {

                params.push(
                    Number(
                        filters.scheme_id,
                    ),
                );

                conditions.push(
                    `dd.scheme_id = $${params.length}`,
                );
            }

            // PERIOD FROM

            if (
                filters.period_from
            ) {

                params.push(
                    filters.period_from,
                );

                conditions.push(
                    `dd.upload_period_from <= $${params.length}`,
                );
            }

            // PERIOD TO

            if (
                filters.period_to
            ) {

                params.push(
                    filters.period_to,
                );

                conditions.push(
                    `dd.upload_period_to >= $${params.length}`,
                );
            }

            const whereClause =
                conditions.length
                    ? `WHERE ${conditions.join(
                        ' AND ',
                    )}`
                    : '';

            // TOTAL COUNT

            const countResult =
                await this.db.query(
                    `
          SELECT COUNT(*)::int as total

          FROM dump_deposits dd

          ${whereClause}
          `,
                    params,
                );

            // PAGINATION PARAMS

            params.push(limit);

            params.push(offset);

            // MAIN QUERY

            const result =
                await this.db.query(
                    `
          SELECT

            dd.*,

            aum.name as branch_name,

            sm.name as scheme_name

          FROM dump_deposits dd

          LEFT JOIN audit_unit_master aum
            ON aum.id = dd.branch_id

          LEFT JOIN scheme_master sm
            ON sm.id = dd.scheme_id

          ${whereClause}

          ORDER BY dd.id DESC

          LIMIT $${params.length - 1}

          OFFSET $${params.length}
          `,
                    params,
                );

            return {

                data: result.rows,

                total:
                    countResult.rows[0]
                        ?.total || 0,

                page,

                limit,
            };

        } catch (error) {

            throw new BadRequestException(
                'Failed to fetch deposit accounts',
            );
        }
    }

    async findOne(id: number) {

        try {

            const result =
                await this.db.query(
                    `
          SELECT *

          FROM dump_deposits

          WHERE id = $1

          AND deleted_at IS NULL
          `,
                    [id],
                );

            if (!result.rows.length) {

                throw new NotFoundException(
                    'Deposit account not found',
                );
            }

            return result.rows[0];

        } catch (error) {
            throw error;
        }
    }

    async create(
        data: CreateDepositAccountDto,
    ) {

        try {

            await this.validateDuplicate(
                data.account_no,
            );

            return await this.db.transaction(
                async (client) => {

                    const result =
                        await client.query(
                            `
              INSERT INTO dump_deposits (

                branch_id,

                scheme_id,

                account_no,

                account_holder_name,

                ucic,

                customer_type,

                intrest_rate,

                principal_amount,

                account_opening_date,

                balance,

                balance_date,

                maturity_date,

                maturity_amount,

                close_date,

                account_status,

                sampling_filter,

                assesment_period_id,

                admin_id

              )

              VALUES (

                $1,$2,$3,$4,$5,
                $6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15,
                $16,$17,$18
              )

              RETURNING *
              `,
                            [

                                data.branch_id,

                                data.scheme_id,

                                data.account_no,

                                data.account_holder_name,

                                data.ucic,

                                data.customer_type,

                                data.intrest_rate,

                                data.principal_amount,

                                data.account_opening_date,

                                data.balance,

                                data.balance_date,

                                data.maturity_date,

                                data.maturity_amount,

                                data.close_date,

                                data.account_status,

                                data.sampling_filter ?? 0,

                                data.assesment_period_id,

                                data.admin_id ?? 1,
                            ],
                        );

                    return result.rows[0];
                },
            );

        } catch (error) {
            throw error;
        }
    }

    async update(

        id: number,

        data: UpdateDepositAccountDto,
    ) {

        try {

            const existing = await this.findOne(id);

            if (
                Number(
                    existing.assesment_period_id,
                ) !== 0
            ) {

                throw new BadRequestException(
                    'Assessment already done for this account',
                );
            }

            if (data.account_no) {

                await this.validateDuplicate(
                    data.account_no,
                    id,
                );
            }


            const result =
                await this.db.query(
                    `
          UPDATE dump_deposits

          SET

            branch_id = COALESCE(
              $2,
              branch_id
            ),

            scheme_id = COALESCE(
              $3,
              scheme_id
            ),

            account_no = COALESCE(
              $4,
              account_no
            ),

            account_holder_name = COALESCE(
              $5,
              account_holder_name
            ),

            ucic = COALESCE(
              $6,
              ucic
            ),

            customer_type = COALESCE(
              $7,
              customer_type
            ),

            intrest_rate = COALESCE(
              $8,
              intrest_rate
            ),

            principal_amount = COALESCE(
              $9,
              principal_amount
            ),

            balance = COALESCE(
              $10,
              balance
            ),

            maturity_amount = COALESCE(
              $11,
              maturity_amount
            ),

            account_status = COALESCE(
              $12,
              account_status
            ),

            updated_at = CURRENT_TIMESTAMP

          WHERE id = $1

          RETURNING *
          `,
                    [

                        id,

                        data.branch_id,

                        data.scheme_id,

                        data.account_no,

                        data.account_holder_name,

                        data.ucic,

                        data.customer_type,

                        data.intrest_rate,

                        data.principal_amount,

                        data.balance,

                        data.maturity_amount,

                        data.account_status,
                    ],
                );

            return result.rows[0];

        } catch (error) {
            throw error;
        }
    }

    async remove(id: number) {

        try {

            const existing = await this.findOne(id);

            if (
                Number(
                    existing.sampling_filter,
                ) !== 0
            ) {

                throw new BadRequestException(
                    'Sampled account cannot be deleted',
                );
            }

            const result =
                await this.db.query(
                    `
          UPDATE dump_deposits

          SET
            deleted_at = CURRENT_TIMESTAMP

          WHERE id = $1

          AND deleted_at IS NULL

          RETURNING *
          `,
                    [id],
                );

            if (!result.rows.length) {

                throw new NotFoundException(
                    'Deposit account not found',
                );
            }

            return {
                message:
                    'Deposit account deleted successfully',
            };

        } catch (error) {
            throw error;
        }
    }

    async getUploadDumps() {

        const result =
            await this.db.query(
                `
            SELECT DISTINCT

                TO_CHAR(
                    upload_period_from,
                    'DD-MM-YYYY'
                )

                ||

                ' To '

                ||

                TO_CHAR(
                    upload_period_to,
                    'DD-MM-YYYY'
                )

                AS upload_period,

                TO_CHAR(
                    upload_date,
                    'DD-MM-YYYY HH24:MI'
                ) AS upload_date

            FROM dump_deposits

            WHERE deleted_at IS NULL

            ORDER BY upload_date DESC
            `,
            );

        return result.rows;
    }

    private async validateDuplicate(

        accountNo: string,

        id?: number,
    ) {

        const params: any[] = [
            accountNo,
        ];

        let query = `
      SELECT id

      FROM dump_deposits

      WHERE account_no = $1

      AND deleted_at IS NULL
    `;

        if (id) {

            params.push(id);

            query += `
        AND id != $2
      `;
        }

        const result =
            await this.db.query(
                query,
                params,
            );

        if (result.rows.length) {

            throw new BadRequestException(
                'Account number already exists',
            );
        }
    }

    private formatCsvDate(
        value: string,
    ): string | null {

        if (
            !value
            || value === '31/12/1899'
        ) {

            return null;
        }

        const parts =
            value.split('/');

        if (parts.length !== 3) {
            return null;
        }

        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }


    private parseCsv(
        file: any,
    ): Promise<any[]> {

        return new Promise(
            (resolve, reject) => {

                const results: any[] = [];

                file.file

                    .pipe(csv())

                    .on(
                        'data',
                        (data: { [x: string]: any; }) => {

                            const normalized: any = {};

                            Object.keys(data)
                                .forEach((key) => {

                                    normalized[
                                        key
                                            .trim()
                                            .toLowerCase()
                                            .replace(/\s+/g, '_')
                                    ] =
                                        String(
                                            data[key] || '',
                                        ).trim();
                                });

                            results.push(
                                normalized,
                            );
                        },
                    )

                    .on(
                        'end',
                        () => {

                            resolve(results);
                        },
                    )

                    .on(
                        'error',
                        (err: any) => {

                            reject(err);
                        },
                    );
            },
        );
    }

    private normalizeCode(
        value: any,
    ): string {

        return String(value || '')

            .trim()

            .replace(/^0+/, '')

            .replace(/\.0$/, '');
    }

    async validateUpload(
        file: any,
        payload: any
    ) {

        if (!file) {

            throw new BadRequestException(
                'CSV file is required',
            );
        }

        if (
            !file.filename
                .toLowerCase()
                .endsWith('.csv')
        ) {

            throw new BadRequestException(
                'Only CSV files are allowed',
            );
        }

        const rows =
            await this.parseCsv(file);

        const filteredRows =
            rows.filter(
                (row) => {

                    return Object.values(row)
                        .some(
                            (value) =>

                                String(value || '')
                                    .trim() !== '',
                        );
                },
            );

        if (!filteredRows.length) {

            throw new BadRequestException(
                'CSV file is empty',
            );
        }

        // =========================================
        // PRELOAD BRANCHES
        // =========================================

        const branches =
            await this.db.query(
                `
            SELECT
                id,
                audit_unit_code
            FROM audit_unit_master
            WHERE deleted_at IS NULL
            `,
            );

        const branchMap =
            new Map();

        for (
            const branch
            of branches.rows
        ) {

            branchMap.set(

                this.normalizeCode(branch.audit_unit_code),

                branch.id,
            );
        }

        // =========================================
        // PRELOAD SCHEMES
        // =========================================

        const schemes =
            await this.db.query(
                `
            SELECT
                id,
                scheme_code
            FROM scheme_master
            WHERE deleted_at IS NULL
            `,
            );
        console.log(schemes);

        const schemeMap =
            new Map();

        for (
            const scheme
            of schemes.rows
        ) {

            schemeMap.set(

                this.normalizeCode(
                    scheme.scheme_code,),

                scheme.id,
            );
        }

        // =========================================
        // PRELOAD EXISTING ACCOUNTS
        // =========================================

        const existingAccounts =
            await this.db.query(
                `
            SELECT account_no
            FROM dump_deposits
            WHERE deleted_at IS NULL
            `,
            );

        const existingAccountSet =
            new Set(

                existingAccounts.rows.map(
                    (x: any) =>

                        String(
                            x.account_no,
                        ).trim(),
                ),
            );

        // =========================================
        // COUNTERS
        // =========================================

        let inserted = 0;

        let duplicates = 0;

        let failed = 0;

        const errors: any[] = [];

        const insertValues: any[] = [];

        // =========================================
        // LOOP
        // =========================================

        const duplicateAccounts: string[] = [];

        for (
            let i = 0;
            i < filteredRows.length;
            i++
        ) {

            const row =
                filteredRows[i];

            try {

                // =====================================
                // REQUIRED VALIDATION
                // =====================================

                if (
                    !row.account_no
                    || !row.branch_code
                    || !row.scheme_code
                ) {

                    failed++;

                    errors.push({

                        row: i + 1,

                        error:
                            'Required fields missing',
                    });

                    continue;
                }

                // =====================================
                // OPENING DATE RANGE VALIDATION
                // =====================================

                const openingDate =
                    this.formatCsvDate(
                        row.account_opening_date,
                    );

                const periodFrom =
                    new Date(
                        payload.period_from,
                    );

                const periodTo =
                    new Date(
                        payload.period_to,
                    );

                if (openingDate) {

                    const open =
                        new Date(openingDate);

                    if (
                        open < periodFrom
                        || open > periodTo
                    ) {

                        failed++;

                        errors.push({

                            row: i + 1,

                            error:
                                'Account opening date must be within selected dump period',
                        });

                        continue;
                    }
                }



                // =====================================
                // BRANCH MAP LOOKUP
                // =====================================

                const branchId =
                    branchMap.get(

                        this.normalizeCode(row.branch_code)
                    );

                if (!branchId) {

                    failed++;

                    errors.push({

                        row: i + 1,

                        error:
                            'Invalid branch code',
                    });

                    continue;
                }

                // =====================================
                // SCHEME MAP LOOKUP
                // =====================================

                const schemeId =
                    schemeMap.get(

                        this.normalizeCode(
                            row.scheme_code,
                        )
                    );
                console.log({
                    csv: row.scheme_code,
                    normalized:
                        this.normalizeCode(
                            row.scheme_code,
                        ),
                    exists:
                        schemeMap.has(
                            this.normalizeCode(
                                row.scheme_code,
                            ),
                        ),
                });

                if (!schemeId) {

                    failed++;

                    errors.push({

                        row: i + 1,

                        error:
                            'Invalid scheme code',
                    });

                    continue;
                }

                // =====================================
                // DUPLICATE CHECK
                // =====================================

                const accountNo =
                    String(
                        row.account_no,
                    ).trim();

                if (
                    existingAccountSet.has(
                        accountNo,
                    )
                ) {

                    duplicateAccounts.push(
                        accountNo,
                    );

                    continue;
                }

                // =====================================
                // INSERT
                // =====================================

                insertValues.push([

                    branchId,

                    schemeId,

                    row.account_no,

                    row.account_holder_name,

                    row.ucic,

                    row.customer_type,

                    row.intrest_rate,

                    row.principal_amount,

                    this.formatCsvDate(
                        row.account_opening_date,
                    ),

                    row.balance,

                    this.formatCsvDate(
                        row.balance_date,
                    ),

                    this.formatCsvDate(
                        row.maturity_date,
                    ),

                    row.maturity_amount,

                    this.formatCsvDate(
                        row.close_date,
                    ),

                    row.account_status,

                    new Date(),

                    this.formatCsvDate(
                        row.upload_period_from,
                    ),

                    this.formatCsvDate(
                        row.upload_period_to,
                    ),

                    `UP${Date.now()}`,

                    0,

                    0,

                    1,
                ]);

                // =====================================
                // ADD TO SET
                // =====================================

                existingAccountSet.add(
                    accountNo,
                );

            } catch (err: any) {

                failed++;

                errors.push({

                    row: i + 1,

                    error:
                        err?.message
                        || 'Upload failed',
                });
            }
        }



        return {

            rows:

                filteredRows.map(
                    (
                        row: any,
                        index: number,
                    ) => ({

                        sr_no:
                            index + 1,

                        branch_code:
                            row.branch_code,

                        scheme_code:
                            row.scheme_code,

                        account_no:
                            row.account_no,

                        account_holder_name:
                            row.account_holder_name,

                        status:

                            duplicateAccounts.includes(
                                row.account_no,
                            )

                                ? 'DUPLICATE ACCOUNT NUMBER'

                                : (

                                    errors.find(
                                        (
                                            e: any,
                                        ) =>

                                            e.row === index + 1,
                                    )?.error

                                    || 'VALID'
                                ),
                    }),
                ),

            validRows:
                insertValues,

            hasErrors:

                duplicateAccounts.length > 0
                || errors.length > 0,

            duplicates:
                duplicateAccounts,

            errors,
            errorSummary:

                errors.map(
                    (e: any) => e.error,
                ),
        };
    }


    async addDump(
        rows: any[],
    ) {

        if (!rows.length) {

            throw new BadRequestException(
                'No valid rows found',
            );
        }

        const placeholders: string[] = [];

        const values: any[] = [];

        let paramIndex = 1;

        for (
            const row
            of rows
        ) {

            const rowPlaceholders: string[] = [];

            for (
                const value
                of row
            ) {

                values.push(value);

                rowPlaceholders.push(
                    `$${paramIndex++}`,
                );
            }

            placeholders.push(
                `(${rowPlaceholders.join(',')}, NOW(), NOW())`,
            );
        }

        await this.db.query(
            `
        INSERT INTO dump_deposits (

            branch_id,
            scheme_id,
            account_no,
            account_holder_name,
            ucic,
            customer_type,
            intrest_rate,
            principal_amount,
            account_opening_date,
            balance,
            balance_date,
            maturity_date,
            maturity_amount,
            close_date,
            account_status,
            upload_date,
            upload_period_from,
            upload_period_to,
            upload_key,
            sampling_filter,
            assesment_period_id,
            admin_id,
            created_at,
            updated_at

        )

        VALUES

        ${placeholders.join(',')}
        `,
            values,
        );

        return {

            inserted:
                rows.length,
        };
    }


}