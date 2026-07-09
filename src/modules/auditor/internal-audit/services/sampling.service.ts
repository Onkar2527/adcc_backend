import { BadRequestException, Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InternalAuditService, standardizeNpa, standardizeKyc, getMatchingNpaValues, getMatchingKycValues } from '../internal-audit.service';
import { STATUS_LABELS } from '../internal-audit.constants';

/**
 * SamplingService
 * Encapsulates the accounts sampling engine.
 * Delegates shared DB operations and authorization to InternalAuditService.
 */
@Injectable()
export class SamplingService {
  constructor(
    @Inject(forwardRef(() => InternalAuditService))
    private readonly svc: InternalAuditService,
  ) {}

  async getAccountSampling(
    assessmentId: number,
    categoryId: number,
    employeeId: number,
    filterType = 0,
    primaryValue = '',
    secondaryValue = '',
  ) {
    const detail = await this.svc.getCategory(
      assessmentId,
      categoryId,
      employeeId,
    );

    await this.assertSamplingAllowed(detail);

    const candidateData = await this.getSamplingCandidates(
      detail.category,
      detail.overview,
      filterType,
      primaryValue,
      secondaryValue,
    );

    let npaOptions: string[] = [];
    let kycOptions: string[] = [];

    const linkedTableId = Number(detail.category.linked_table_id);
    if ([1, 2].includes(linkedTableId)) {
      const table = linkedTableId === 1 ? 'dump_deposits' : 'dump_advances';
      const schemeIds =
        linkedTableId === 1
          ? detail.overview.deposits_scheme_ids || ''
          : detail.overview.advances_scheme_ids || '';
      const periodCondition =
        linkedTableId === 1
          ? 'd.account_opening_date BETWEEN $2 AND $3'
          : '(d.account_opening_date BETWEEN $2 AND $3 OR d.renewal_date BETWEEN $2 AND $3)';

      if (String(schemeIds).trim()) {
        if (linkedTableId === 2) {
          const npaRes = await this.svc.db.query(
            `
            SELECT DISTINCT d.npa_classification
            FROM dump_advances d
            INNER JOIN scheme_master sm 
                ON sm.id = d.scheme_id 
                AND sm.scheme_type_id = 2 
                AND sm.category_id = $1 
                AND sm.is_active = 1 
                AND sm.deleted_at IS NULL
            WHERE d.branch_id = $4
              AND d.scheme_id::text = ANY(string_to_array($5, ','))
              AND ${periodCondition}
              AND (COALESCE(d.sampling_filter, 0) = 0 OR d.sampling_filter = 1)
              AND d.deleted_at IS NULL
              AND d.npa_classification IS NOT NULL AND TRIM(d.npa_classification) <> ''
            `,
            [
              categoryId,
              detail.overview.assesment_period_from,
              detail.overview.assesment_period_to,
              detail.overview.audit_unit_id,
              String(schemeIds),
            ],
          );

          const mapped = npaRes.rows.map((r) => standardizeNpa(r.npa_classification)).filter(Boolean);
          npaOptions = Array.from(new Set(mapped)).sort();
        }

        const kycRes = await this.svc.db.query(
          `
          SELECT DISTINCT d.kyc
          FROM ${table} d
          INNER JOIN scheme_master sm 
              ON sm.id = d.scheme_id 
              AND sm.scheme_type_id = $6 
              AND sm.category_id = $1 
              AND sm.is_active = 1 
              AND sm.deleted_at IS NULL
          WHERE d.branch_id = $4
            AND d.scheme_id::text = ANY(string_to_array($5, ','))
            AND ${periodCondition}
            AND (COALESCE(d.sampling_filter, 0) = 0 OR d.sampling_filter = 1)
            AND d.deleted_at IS NULL
            AND d.kyc IS NOT NULL AND TRIM(d.kyc) <> ''
          `,
          [
            categoryId,
            detail.overview.assesment_period_from,
            detail.overview.assesment_period_to,
            detail.overview.audit_unit_id,
            String(schemeIds),
            linkedTableId,
          ],
        );

        const mappedKyc = kycRes.rows.map((r) => standardizeKyc(r.kyc)).filter(Boolean);
        kycOptions = Array.from(new Set(mappedKyc)).sort();
      }
    }

    const filterTypes = [
      {
        id: 1,
        name: 'Block Sampling',
      },
      {
        id: 2,
        name: 'High Value Sampling',
      },
      {
        id: 3,
        name: 'Systematic Sampling - Below 1 Lakh',
      },
      {
        id: 4,
        name: 'Systematic Sampling - 1 to 2 Lakhs',
      },
      {
        id: 5,
        name: 'Systematic Sampling - Above 2 Lakhs',
      },
      ...(linkedTableId === 2
        ? [
            {
              id: 6,
              name: 'NPA Classification',
            },
          ]
        : []),
      {
        id: 7,
        name: 'KYC Status',
      },
    ];

    return {
      overview: detail.overview,
      category: detail.category,
      filter_types: filterTypes,
      npa_options: npaOptions,
      kyc_options: kycOptions,
      candidates: candidateData.accounts.map((row: any) => ({
        id: row.id,
        account_no: row.account_no,
        account_holder_name: row.account_holder_name,
        ucic: row.ucic,
        account_opening_date: row.account_opening_date,
        renewal_date: row.renewal_date,
        balance: Number(row.principal_amount || row.sanction_amount || 0),
        npa_classification: row.npa_classification || '',
        kyc: row.kyc || '',
        scheme_name: row.scheme_name,
        scheme_code: row.scheme_code,
        is_sampled: Number(row.sampling_filter || 0) === 1,
        is_completed: row.is_completed === true || row.is_completed === 'true' || row.is_completed === 1,
        has_answers: row.has_answers === true || row.has_answers === 'true' || row.has_answers === 1,
      })),
      matching_count: candidateData.matching_count,
    };

  }

  async applyAccountSampling(
    assessmentId: number,
    categoryId: number,
    employeeId: number,
    accountIds: number[],
  ) {
    const detail = await this.svc.getCategory(
      assessmentId,
      categoryId,
      employeeId,
    );

    await this.assertSamplingAllowed(detail);

    const table =
      Number(detail.category.linked_table_id) === 1
        ? 'dump_deposits'
        : 'dump_advances';

    const selectedIds = Array.from(
      new Set(
        (Array.isArray(accountIds) ? accountIds : [])
          .map((id: any) => Number(id))
          .filter((id: number) => Number.isInteger(id) && id > 0),
      ),
    );

    await this.svc.db.transaction(
      async (client) => {
        // Clear all previous sampling
        const candidates = await this.getSamplingCandidates(
          detail.category,
          detail.overview,
        );

        const candidateIds = candidates.accounts.map((acc: any) => Number(acc.id));

        if (candidateIds.length) {
          await client.query(
            `
            UPDATE ${table}
            SET sampling_filter = 0
            WHERE id = ANY($1::int[])
                AND (assesment_period_id IS NULL OR assesment_period_id <> $2)
                AND deleted_at IS NULL;
            `,
            [candidateIds, assessmentId],
          );
        }

        if (selectedIds.length) {
          await client.query(
            `
            UPDATE ${table}
            SET sampling_filter = 1
            WHERE id = ANY($1::int[])
                AND deleted_at IS NULL;
            `,
            [selectedIds],
          );
        }

        await this.svc.auditLogService.createLog(
          'SAMPLING_APPLY',
          {
            employeeId,
            auditAssessmentId: assessmentId,
            categoryId,
            accountCount: selectedIds.length,
            description: 'Applied accounts sampling.',
          } as any,
          client,
        );
      },
    );

    return {
      success: true,
      message: 'Sampling applied successfully.',
    };
  }

  async removeAccountSampling(
    assessmentId: number,
    categoryId: number,
    dumpId: number,
    employeeId: number,
  ) {
    const detail = await this.svc.getCategory(
      assessmentId,
      categoryId,
      employeeId,
    );

    await this.assertSamplingAllowed(detail);
    this.assertAccountSelection(detail);

    // This is checking the specific account selected from detail to remove.
    // In remove sampling, the dumpId refers to the account to remove.
    const table =
      Number(detail.category.linked_table_id) === 1
        ? 'dump_deposits'
        : 'dump_advances';

    // We need to fetch the specific account to verify it exists and is not completed
    const account = await this.svc.db.findOne(
      `
      SELECT id, assesment_period_id, sampling_filter
      FROM ${table}
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1;
      `,
      [dumpId],
    );

    if (!account) {
      throw new NotFoundException('Account not found.');
    }

    if (Number(account.assesment_period_id || 0)) {
      throw new BadRequestException('Completed account sampling cannot be removed.');
    }

    await this.svc.db.transaction(
      async (client) => {
        await client.query(
          `
          UPDATE ${table}
          SET sampling_filter = 0
          WHERE id = $1;
          `,
          [dumpId],
        );

        await this.svc.auditLogService.createLog(
          'SAMPLING_REMOVE',
          {
            employeeId,
            auditAssessmentId: assessmentId,
            categoryId,
            dumpId,
            description: 'Removed account sampling.',
          } as any,
          client,
        );
      },
    );

    return {
      success: true,
      message: 'Sampling removed successfully.',
    };
  }

  /** @internal */ async getUnsampledAccountCount(
    category: any,
    overview: any,
  ): Promise<number> {
    const linkedTableId = Number(category.linked_table_id);
    if (![1, 2].includes(linkedTableId)) {
      return 0;
    }

    const table = linkedTableId === 1 ? 'dump_deposits' : 'dump_advances';
    const periodCondition =
      linkedTableId === 1
        ? 'd.account_opening_date BETWEEN $3 AND $4'
        : '(d.account_opening_date BETWEEN $3 AND $4 OR d.renewal_date BETWEEN $3 AND $4)';

    const schemeIds =
      linkedTableId === 1
        ? overview.deposits_scheme_ids || ''
        : overview.advances_scheme_ids || '';

    if (!String(schemeIds).trim()) {
      return 0;
    }

    const result = await this.svc.db.findOne(
      `
      SELECT COUNT(*)::int AS count
      FROM ${table} d
      INNER JOIN scheme_master sm
          ON sm.id = d.scheme_id
          AND sm.scheme_type_id = $1
          AND sm.category_id = $2
          AND sm.is_active = 1
          AND sm.deleted_at IS NULL
      WHERE d.branch_id = $5
          AND d.scheme_id::text = ANY(string_to_array($6, ','))
          AND ${periodCondition}
          AND COALESCE(d.sampling_filter, 0) = 0
          AND d.deleted_at IS NULL;
      `,
      [
        linkedTableId,
        category.id,
        overview.assesment_period_from,
        overview.assesment_period_to,
        overview.audit_unit_id,
        String(schemeIds),
      ],
    );

    return Number(result?.count || 0);
  }


  /** @internal */ async getSamplingCandidates(
    category: any,
    overview: any,
    filterType = 0,
    primaryValue = '',
    secondaryValue = '',
  ) {
    const linkedTableId = Number(category.linked_table_id);

    if (![1, 2].includes(linkedTableId)) {
      throw new BadRequestException('Sampling is available only for account-based categories.');
    }

    if (filterType && ![1, 2, 3, 4, 5, 6, 7].includes(filterType)) {
      throw new BadRequestException('Select a valid sampling filter.');
    }

    if (filterType === 6 && linkedTableId !== 2) {
      throw new BadRequestException('NPA Classification filter is available only for Advances.');
    }

    if ([6, 7].includes(filterType) && !String(primaryValue).trim()) {
      throw new BadRequestException('Please select a filter value.');
    }

    if (
      filterType === 1 &&
      (!String(primaryValue).trim() || !String(secondaryValue).trim())
    ) {
      throw new BadRequestException('Enter from and to account numbers for block sampling.');
    }

    const percentage = Number(primaryValue);

    if (
      [2, 3, 4, 5].includes(filterType) &&
      (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100)
    ) {
      throw new BadRequestException('Enter a sampling percentage between 1 and 100.');
    }

    const table = linkedTableId === 1 ? 'dump_deposits' : 'dump_advances';

    const amountColumn = linkedTableId === 1 ? 'd.principal_amount' : 'd.sanction_amount';
    const amountAlias = linkedTableId === 1 ? 'principal_amount' : 'sanction_amount';
    const renewalColumn = linkedTableId === 1 ? 'NULL::date AS renewal_date' : 'd.renewal_date';

    const periodCondition =
      linkedTableId === 1
        ? 'd.account_opening_date BETWEEN $3 AND $4'
        : '(d.account_opening_date BETWEEN $3 AND $4 OR d.renewal_date BETWEEN $3 AND $4)';

    const schemeIds =
      linkedTableId === 1
        ? overview.deposits_scheme_ids || ''
        : overview.advances_scheme_ids || '';

    if (!String(schemeIds).trim()) {
      return {
        accounts: [],
        matching_count: 0,
      };
    }

    let filterClause = '';
    const params: any[] = [
      linkedTableId,
      category.id,
      overview.assesment_period_from,
      overview.assesment_period_to,
      overview.audit_unit_id,
      String(schemeIds),
      overview.id, // $7
    ];

    if (filterType === 1) {
      filterClause = ' AND d.account_no BETWEEN $8 AND $9';
      params.push(String(primaryValue).trim(), String(secondaryValue).trim());
    } else if (filterType === 3) {
      filterClause = ` AND ${amountColumn} < 100000`;
    } else if (filterType === 4) {
      filterClause = ` AND ${amountColumn} BETWEEN 100000 AND 200000`;
    } else if (filterType === 5) {
      filterClause = ` AND ${amountColumn} > 200000`;
    } else if (filterType === 6) {
      const selectedCategory = String(primaryValue).trim();
      const npaValues = getMatchingNpaValues(selectedCategory);
      filterClause = ' AND UPPER(TRIM(d.npa_classification)) = ANY($8::text[])';
      params.push(npaValues.map((v) => v.toUpperCase()));
    } else if (filterType === 7) {
      const selectedStatus = String(primaryValue).trim();
      const kycValues = getMatchingKycValues(selectedStatus);
      filterClause = ' AND UPPER(TRIM(d.kyc)) = ANY($8::text[])';
      params.push(kycValues.map((v) => v.toUpperCase()));
    }

    const npaSelect = linkedTableId === 1 ? 'NULL::text AS npa_classification' : 'd.npa_classification';

    const result = await this.svc.db.query(
      `
      SELECT
          d.id,
          d.account_no,
          d.account_holder_name,
          d.ucic,
          d.account_opening_date,
          ${renewalColumn},
          ${amountColumn} AS ${amountAlias},
          ${npaSelect},
          d.kyc,
          sm.name AS scheme_name,
          sm.scheme_code,
          COALESCE(d.sampling_filter, 0) AS sampling_filter,
          CASE
              WHEN COALESCE(d.sampling_filter, 0) = 1 AND d.assesment_period_id = $7 THEN true
              ELSE false
          END AS is_completed,
          EXISTS (
              SELECT 1
              FROM answers_data ad
              WHERE ad.assesment_id = $7
                  AND ad.category_id = $2
                  AND d.id = ad.dump_id
                  AND ad.deleted_at IS NULL
          ) AS has_answers
      FROM ${table} d
      INNER JOIN scheme_master sm
          ON sm.id = d.scheme_id
          AND sm.scheme_type_id = $1
          AND sm.category_id = $2
          AND sm.is_active = 1
          AND sm.deleted_at IS NULL
      WHERE d.branch_id = $5
          AND d.scheme_id::text = ANY(
              string_to_array($6, ',')
          )
          AND ${periodCondition}
          AND (COALESCE(d.sampling_filter, 0) = 0 OR d.sampling_filter = 1)
          AND d.deleted_at IS NULL
          ${filterClause}
      ORDER BY
          NULLIF(${amountColumn}::text, '')::numeric DESC NULLS LAST,
          d.account_no;
      `,
      params,
    );

    const standardizedRows = result.rows.map((row) => ({
      ...row,
      npa_classification: standardizeNpa(row.npa_classification),
      kyc: standardizeKyc(row.kyc),
    }));

    const matchingCount = standardizedRows.length;

    const accounts = [2, 3, 4, 5].includes(filterType)
      ? standardizedRows.slice(0, Math.max(1, Math.ceil((matchingCount * percentage) / 100)))
      : standardizedRows;

    return {
      accounts,
      matching_count: matchingCount,
    };
  }

  /** @internal */ async getSampledAccounts(
    category: any,
    overview: any,
  ) {
    const linkedTableId = Number(category.linked_table_id);

    if (![1, 2].includes(linkedTableId)) {
      return [];
    }

    const table = linkedTableId === 1 ? 'dump_deposits' : 'dump_advances';

    const schemeIds =
      linkedTableId === 1
        ? overview.deposits_scheme_ids || ''
        : overview.advances_scheme_ids || '';

    if (!String(schemeIds).trim()) {
      return [];
    }

    const periodCondition =
      linkedTableId === 1
        ? 'd.account_opening_date BETWEEN $4 AND $5'
        : '(d.account_opening_date BETWEEN $4 AND $5 OR d.renewal_date BETWEEN $4 AND $5)';

    const amountColumn = linkedTableId === 1 ? 'd.principal_amount' : 'd.sanction_amount';
    const amountAlias = linkedTableId === 1 ? 'principal_amount' : 'sanction_amount';
    const renewalColumn = linkedTableId === 1 ? 'NULL::date AS renewal_date' : 'd.renewal_date';
    const npaSelect = linkedTableId === 1 ? 'NULL::text AS npa_classification' : 'd.npa_classification';

    const result = await this.svc.db.query(
      `
      SELECT
          d.id,
          d.account_no,
          d.account_holder_name,
          d.ucic,
          d.account_opening_date,
          d.account_status,
          d.assesment_period_id,
          ${renewalColumn},
          ${amountColumn} AS ${amountAlias},
          ${npaSelect},
          d.kyc,
          sm.name AS scheme_name,
          sm.scheme_code,
          CASE
              WHEN d.assesment_period_id = $1 THEN true
              ELSE false
          END AS is_completed
      FROM ${table} d
      INNER JOIN scheme_master sm
          ON sm.id = d.scheme_id
          AND sm.scheme_type_id = $2
          AND sm.category_id = $3
          AND sm.is_active = 1
          AND sm.deleted_at IS NULL
      WHERE d.branch_id = $6
          AND d.scheme_id::text = ANY(
              string_to_array($7, ',')
          )
          AND ${periodCondition}
          AND d.sampling_filter = 1
          AND d.deleted_at IS NULL
      ORDER BY d.account_no;
      `,
      [
        overview.id,
        linkedTableId,
        category.id,
        overview.assesment_period_from,
        overview.assesment_period_to,
        overview.audit_unit_id,
        String(schemeIds),
      ],
    );

    return result.rows.map((row) => ({
      ...row,
      npa_classification: standardizeNpa(row.npa_classification),
      kyc: standardizeKyc(row.kyc),
    }));
  }

  /** @internal */ assertAccountSelection(
    detail: any,
  ) {
    if (
      [1, 2].includes(
        Number(
          detail?.category?.linked_table_id,
        ),
      )
      &&
      !detail?.selected_account
    ) {
      throw new BadRequestException(
        'Select a sampled account before saving audit data.',
      );
    }
  }

  /** @internal */ async assertSamplingAllowed(
    detail: any,
  ) {
    if (
      ![1, 2].includes(
        Number(
          detail?.category?.linked_table_id,
        ),
      )
    ) {
      throw new BadRequestException(
        'Sampling is available only for account-based categories.',
      );
    }

    if (
      Number(
        detail?.overview?.audit_status_id || 0,
      ) !== 1
    ) {
      throw new BadRequestException(
        'Sampling is not allowed at this stage.',
      );
    }
  }

  async completeAccountAssessment(
    assessmentId: number,
    categoryId: number,
    dumpId: number,
    employeeId: number,
  ) {
    const detail = await this.svc.getCategory(
      assessmentId,
      categoryId,
      employeeId,
    );

    const selectedAccount = detail.accounts?.find(
      (account: any) => Number(account.id) === dumpId,
    );

    if (!selectedAccount) {
      throw new BadRequestException('Account assessment not found.');
    }

    const table =
      Number(detail.category.linked_table_id) === 1
        ? 'dump_deposits'
        : 'dump_advances';

    await this.svc.db.query(
      `
      UPDATE ${table}
      SET assesment_period_id = $1
      WHERE id = $2
          AND sampling_filter = 1
          AND deleted_at IS NULL;
      `,
      [assessmentId, dumpId],
    );

    return {
      success: true,
      message: 'Account assessment marked complete successfully.',
    };
  }

  async completeRemainingAccountAssessments(
    assessmentId: number,
    categoryId: number,
    employeeId: number,
  ) {
    const detail = await this.svc.getCategory(
      assessmentId,
      categoryId,
      employeeId,
    );

    const accounts = await this.getSampledAccounts(
      detail.category,
      detail.overview,
    );

    const remainingAccounts = accounts.filter(
      (account: any) => !account.is_completed,
    );

    if (!remainingAccounts.length) {
      return {
        success: true,
        message: 'No remaining sampled accounts are pending for completion.',
        completed_count: 0,
      };
    }

    const table =
      Number(detail.category.linked_table_id) === 1
        ? 'dump_deposits'
        : 'dump_advances';

    const accountIds = remainingAccounts.map((account: any) => Number(account.id));

    await this.svc.db.query(
      `
      UPDATE ${table}
      SET assesment_period_id = $1
      WHERE id = ANY($2::int[])
          AND sampling_filter = 1
          AND deleted_at IS NULL;
      `,
      [assessmentId, accountIds],
    );

    return {
      success: true,
      message: `${accountIds.length} remaining account assessment(s) marked complete.`,
      completed_count: accountIds.length,
    };
  }
}
