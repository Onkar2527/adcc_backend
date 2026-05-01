import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { IdService } from '../../core/id/id.service';

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly idService: IdService,
  ) { }

  async findAll() {
    const query = `
      SELECT 
        id, is_existing_customer, customer_id_or_pan, applicant_name, gender,
        education, dob, age, pan_number, grading, aadhaar_number, mid_number,
        ckyc_number, email_id, mobile_no, loan_type, requested_amount,
        requested_amount_words, reason_of_loan, status, verification_metadata, created_at, updated_at
      FROM proposals
      ORDER BY created_at DESC
    `;
    const result = await this.db.query(query);
    return result.rows;
  }

  async create(data: any) {
    const { customerIdentity, applicantDetails, loanDetails } = data;
    const id = this.idService.generate();

    const query = `
      INSERT INTO proposals (
        id, is_existing_customer, customer_id_or_pan, 
        applicant_name, gender, education, dob, age, 
        pan_number, grading, aadhaar_number, mid_number, ckyc_number, email_id, mobile_no, 
        loan_type, requested_amount, requested_amount_words, reason_of_loan,
        status, verification_metadata
      ) VALUES (
        $1, $2, $3, 
        $4, $5, $6, $7, $8, 
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21
      ) RETURNING *
    `;

    const values = [
      id,
      customerIdentity?.isExistingCustomer ?? false,
      customerIdentity?.customerIdOrPan ?? null,
      applicantDetails?.applicantName,
      applicantDetails?.gender ?? null,
      applicantDetails?.education ?? null,
      applicantDetails?.dob ? new Date(applicantDetails.dob) : null,
      applicantDetails?.age ?? null,
      applicantDetails?.panNumber,
      applicantDetails?.grading ?? null,
      applicantDetails?.aadhaarNumber ?? null,
      applicantDetails?.midNumber ?? null,
      applicantDetails?.ckycNumber ?? null,
      applicantDetails?.emailId ?? null,
      applicantDetails?.mobileNo ?? null,
      loanDetails?.loan_type,
      loanDetails?.requested_amount,
      loanDetails?.requested_amount_words ?? null,
      loanDetails?.reason_of_loan ?? null,
      'Pending',
      data.verification_metadata ?? null
    ];

    return await this.db.transaction(async (client) => {
      const result = await client.query(query, values);
      const proposalId = result.rows[0].id;

      // Initialize all active tabs for a new proposal
      const masterQuery = `SELECT id, key, sort_order FROM tab_master WHERE is_active = TRUE`;
      const tabMasterResult = await client.query(masterQuery);

      for (const row of tabMasterResult.rows) {
        const mappingId = this.idService.generate();
        const isFilled = ['personal', 'loan'].includes(row.key); // These are provided in the creation payload
        await client.query(
          `INSERT INTO proposal_tab_mapping (id, proposal_id, tab_id, sort_order, is_filled) VALUES ($1, $2, $3, $4, $5)`,
          [mappingId, proposalId, row.id, row.sort_order, isFilled]
        );
      }

      return result.rows[0];
    });
  }

  async getPersonalInfo(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    let query: string;
    let params: any[];

    if (entityType === 'B') {
      query = `
        SELECT 
          p.applicant_name, p.gender, p.dob, p.age, p.education, p.pan_number, p.aadhaar_number, p.email_id, p.mobile_no,
          p.verification_metadata,
          pi.*
        FROM proposals p
        LEFT JOIN proposal_personal_info pi ON p.id = pi.proposal_id AND pi.entity_type = 'B'
        WHERE p.id = $1
      `;
      params = [proposalId];
    } else {
      query = `
        SELECT 
          pp.name as applicant_name, pp.phone as mobile_no, pp.email as email_id,
          pp.gender, pp.dob, pp.pan_number, pp.aadhaar_number, pp.age,
          pp.verification_metadata,
          pi.*
        FROM proposal_participants pp
        LEFT JOIN proposal_personal_info pi ON pp.id = pi.participant_id
        WHERE pp.id = $1 AND pp.entity_type = $2
      `;
      params = [participantId, entityType];
    }

    const result = await this.db.query(query, params);
    return result.rows[0] || null;
  }

  async updatePersonalInfo(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    if (!data) return null;

    return await this.db.transaction(async (client) => {
      // 1. Update Base Fields (if Borrower, update proposals; if Participant, update proposal_participants)
      if (entityType === 'B') {
        const updateProposalsQuery = `
          UPDATE proposals SET
            applicant_name = $2, gender = $3, dob = $4, age = $5,
            pan_number = $6, aadhaar_number = $7, email_id = $8, 
            mobile_no = $9, education = $10
          WHERE id = $1
        `;
        const proposalValues = [
          proposalId,
          data.applicant_name,
          data.gender ?? null,
          data.dob ? new Date(data.dob) : null,
          data.age ?? null,
          data.pan_number,
          data.aadhaar_number ?? null,
          data.email_id ?? null,
          data.mobile_no,
          data.education ?? null
        ];
        await client.query(updateProposalsQuery, proposalValues);
      } else {
        const updateParticipantsQuery = `
          UPDATE proposal_participants SET
            name = $2, phone = $3, email = $4, 
            gender = $5, dob = $6, pan_number = $7, aadhaar_number = $8, age = $9,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `;
        await client.query(updateParticipantsQuery, [
          participantId,
          data.applicant_name,
          data.mobile_no,
          data.email_id,
          data.gender ?? null,
          data.dob ? new Date(data.dob) : null,
          data.pan_number ?? null,
          data.aadhaar_number ?? null,
          data.age ?? null
        ]);
      }

      // 2. Upsert Detailed Fields in `proposal_personal_info`
      const whereClause = entityType === 'B'
        ? 'proposal_id = $1 AND entity_type = \'B\''
        : 'participant_id = $1';

      const checkQuery = `SELECT id FROM proposal_personal_info WHERE ${whereClause}`;
      const existing = await client.query(checkQuery, [entityType === 'B' ? proposalId : participantId]);

      const commonFields = `
        religion, cast_name, education, marital_status,
        is_bank_member, member_type, membership_date, member_no, bank_shares_amount,
        family_members_count, earners_out_of_them, net_worth_amount, net_worth_date,
        profession, relation_with_director, mobile_no_2, full_address
      `;
      const commonValues = [
        data.religion ?? null,
        data.cast ?? null,
        data.education ?? null,
        data.marital_status ?? null,
        data.is_bank_member ?? false,
        data.member_type ?? null,
        data.membership_date ? new Date(data.membership_date) : null,
        data.member_no ?? null,
        data.bank_shares_amount ?? 0,
        data.family_members_count ?? 0,
        data.earners_count ?? 0,
        data.net_worth_amount ?? 0,
        data.net_worth_date ? new Date(data.net_worth_date) : null,
        data.profession ?? null,
        data.relation_with_director ?? null,
        data.mobile_no_2 ?? null,
        data.full_address ?? null
      ];

      if (existing.rowCount === 0) {
        const insertQuery = `
          INSERT INTO proposal_personal_info (
            proposal_id, entity_type, participant_id, ${commonFields}
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
          ) RETURNING *
        `;
        const insertValues = [
          proposalId,
          entityType,
          participantId,
          ...commonValues
        ];
        await client.query(insertQuery, insertValues);
        return await this.getPersonalInfo(proposalId, entityType, participantId);
      } else {
        const updateQuery = `
          UPDATE proposal_personal_info SET
            religion = $2, cast_name = $3, education = $4, marital_status = $5, 
            is_bank_member = $6, member_type = $7, membership_date = $8, member_no = $9, 
            bank_shares_amount = $10, family_members_count = $11, earners_out_of_them = $12, 
            net_worth_amount = $13, net_worth_date = $14, profession = $15, 
            relation_with_director = $16, mobile_no_2 = $17, full_address = $18,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING *
        `;
        const updateValues = [
          existing.rows[0].id,
          ...commonValues
        ];
        const res = await client.query(updateQuery, updateValues);

        await this.markTabAsFilledInternal(client, proposalId, 'personal', entityType, participantId);

        // Return the full merged info
        return await this.getPersonalInfo(proposalId, entityType, participantId);
      }
    });
  }

  async getLoanInfo(proposalId: string) {
    const query = `SELECT * FROM proposal_loan_info WHERE proposal_id = $1`;
    const result = await this.db.query(query, [proposalId]);
    let loanInfo = result.rows[0] || null;

    // Fallback to base proposals table if detailed info hasn't been saved yet
    if (!loanInfo) {
      const baseQuery = `
        SELECT loan_type, requested_amount, requested_amount_words, reason_of_loan 
        FROM proposals WHERE id = $1
      `;
      const baseResult = await this.db.query(baseQuery, [proposalId]);
      if (baseResult.rowCount > 0) {
        loanInfo = {
          ...baseResult.rows[0],
          has_moratorium: false,
          has_insurance: false,
          is_participation_loan: false,
          participation_details: []
        };
      }
    }

    if (loanInfo && loanInfo.is_participation_loan && !loanInfo.participation_details) {
      const partQuery = `SELECT * FROM proposal_loan_participation WHERE proposal_id = $1 ORDER BY created_at ASC`;
      const partResult = await this.db.query(partQuery, [proposalId]);
      loanInfo.participation_details = partResult.rows;
    }

    return loanInfo;
  }

  async updateLoanInfo(proposal_id: string, data: any) {
    if (!data) return null;

    return await this.db.transaction(async (client) => {
      // 1. Upsert Main Loan Info
      const existing = await client.query(`SELECT 1 FROM proposal_loan_info WHERE proposal_id = $1`, [proposal_id]);

      let res;
      if (existing.rowCount === 0) {
        const query = `
          INSERT INTO proposal_loan_info (
            proposal_id, loan_type, reason_of_loan, requested_amount, 
            requested_amount_words, installment_type, duration_months, 
            interest_rate, monthly_installment,
            has_moratorium, moratorium_period, has_insurance,
            insurance_amount, total_requested_amount, is_participation_loan
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
          ) RETURNING *
        `;
        const values = [
          proposal_id,
          data.loan_type ?? null,
          data.reason_of_loan ?? null,
          data.requested_amount ?? 0,
          data.requested_amount_words ?? null,
          data.installment_type ?? null,
          data.duration_months ?? 0,
          data.interest_rate ?? 0,
          data.monthly_installment ?? 0,
          data.has_moratorium ?? false,
          data.moratorium_period ?? null,
          data.has_insurance ?? false,
          data.insurance_amount ?? 0,
          data.total_requested_amount ?? 0,
          data.is_participation_loan ?? false
        ];
        res = await client.query(query, values);
      } else {
        const query = `
          UPDATE proposal_loan_info SET
            loan_type = $2, reason_of_loan = $3, requested_amount = $4, 
            requested_amount_words = $5, installment_type = $6, 
            duration_months = $7, interest_rate = $8, monthly_installment = $9,
            has_moratorium = $10, moratorium_period = $11, has_insurance = $12,
            insurance_amount = $13, total_requested_amount = $14, is_participation_loan = $15,
            updated_at = CURRENT_TIMESTAMP
          WHERE proposal_id = $1
          RETURNING *
        `;
        const values = [
          proposal_id,
          data.loan_type ?? null,
          data.reason_of_loan ?? null,
          data.requested_amount ?? 0,
          data.requested_amount_words ?? null,
          data.installment_type ?? null,
          data.duration_months ?? 0,
          data.interest_rate ?? 0,
          data.monthly_installment ?? 0,
          data.has_moratorium ?? false,
          data.moratorium_period ?? null,
          data.has_insurance ?? false,
          data.insurance_amount ?? 0,
          data.total_requested_amount ?? 0,
          data.is_participation_loan ?? false
        ];
        res = await client.query(query, values);
      }

      // 2. Sync Participation details
      await client.query(`DELETE FROM proposal_loan_participation WHERE proposal_id = $1`, [proposal_id]);

      if (data.is_participation_loan && data.participation_details && Array.isArray(data.participation_details)) {
        for (const part of data.participation_details) {
          const id = part.id || this.idService.generate();
          const pQuery = `
            INSERT INTO proposal_loan_participation (
              id, proposal_id, bank_name, role, loan_type, 
              sanctioned_amount, outstanding_amount, share_percent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `;
          const pValues = [
            id, proposal_id, part.bank_name, part.role, part.loan_type,
            part.sanctioned_amount ?? 0, part.outstanding_amount ?? 0, part.share_percent ?? 0
          ];
          await client.query(pQuery, pValues);
        }
      }

      // Mark tab as filled
      await this.markTabAsFilledInternal(client, proposal_id, 'loan');

      return res.rows[0];
    });
  }

  async getBankScheme(proposalId: string) {
    const query = `
      SELECT 
        loan_type, bank_loan_scheme_type, industry_marking, 
        priority_sector_marking, weaker_sector, real_estate_marking, 
        priority_code, weaker_code, real_estate_code
      FROM proposal_bank_scheme 
      WHERE proposal_id = $1
    `;
    const res = await this.db.query(query, [proposalId]);
    return res.rows[0] || null;
  }

  async updateBankScheme(proposalId: string, data: any) {
    return await this.db.transaction(async (client) => {
      const query = `
        INSERT INTO proposal_bank_scheme (
          proposal_id, bank_loan_scheme_type, industry_marking, 
          priority_sector_marking, weaker_sector, real_estate_marking, 
          priority_code, weaker_code, real_estate_code, loan_type,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP
        )
        ON CONFLICT (proposal_id) DO UPDATE SET
          bank_loan_scheme_type = EXCLUDED.bank_loan_scheme_type,
          industry_marking = EXCLUDED.industry_marking,
          priority_sector_marking = EXCLUDED.priority_sector_marking,
          weaker_sector = EXCLUDED.weaker_sector,
          real_estate_marking = EXCLUDED.real_estate_marking,
          priority_code = EXCLUDED.priority_code,
          weaker_code = EXCLUDED.weaker_code,
          real_estate_code = EXCLUDED.real_estate_code,
          loan_type = EXCLUDED.loan_type,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const values = [
        proposalId,
        data.bank_loan_scheme_type || null,
        data.industry_marking || null,
        data.priority_sector_marking || null,
        data.weaker_sector || null,
        data.real_estate_marking || null,
        data.priority_code || null,
        data.weaker_code || null,
        data.real_estate_code || null,
        data.loan_type || null
      ];
      const res = await client.query(query, values);

      // Mark tab as filled
      await this.markTabAsFilledInternal(client, proposalId, 'bank_scheme');

      return res.rows[0];
    });
  }

  async getProperties(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    // Sanitize inputs to prevent bigint/integer type errors
    const sanitizedProposalId = (proposalId === '' || proposalId === 'null' || proposalId === 'undefined') ? null : proposalId;
    const sanitizedParticipantId = (participantId === '' || participantId === 'null' || participantId === 'undefined') ? null : participantId;

    const whereClause = entityType === 'B'
      ? 'proposal_id = $1 AND entity_type = \'B\''
      : 'participant_id = $1';
    const query = `
      SELECT * FROM proposal_property_info 
      WHERE ${whereClause}
      ORDER BY created_at ASC
    `;
    const result = await this.db.query(query, [entityType === 'B' ? sanitizedProposalId : sanitizedParticipantId]);

    const properties = result.rows;
    return properties;
  }

  async getMachineryInfo(proposalId: string) {
    const query = `
      SELECT * FROM proposal_machinery_info 
      WHERE proposal_id = $1
      ORDER BY created_at ASC
    `;
    const res = await this.db.query(query, [proposalId]);
    return res.rows;
  }

  async getHigherPurchaseData(proposalId: string) {
    const query = `SELECT * FROM higher_purchase_loan_data WHERE proposal_id = $1`;
    const res = await this.db.query(query, [proposalId]);
    return res.rows[0] || null;
  }


  async getloanApplicationData(proposalId: string) {
    const query = `SELECT
  p.applicant_name AS applicant_name,
	p.age AS age,
	p.mobile_no AS applicant_mobile_no,
	p.email_id AS applicant_email_id,
	pp.religion AS religion,
	pp.cast_name AS cast_name,
    pp.member_no AS member_no,
	p.pan_number AS pan_number,
	pib.business_address AS bussiness_address,
	pib.contact_no AS bussiness_contact,
  pib.pan_number AS business_pan_number,
	pib.email_id AS bussiness_email_id,
	pib.nature_of_business AS nature_of_business,
	pib.msme_registration_number AS msme_registration_number,
	pib.shop_act_number AS shop_act_number,
	pp.full_address AS applicant_address,
	pfi.itr_financial_year AS itr_financial_year,
    pli.reason_of_loan AS reason_of_loan,
    pli.requested_amount AS requented_amount,
    pli.requested_amount_words AS requested_amount_words,
    pib.firm_name AS firm_name,
    pib.license_owner_name AS license_owner_name,
    pp.full_address AS full_address,
	bfin.finaciational_info AS finaciational_info,
    gn.guarantor_name,
	cltb.credit_loans_this_bank AS credit_loans_this_bank,
	cgob.credit_guarantees_other_banks,
    cgtb.credit_guarantees_this_bank,
	clob.credit_loans_other_banks ,
	caob.credit_accounts_other_banks,
	cco.co_borrower_info
FROM proposals p 

LEFT JOIN proposal_personal_info pp 
    ON p.id = pp.proposal_id 
    AND pp.entity_type = 'B'


LEFT JOIN proposal_loan_info pli 
    ON pli.proposal_id = p.id

LEFT JOIN proposal_income_business pib 
    ON pib.proposal_id = p.id 
    AND pib.entity_type = 'B'
	
left join proposal_financial_info pfi
   on pfi.proposal_id=p.id
   AND pfi.entity_type='B'
LEFT JOIN (
    SELECT 
        business_id,
        json_agg(
            json_build_object(
                'year_label', year_label,
                'sales', sales,
				'purchases',purchases,
				'net_profit',net_profit,
				'investments',investments,
				'depreciation',depreciation
            )
        ) AS finaciational_info
    FROM proposal_income_business_financials 
    GROUP BY business_id
) bfin
ON bfin.business_id = pib.id

LEFT JOIN (
    SELECT 
        pp.proposal_id,
        json_agg(
            json_build_object(
                'NAME', p.applicant_name,
                'MEMBER_NO', pp.member_no
            )
        ) AS guarantor_name
    FROM proposals p left join  proposal_personal_info pp on pp.proposal_id=p.id
    WHERE pp.entity_type = 'G'
    GROUP BY pp.proposal_id
) gn
 
ON gn.proposal_id = p.id

left join proposal_credit_info pci on pci.proposal_id=p.id AND pci.entity_type='B'
LEFT JOIN (
    SELECT 
        pcl.credit_info_id,
        json_agg(
            json_build_object(
                'loan_type', lt.type_name,
                'loan_overdue_amount', pcl.loan_overdue_amount,
				'loan_outstanding_amount',pcl.loan_outstanding,
				'amount_paid',pcl.amount_paid,
				'sanction_amount',pcl.sanctioned_amount
            )
        ) AS credit_loans_this_bank
    FROM proposal_credit_loans_this_bank pcl 
	left join loan_types lt on lt.id=pcl.loan_type_id
    GROUP BY pcl.credit_info_id
)cltb
ON cltb.credit_info_id = pci.id

LEFT JOIN (
    SELECT 
        credit_info_id,
        json_agg(
            json_build_object(
			    'bank_name',bank_institute_name,
                'loan_type', loan_type,
                'loan_overdue_amount', loan_overdue_amount,
				'loan_outstanding_amount',loan_outstanding,
				'amount_paid',amount_paid,
				'sanction_amount',sanctioned_amount
            )
        ) AS credit_loans_other_banks
    FROM proposal_credit_loans_other_banks 
    GROUP BY credit_info_id
)clob
ON clob.credit_info_id = pci.id


LEFT JOIN (
    SELECT 
        credit_info_id,
        json_agg(
            json_build_object(
                'loan_type',lt.type_name,
                'loan_overdue_amount', loan_overdue_amount,
                'loan_outstanding_amount', loan_outstanding,
                'sanction_amount', sanctioned_amount
            )
        ) AS credit_guarantees_this_bank
    FROM proposal_credit_guarantees_this_bank cg
	left join loan_types lt on lt.id=cg.loan_type_id
    GROUP BY credit_info_id
) cgtb
ON cgtb.credit_info_id = pci.id

LEFT JOIN (
    SELECT 
        credit_info_id,
        json_agg(
            json_build_object(
                'loan_type', loan_type,
                'loan_overdue_amount', loan_overdue_amount,
                'loan_outstanding_amount', loan_outstanding,
                'sanction_amount', sanctioned_amount
            )
        ) AS credit_guarantees_other_banks
    FROM proposal_credit_guarantees_other_banks
    GROUP BY credit_info_id
) cgob
ON cgob.credit_info_id = pci.id


LEFT JOIN (
    SELECT 
        credit_info_id,
        json_agg(
            json_build_object(
			    'bank_name',bank_name,
                'account_type', account_type,
				'amount',amount
            )
        ) AS credit_accounts_other_banks
    FROM proposal_credit_accounts_other_banks 
    GROUP BY credit_info_id
)caob
ON caob.credit_info_id = pci.id

LEFT JOIN proposal_personal_info ppc 
    ON p.id = ppc.proposal_id 
    AND ppc.entity_type = 'C'

LEFT JOIN (
    SELECT 
        pp.proposal_id,
        json_agg(
            json_build_object(
			    'name',pp.name,
          'member_no',ppi.member_no ,
				  'age',p.age,
          'address', ppi.full_address
            )
        ) AS co_borrower_info
    FROM proposal_participants pp left join 
	proposal_personal_info ppi on ppi.proposal_id=pp.proposal_id
	left join proposals p on p.id=pp.proposal_id
	where pp.entity_type='C'
    GROUP BY pp.proposal_id
)cco
ON cco.proposal_id = p.id

WHERE p.id = $1`;
    const res = await this.db.query(query, [proposalId]);
    return res.rows[0] || null;
  }

  async getloanScrutinyData(proposalId: string) {
    const query = `
     SELECT
	    p.applicant_name,
	    p.age,
	    p.pan_number,
	    pp.member_no,
	    pp.net_worth_amount,
	    pp.full_address,
	    p.mobile_no,
	    pfi.cibil_cmr,
	    caob.credit_accounts_other_banks ,
	    catb.credit_accounts_this_bank,
		cltb.credit_loans_this_bank,
		clob.credit_loans_other_banks,
		pci.loans_other_banks_remarks,
		pci.previous_loans_this_bank_remarks,
		pci.accounts_other_banks_remarks,
		pci.accounts_this_bank_remarks,
		pai.borrower_property_info,
		paig.guarentor_property_info,
    pbsinfo.bank_scheme,
		li.life_insurance,
		clptb.credit_loans_previous_this_bank,
    COALESCE(plinfo.loan_info, '[]') AS loan_info,  
    hpl.higher_purchase_loan_data,
		lip.credit_accounts_this_bank_prime,
		lic.credit_accounts_this_bank_collateral,
		liop.credit_accounts_other_banks_prime,
		lioc.credit_accounts_other_banks_collateral,
		imd.income_milk_data,
		gn.guarantor_name,
		ltbg.credit_loans_this_bank_guarantor,
		lobg.credit_loans_other_bank_guarantor,
		lgtbg.credit_guarantees_this_bank_guarantor,
		lgobg.credit_guarantees_other_banks_guarantor,
		cgtbg.credit_guarantees_this_bank,
		cgobg.credit_guarantees_other_banks,
	    COALESCE((
	        SELECT json_agg(income_data)
	        FROM (
	            
	            SELECT json_build_object(
	                'type', 'AGRICULTURE',
	                'address', pia.address
	            ) AS income_data
	            FROM proposal_income_agriculture pia
	            WHERE pia.proposal_id = p.id
	              AND pia.entity_type = 'B'
	
	            UNION ALL
	
	            
	            SELECT json_build_object(
	                'type', 'JOB',
	                'org_address', pij.org_address
	            ) AS income_data
	            FROM proposal_income_job pij
	            WHERE pij.proposal_id = p.id
	              AND pij.entity_type = 'B'
	
	            UNION ALL
	
	            
	            SELECT json_build_object(
	                'type', 'MILK',
	                'remark', pim.remark
	            ) AS income_data
	            FROM proposal_income_milk pim
	            WHERE pim.proposal_id = p.id
	              AND pim.entity_type = 'B'
				  
	             UNION ALL
	
	            
	            SELECT json_build_object(
	                'type', 'RENT',
	                'remark', pir.remark
	            ) AS income_data
	            FROM proposal_income_rent pir
	            WHERE pir.proposal_id = p.id
	              AND pir.entity_type = 'B'
				  
				 UNION ALL
	
	            
	            SELECT json_build_object(
	                'type', 'RENT',
	                'remark',pio.address
	            ) AS income_data
	            FROM proposal_income_other pio
	            WHERE pio.proposal_id = p.id
	              AND pio.entity_type = 'B' 
	        ) x
	    ), JSON_ARRAY()) AS income_details
	
	FROM proposals p 
	
	LEFT JOIN proposal_personal_info pp 
	    ON p.id = pp.proposal_id AND pp.entity_type = 'B'
	    
	
	LEFT JOIN proposal_financial_info pfi 
	    ON pfi.proposal_id = p.id AND pfi.entity_type = 'B'
	
	LEFT JOIN proposal_credit_info pci
	    ON pci.proposal_id = p.id AND pci.entity_type = 'B'
		
	LEFT JOIN (
	    SELECT 
	        credit_info_id,
	        json_agg(
	            json_build_object(
				    'bank_name',bank_name,
					'account_no',account_no,
	                'account_type', account_type,
					'amount',amount,
					'loan_details',loan_details
	            )
	        ) AS credit_accounts_other_banks
	    FROM proposal_credit_accounts_other_banks 
	    GROUP BY credit_info_id
	)caob
	ON caob.credit_info_id = pci.id
	
	
	LEFT JOIN (
	    SELECT 
	        cab.credit_info_id,
	        json_agg(
	            json_build_object(
				    'branch_name',b.branch_name,
					'account_no',cab.account_no,
	         'account_type', cab.account_type,
					'amount',cab.amount,
					'loan_details',cab.loan_details
	            )
	        ) AS credit_accounts_this_bank
	    FROM proposal_credit_accounts_this_bank cab
		left join branches b on b.id=cab.branch_id
	    GROUP BY cab.credit_info_id
	)catb
	ON catb.credit_info_id = pci.id
	
	LEFT JOIN (
	    SELECT 
	        clb.credit_info_id,
	        json_agg(
	            json_build_object(
				    'branch_name',b.branch_name,
					'loan_type',lt.type_name,
					'sanctioned_amount',clb.sanctioned_amount,
	                'loan_outstanding', clb.loan_outstanding,
					'disbursement_date',clb.disbursement_date,
					'loan_overdue_amount',clb.loan_overdue_amount,
					'installment_amount',clb.installment_amount,
					'mortgage_details',clb.mortgage_details,
					'excess_collateral_details',clb.excess_collateral_details
					
	            )
	        ) AS credit_loans_this_bank
	    FROM proposal_credit_loans_this_bank clb
		left join branches b on b.id=clb.branch_id
		left join loan_types lt on lt.id=clb.loan_type_id
	    GROUP BY clb.credit_info_id
	)cltb
	ON cltb.credit_info_id = pci.id
	
	
	LEFT JOIN (
	    SELECT 
	        cob.credit_info_id,
	        json_agg(
	            json_build_object(
				    'bank_name',cob.bank_institute_name,
					'loan_type',cob.loan_type,
					'sanctioned_amount',cob.sanctioned_amount,
	                'loan_outstanding', cob.loan_outstanding,
					'loan_overdue_amount',cob.loan_overdue_amount
	            )
	        ) AS credit_loans_other_banks
	    FROM proposal_credit_loans_other_banks cob
	    GROUP BY cob.credit_info_id
	)clob
	ON clob.credit_info_id = pci.id
	
	LEFT JOIN (
	    SELECT 
	        cob.proposal_id,
	        json_agg(
	            json_build_object(
				    'owner_name',cob.owner_name,
					'land_mark',cob.landmark,
					'property_type',cob.property_type,
	                'total_area', cob.total_area,
					'area_unit_total',cob.area_unit_total,
					'group_survey_number',cob.group_survey_number,
	                'construction_area', cob.construction_area,
					'area_unit_total',cob.area_unit_total,
					'government_value',cob.government_value,
					'sara',cob.sara
	            )
	        ) AS borrower_property_info
	    FROM proposal_property_info cob
		where cob.entity_type='B'
	    GROUP BY cob.proposal_id
	)pai
ON pai.proposal_id = p.id	
	
	LEFT JOIN (
	    SELECT 
	        cob.proposal_id,
	        json_agg(
	            json_build_object(
				    'owner_name',cob.owner_name,
					'land_mark',cob.landmark,
					'property_type',cob.property_type,
	                'total_area', cob.total_area,
					'area_unit_total',cob.area_unit_total,
					'group_survey_number',cob.group_survey_number,
	                'construction_area', cob.construction_area,
					'area_unit_total',cob.area_unit_total,
					'government_value',cob.government_value,
					'sara',cob.sara
	            )
	        ) AS guarentor_property_info
	    FROM proposal_property_info cob
		where cob.entity_type='G'
	    GROUP BY cob.proposal_id
	)paig
ON paig.proposal_id = p.id

	LEFT JOIN (
	    SELECT 
	        cob.credit_info_id,
	        json_agg(
	            json_build_object(
				    'insurance_date',cob.insurance_date,
					'policy_amount',cob.policy_amount,
					'policy_number',cob.policy_number,
	                'installment_amount', cob.installment_amount,
					'amount_paid_till_date',cob.amount_paid_till_date,
					'loan_remaining_amount',cob.loan_remaining_amount
	            )
	        ) AS life_insurance
	    FROM proposal_life_insurance cob
	    GROUP BY cob.credit_info_id
	)li
	ON li.credit_info_id = pci.id
	
	LEFT JOIN (
	    SELECT 
	        cob.credit_info_id,
	        json_agg(
	            json_build_object(
				    'loan_type',lt.type_name,
					'reason_of_loan',cob.reason_of_loan,
					'sanctioned_amount',cob.sanctioned_amount,
	                'sanctioned_date', cob.sanctioned_date,
					'account_close_date',cob.account_close_date
	            )
	        ) AS credit_loans_previous_this_bank
	    FROM proposal_credit_loans_previous_this_bank cob
		left join loan_types lt on  lt.id=cob.loan_type_id
	    GROUP BY cob.credit_info_id
	)clptb
	ON clptb.credit_info_id = pci.id

LEFT JOIN (
    SELECT 
        cob.proposal_id,
        COALESCE(
            json_agg(
                json_build_object(
                    'reason_of_loan', cob.reason_of_loan,
                    'requested_amount', cob.requested_amount,
                    'duration_months', cob.duration_months,
                    'installment_type', cob.installment_type,
                    'interest_rate', cob.interest_rate,
                    'monthly_installment', cob.monthly_installment,
                    'loan_type', lt.type_name 
                )
            ), '[]'
        ) AS loan_info
    FROM proposal_loan_info cob
      LEFT JOIN loan_types lt 
        ON lt.id = cob.loan_type
    GROUP BY cob.proposal_id
) plinfo
ON plinfo.proposal_id = p.id

	LEFT JOIN (
	    SELECT 
	        cob.proposal_id,
	        json_agg(
	            json_build_object(
				    'machinery_condition',cob.machinery_condition,
					'gst_input_percentage',cob.gst_input_percentage,
					'gst_input_amount',cob.gst_input_amount,
	                'mortgage_details', cob.mortgage_details
	            )
	        ) AS higher_purchase_loan_data
	    FROM higher_purchase_loan_data cob
	    GROUP BY cob.proposal_id
	)hpl
	ON hpl.proposal_id = p.id
	
	
	LEFT JOIN (
	    SELECT 
	        cob.credit_info_id,
	        json_agg(
	            json_build_object(
				    'account_type',cob.account_type,
					'account_no',cob.account_no,
					'amount',cob.amount,
					'expiration_date',cob.expiration_date
	            )
	        ) AS credit_accounts_this_bank_prime
	    FROM proposal_credit_accounts_this_bank cob
		where cob.is_mortgaged_for_this_loan='1' AND cob.is_prime_security='1'
	    GROUP BY cob.credit_info_id
	)lip
	ON li.credit_info_id = pci.id
	
	
	LEFT JOIN (
	    SELECT 
	        cob.credit_info_id,
	        json_agg(
	            json_build_object(
				    'account_type',cob.account_type,
					'account_no',cob.account_no,
					'amount',cob.amount,
					'expiration_date',cob.expiration_date
	            )
	        ) AS credit_accounts_this_bank_collateral
	    FROM proposal_credit_accounts_this_bank cob
		where cob.is_mortgaged_for_this_loan='1' AND cob.is_collateral_security='1'
	    GROUP BY cob.credit_info_id
	)lic
	ON li.credit_info_id = pci.id
	
	
	LEFT JOIN (
	    SELECT 
	        cob.credit_info_id,
	        json_agg(
	            json_build_object(
				    'account_type',cob.account_type,
					'account_no',cob.account_no,
					'amount',cob.amount,
					'expiration_date',cob.expiration_date
	            )
	        ) AS credit_accounts_other_banks_prime
	    FROM proposal_credit_accounts_other_banks cob
		where cob.is_mortgaged_for_this_loan='1' AND cob.is_prime_security='1'
	    GROUP BY cob.credit_info_id
	)liop
	ON li.credit_info_id = pci.id
	
	
	LEFT JOIN (
	    SELECT 
	        cob.credit_info_id,
	        json_agg(
	            json_build_object(
				    'account_type',cob.account_type,
					'account_no',cob.account_no,
					'amount',cob.amount,
					'expiration_date',cob.expiration_date
	            )
	        ) AS credit_accounts_other_banks_collateral
	    FROM proposal_credit_accounts_other_banks cob
		where cob.is_mortgaged_for_this_loan='1' AND cob.is_collateral_security='1'
	    GROUP BY cob.credit_info_id
	)lioc
	ON li.credit_info_id = pci.id
	
	
	left join proposal_income_milk pim on pim.proposal_id=p.id AND pim.entity_type='B'
	
	LEFT JOIN (
	    SELECT 
	        cob.milk_id,
	        json_agg(
	            json_build_object(
				    'duration_label',cob.duration_label,
					'morning_litre',cob.morning_litre,
					'morning_rate',cob.morning_rate,
					'morning_amount',cob.morning_amount,
					'evening_litre',cob.evening_litre,
					'morning_rate',cob.morning_rate,
					'morning_amount',cob.morning_amount
	            )
	        ) AS income_milk_data
	    FROM proposal_income_milk_rows cob
	    GROUP BY cob.milk_id
	)imd
	ON imd.milk_id = pim.id

  LEFT JOIN (
    SELECT 
        pbs.proposal_id,
        COALESCE(
            json_agg(
                json_build_object(
                    'bank_loan_scheme_type', pbs.bank_loan_scheme_type,
                    'industry_marking', pbs.industry_marking,
                    'priority_sector_marking', pbs.priority_sector_marking,
                    'weaker_sector', pbs.weaker_sector,
                    'real_estate_marking', pbs.real_estate_marking,
                    'priority_code', pbs.priority_code,
                    'weaker_code', pbs.weaker_code
                )
            ), '[]'
        ) AS bank_scheme
    FROM proposal_bank_scheme pbs
    GROUP BY pbs.proposal_id
) pbsinfo
ON pbsinfo.proposal_id = p.id
	
	
	LEFT JOIN (
	    SELECT 
	        pp.proposal_id,
	        json_agg(
	            json_build_object(
	                'NAME', p.applicant_name,
					'age',p.age,
					'address',pp.full_address,
	                'MEMBER_NO', pp.member_no,
					'prefession',pp.profession,
					'net_worth_amount',pp.net_worth_amount
	            )
	        ) AS guarantor_name
	    FROM proposals p 
		left join  proposal_personal_info pp on pp.proposal_id=p.id
	    WHERE pp.entity_type = 'G'
	    GROUP BY pp.proposal_id
	) gn
	 ON gn.proposal_id = p.id
	 
	LEFT JOIN proposal_credit_info pcig
	    ON pcig.proposal_id = p.id AND pcig.entity_type = 'G'
	
	LEFT JOIN (
	    SELECT 
	        cob.credit_info_id,
	        json_agg(
	            json_build_object(
				    'sanctioned_amount',cob.sanctioned_amount,
					'loan_outstanding',cob.loan_outstanding
	            )
	        ) AS credit_loans_this_bank_guarantor
	    FROM proposal_credit_loans_this_bank cob
	    GROUP BY cob.credit_info_id
	)ltbg
	ON ltbg.credit_info_id = pcig.id
	
	
	LEFT JOIN (
	    SELECT 
	        cob.credit_info_id,
	        json_agg(
	            json_build_object(
				    'sanctioned_amount',cob.sanctioned_amount,
					'loan_outstanding',cob.loan_outstanding
	            )
	        ) AS credit_loans_other_bank_guarantor
	    FROM proposal_credit_loans_other_banks cob
	    GROUP BY cob.credit_info_id
	)lobg
	ON lobg.credit_info_id = pcig.id
	
	LEFT JOIN (
	    SELECT 
	        cob.credit_info_id,
	        json_agg(
	            json_build_object(
				    'sanctioned_amount',cob.sanctioned_amount,
					'loan_outstanding',cob.loan_outstanding,
          'borrower_name',cob.borrower_name
	            )
	        ) AS credit_guarantees_this_bank_guarantor
	    FROM proposal_credit_guarantees_this_bank cob
	    GROUP BY cob.credit_info_id
	)lgtbg
	ON ltbg.credit_info_id = pcig.id
	
	
	LEFT JOIN (
	    SELECT 
	        cob.credit_info_id,
	        json_agg(
	            json_build_object(
				    'sanctioned_amount',cob.sanctioned_amount,
					'loan_outstanding',cob.loan_outstanding,
          'borrower_name',cob.borrower_name
	            )
	        ) AS credit_guarantees_other_banks_guarantor
	    FROM proposal_credit_guarantees_other_banks cob
	    GROUP BY cob.credit_info_id
	)lgobg

	ON lobg.credit_info_id = pcig.id

  LEFT JOIN (
    SELECT 
        cl.credit_info_id,
        json_agg(
            json_build_object(
                'branch', b.branch_name,
                'loan_type', lt.type_name,
				'sanctioned_amount',cl.sanctioned_amount,
				'loan_outstanding',cl.loan_outstanding,
				'loan_overdue_amount',cl.loan_overdue_amount,
				'borrower_name',cl.borrower_name
            )
        ) AS credit_guarantees_this_bank
    FROM proposal_credit_guarantees_this_bank cl
	left join branches b on b.id=cl.branch_id
	left join loan_types lt on lt.id=cl.loan_type_id
    GROUP BY cl.credit_info_id
) cgtbg
ON cgtbg.credit_info_id = pci.id


  LEFT JOIN (
    SELECT 
        cl.credit_info_id,
        json_agg(
            json_build_object(
                'branch', cl.bank_institute_name,
                'loan_type', cl.loan_type,
				'sanctioned_amount',cl.sanctioned_amount,
				'loan_outstanding',cl.loan_outstanding,
				'loan_overdue_amount',cl.loan_overdue_amount,
				'borrower_name',cl.borrower_name
            )
        ) AS credit_guarantees_other_banks
    FROM proposal_credit_guarantees_other_banks cl
    GROUP BY cl.credit_info_id
) cgobg
ON cgobg.credit_info_id = pci.id

WHERE p.id = $1`;
    const res = await this.db.query(query, [proposalId]);
    return res.rows[0] || null;
  }
  async getGaurantorData(proposalId: string) {
    const query = `
    select 
pp.name AS guarantor_name,
pi.full_address AS full_address,
pp.phone AS phone,
pp.email AS email_id,
p.dob AS birth_date,
p.age AS age,
p.pan_number AS pan_number,
pi.religion AS religion,
pli.loan_type,
pli.requested_amount,
pli.requested_amount_words,
pi.cast_name AS cast_name,
catb.account_type AS account_type,
catb.account_no AS account_no,
pij.job_details,
pip.property_details,
pib.business_details,
pim.machinery_details,
pfi.is_itr_filed,
pfi.itr_tax_amount,
bg.credit_loans_this_bank,
gg.credit_guarantees_this_bank,
obg.credit_loans_other_banks
from proposals p

left join proposal_personal_info pi
   on pi.proposal_id=p.id AND pi.entity_type='G'
   
LEFT join proposal_participants pp 
    on pp.proposal_id=p.id AND pp.proposal_id = p.id

left join proposal_credit_info ci on ci.proposal_id=p.id AND ci.entity_type='G'
left join proposal_credit_accounts_this_bank catb on catb.credit_info_id=ci.id
left join proposal_loan_info pli on pli.proposal_id=p.id

LEFT JOIN (
    SELECT 
        proposal_id,
        json_agg(
            json_build_object(
                'organization_name', organization_name,
                'years_employed', years_employed,
                'job_type', job_type,
				'designation',designation,
				'department',department,
				'net_salary',net_salary,
				'total_deduction',total_deduction,
				'branch_contact',branch_contact
            )
        ) AS job_details
    FROM proposal_income_job 
	where entity_type='G'
    GROUP BY proposal_id
) pij
ON pij.proposal_id = p.id


LEFT JOIN (
    SELECT 
        proposal_id,
        json_agg(
            json_build_object(
                'firm_name', firm_name,
                'nature_of_business', nature_of_business,
                'address', business_address,
				'years_in_business',years_in_business,
				'ownership_type',ownership_type,
				'net_profit_loss',net_profit_loss
            )
        ) AS business_details
    FROM proposal_income_business 
	where entity_type='G'
    GROUP BY proposal_id
) pib
ON pib.proposal_id = p.id

LEFT JOIN (
    SELECT 
        proposal_id,
        json_agg(
            json_build_object(
                'nature_of_property', nature_of_property,
                'landmark', landmark,
                'government_value', government_value
				
            )
        ) AS property_details
    FROM proposal_property_info 
	where entity_type='G'
    GROUP BY proposal_id
) pip
ON pip.proposal_id = p.id

LEFT JOIN (
    SELECT 
        proposal_id,
        json_agg(
            json_build_object(
                'machinery_details', machinery_details,
                'valuation_amount', valuation_amount
				
            )
        ) AS machinery_details
    FROM proposal_machinery_info 
    GROUP BY proposal_id
) pim
ON pim.proposal_id = p.id

left join proposal_financial_info pfi on pfi.proposal_id=p.id AND pfi.entity_type='G'

LEFT JOIN (
    SELECT 
        cl.credit_info_id,
        json_agg(
            json_build_object(
                'branch', b.branch_name,
                'loan_type', lt.type_name,
				'sanctioned_amount',cl.sanctioned_amount,
				'mortgage_details',cl.mortgage_details
            )
        ) AS credit_loans_this_bank
    FROM proposal_credit_loans_this_bank cl
	left join branches b on b.id=cl.branch_id
	left join loan_types lt on lt.id=cl.loan_type_id
    GROUP BY cl.credit_info_id
) bg
ON bg.credit_info_id = ci.id

LEFT JOIN (
    SELECT 
        cl.credit_info_id,
        json_agg(
            json_build_object(
                'branch', b.branch_name,
                'loan_type', lt.type_name,
				'sanctioned_amount',cl.sanctioned_amount,
				'borrower_name',cl.borrower_name
            )
        ) AS credit_guarantees_this_bank
    FROM proposal_credit_guarantees_this_bank cl
	left join branches b on b.id=cl.branch_id
	left join loan_types lt on lt.id=cl.loan_type_id
    GROUP BY cl.credit_info_id
) gg
ON gg.credit_info_id = ci.id

LEFT JOIN (
    SELECT 
        cl.credit_info_id,
        json_agg(
            json_build_object(
                'bank',cl.bank_institute_name,
                'loan_type',loan_type,
				'sanctioned_amount',cl.sanctioned_amount,
				'mortgage_details',cl.mortgage_details
            )
        ) AS credit_loans_other_banks
    FROM proposal_credit_loans_other_banks cl
    GROUP BY cl.credit_info_id
) obg
ON obg.credit_info_id = ci.id

WHERE p.id = $1`;
    const res = await this.db.query(query, [proposalId]);
    return res.rows[0] || null;
  }
  async updateHigherPurchaseData(proposalId: string, data: any) {
    if (!data) data = {};
    return await this.db.transaction(async (client) => {
      const query = `
        INSERT INTO higher_purchase_loan_data (
          proposal_id, machinery_condition, has_gst_input, 
          gst_input_percentage, gst_input_amount, is_hypothecated, 
          mortgage_details, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP
        )
        ON CONFLICT (proposal_id) DO UPDATE SET
          machinery_condition = EXCLUDED.machinery_condition,
          has_gst_input = EXCLUDED.has_gst_input,
          gst_input_percentage = EXCLUDED.gst_input_percentage,
          gst_input_amount = EXCLUDED.gst_input_amount,
          is_hypothecated = EXCLUDED.is_hypothecated,
          mortgage_details = EXCLUDED.mortgage_details,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const values = [
        proposalId,
        data.machinery_condition || 'new',
        data.has_gst_input || false,
        data.gst_input_percentage || 0,
        data.gst_input_amount || 0,
        data.is_hypothecated || false,
        data.mortgage_details || null
      ];
      const res = await client.query(query, values);

      // Mark tab as filled
      await this.markTabAsFilledInternal(client, proposalId, 'loan_specific');

      return res.rows[0];
    });
  }

  async upsertMachineryItem(proposalId: string, data: any) {
    return await this.db.transaction(async (client) => {
      const id = data.id || this.idService.generate();
      const query = `
        INSERT INTO proposal_machinery_info (
          id, proposal_id, quotation_date, vendor_name, 
          machinery_details, machinery_price, gst_amount, total_amount,
          valuation_amount, valuation_date, valuer_name, age_of_machinery, 
          future_life_of_machinery, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          quotation_date = EXCLUDED.quotation_date,
          vendor_name = EXCLUDED.vendor_name,
          machinery_details = EXCLUDED.machinery_details,
          machinery_price = EXCLUDED.machinery_price,
          gst_amount = EXCLUDED.gst_amount,
          total_amount = EXCLUDED.total_amount,
          valuation_amount = EXCLUDED.valuation_amount,
          valuation_date = EXCLUDED.valuation_date,
          valuer_name = EXCLUDED.valuer_name,
          age_of_machinery = EXCLUDED.age_of_machinery,
          future_life_of_machinery = EXCLUDED.future_life_of_machinery,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const values = [
        id,
        proposalId,
        data.quotation_date || null,
        data.vendor_name || null,
        data.machinery_details || null,
        data.machinery_price || 0,
        data.gst_amount || 0,
        data.total_amount || 0,
        data.valuation_amount || 0,
        data.valuation_date || null,
        data.valuer_name || null,
        data.age_of_machinery || null,
        data.future_life_of_machinery || null
      ];
      const res = await client.query(query, values);

      // Mark tab as filled
      await this.markTabAsFilledInternal(client, proposalId, 'loan_specific');

      return res.rows[0];
    });
  }

  async deleteMachineryItem(id: string) {
    const query = `DELETE FROM proposal_machinery_info WHERE id = $1`;
    return await this.db.query(query, [id]);
  }

  async updateProperty(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    if (!data) return null;

    // Defensive check for missing or empty proposalId
    const sanitizedProposalId = (proposalId === '' || proposalId === 'null' || proposalId === 'undefined' || !proposalId) ? null : proposalId;
    const sanitizedParticipantId = (participantId === '' || participantId === 'null' || participantId === 'undefined') ? null : participantId;

    if (!sanitizedProposalId) {
      throw new Error('Proposal ID is mandatory for property updates. Please ensure you are editing an existing proposal.');
    }

    return await this.db.transaction(async (client) => {
      let propertyId = data.id;
      const isNew = !propertyId;

      if (isNew) {
        propertyId = this.idService.generate();
        const insertQuery = `
          INSERT INTO proposal_property_info (
            id, proposal_id, entity_type, participant_id, owner_name, relationship_with_borrower, nature_of_property, 
            property_type, total_area, area_unit_total, part, area_unit_part, 
            group_survey_number, sara, monthly_rent, construction_area,
            direction_east, direction_west, direction_south, direction_north, details,
            is_prime_security, is_tax_paid, is_mortgaged_other, other_bank_name, 
            other_loan_total_amount, other_loan_due_amount,
            has_legal_opinion, panel_advocate, legal_opinion_date,
            search_receipt_number, search_receipt_date,
            is_suitable_for_mortgage, legal_opinion_details,
            has_second_legal_opinion, second_panel_advocate, second_legal_opinion_date,
            second_search_receipt_number, second_search_receipt_date,
            second_is_suitable_for_mortgage, second_legal_opinion_details,
            visit_report_done, visitor_name, visit_date, visit_details,
            valuation_done, valuator_name, market_value, realizable_value, 
            distress_value, government_value, valuation_date, paiki_plot_value, 
            building_value, building_age, future_life,
            second_valuation_done, second_valuator_name, second_market_value, 
            second_realizable_value, second_distress_value, second_government_value, 
            second_valuation_date, second_paiki_plot_value, second_building_value, 
            second_building_age, second_future_life,
            purchase_date, purchase_order_number, purchase_amount, seller_name,
            income_description, landmark, state_id, district_id, taluka_id, village, pincode, remark
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
            $11, $12, $13, $14, $15, $16, $17, $18, $19, 
            $20, $21, $22, $23, $24, $25,
            $26, $27, $28, $29, $30,
            $31, $32,
            $33, $34, $35, $36, $37, $38, $39,
            $40, $41, $42, $43,
            $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54,
            $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, $65,
            $66, $67, $68, $69,
            $70, $71, $72, $73, $74, $75, $76, $77, $78, $79
          ) RETURNING *
        `;
        const insertValues = [
          propertyId, sanitizedProposalId, entityType, sanitizedParticipantId, data.owner_name, data.relationship_with_borrower, data.nature_of_property,
          data.property_type, data.total_area, data.area_unit_total, data.part ?? 0, data.area_unit_part,
          data.group_survey_number, data.sara, data.monthly_rent, data.construction_area,
          data.direction_east, data.direction_west, data.direction_south, data.direction_north, data.details,
          data.is_prime_security ?? true, data.is_tax_paid ?? false, data.is_mortgaged_other ?? false, data.other_bank_name,
          data.other_loan_total_amount ?? 0, data.other_loan_due_amount ?? 0,
          data.has_legal_opinion ?? false, data.panel_advocate, data.legal_opinion_date ? new Date(data.legal_opinion_date) : null,
          data.search_receipt_number, data.search_receipt_date ? new Date(data.search_receipt_date) : null,
          data.is_suitable_for_mortgage ?? false, data.legal_opinion_details,
          data.has_second_legal_opinion ?? false, data.second_panel_advocate, data.second_legal_opinion_date ? new Date(data.second_legal_opinion_date) : null,
          data.second_search_receipt_number, data.second_search_receipt_date ? new Date(data.second_search_receipt_date) : null,
          data.second_is_suitable_for_mortgage ?? false, data.second_legal_opinion_details,
          data.visit_report_done ?? false, data.visitor_name, data.visit_date ? new Date(data.visit_date) : null, data.visit_details,
          data.valuation_done ?? false, data.valuator_name, data.market_value ?? 0, data.realizable_value ?? 0,
          data.distress_value ?? 0, data.government_value ?? 0, data.valuation_date ? new Date(data.valuation_date) : null, data.paiki_plot_value,
          data.building_value, data.building_age, data.future_life,
          data.second_valuation_done ?? false, data.second_valuator_name, data.second_market_value ?? 0,
          data.second_realizable_value ?? 0, data.second_distress_value ?? 0, data.second_government_value ?? 0,
          data.second_valuation_date ? new Date(data.second_valuation_date) : null, data.second_paiki_plot_value,
          data.second_building_value, data.second_building_age, data.second_future_life,
          data.purchase_date ? new Date(data.purchase_date) : null, data.purchase_order_number, data.purchase_amount, data.seller_name,
          data.income_description, data.landmark, data.state_id, data.district_id, data.taluka_id, data.village, data.pincode, data.remark
        ];
        await client.query(insertQuery, insertValues);
      } else {
        const updateQuery = `
          UPDATE proposal_property_info SET
            owner_name = $3, relationship_with_borrower = $4, nature_of_property = $5, 
            property_type = $6, total_area = $7, area_unit_total = $8, part = $9, area_unit_part = $10, 
            group_survey_number = $11, sara = $12, monthly_rent = $13, construction_area = $14,
            direction_east = $15, direction_west = $16, direction_south = $17, direction_north = $18, details = $19,
            is_prime_security = $20, is_tax_paid = $21, is_mortgaged_other = $22, other_bank_name = $23, 
            other_loan_total_amount = $24, other_loan_due_amount = $25,
            has_legal_opinion = $26, panel_advocate = $27, legal_opinion_date = $28,
            search_receipt_number = $29, search_receipt_date = $30,
            is_suitable_for_mortgage = $31, legal_opinion_details = $32,
            has_second_legal_opinion = $33, second_panel_advocate = $34, second_legal_opinion_date = $35,
            second_search_receipt_number = $36, second_search_receipt_date = $37,
            second_is_suitable_for_mortgage = $38, second_legal_opinion_details = $39,
            visit_report_done = $40, visitor_name = $41, visit_date = $42, visit_details = $43,
            valuation_done = $44, valuator_name = $45, market_value = $46, realizable_value = $47, 
            distress_value = $48, government_value = $49, valuation_date = $50, paiki_plot_value = $51, 
            building_value = $52, building_age = $53, future_life = $54,
            second_valuation_done = $55, second_valuator_name = $56, second_market_value = $57, 
            second_realizable_value = $58, second_distress_value = $59, second_government_value = $60, 
            second_valuation_date = $61, second_paiki_plot_value = $62, second_building_value = $63, 
            second_building_age = $64, second_future_life = $65,
            purchase_date = $66, purchase_order_number = $67, purchase_amount = $68, seller_name = $69,
            income_description = $70, landmark = $71, state_id = $72, district_id = $73, taluka_id = $74, village = $75, pincode = $76, remark = $77
          WHERE id = $1 AND proposal_id = $2
        `;
        const updateValues = [
          propertyId, sanitizedProposalId, data.owner_name, data.relationship_with_borrower, data.nature_of_property,
          data.property_type, data.total_area, data.area_unit_total, data.part ?? 0, data.area_unit_part,
          data.group_survey_number, data.sara, data.monthly_rent, data.construction_area,
          data.direction_east, data.direction_west, data.direction_south, data.direction_north, data.details,
          data.is_prime_security ?? true, data.is_tax_paid ?? false, data.is_mortgaged_other ?? false, data.other_bank_name,
          data.other_loan_total_amount ?? 0, data.other_loan_due_amount ?? 0,
          data.has_legal_opinion ?? false, data.panel_advocate, data.legal_opinion_date ? new Date(data.legal_opinion_date) : null,
          data.search_receipt_number, data.search_receipt_date ? new Date(data.search_receipt_date) : null,
          data.is_suitable_for_mortgage ?? false, data.legal_opinion_details,
          data.has_second_legal_opinion ?? false, data.second_panel_advocate, data.second_legal_opinion_date ? new Date(data.second_legal_opinion_date) : null,
          data.second_search_receipt_number, data.second_search_receipt_date ? new Date(data.second_search_receipt_date) : null,
          data.second_is_suitable_for_mortgage ?? false, data.second_legal_opinion_details,
          data.visit_report_done ?? false, data.visitor_name, data.visit_date ? new Date(data.visit_date) : null, data.visit_details,
          data.valuation_done ?? false, data.valuator_name, data.market_value ?? 0, data.realizable_value ?? 0,
          data.distress_value ?? 0, data.government_value ?? 0, data.valuation_date ? new Date(data.valuation_date) : null, data.paiki_plot_value,
          data.building_value, data.building_age, data.future_life,
          data.second_valuation_done ?? false, data.second_valuator_name, data.second_market_value ?? 0,
          data.second_realizable_value ?? 0, data.second_distress_value ?? 0, data.second_government_value ?? 0,
          data.second_valuation_date ? new Date(data.second_valuation_date) : null, data.second_paiki_plot_value,
          data.second_building_value, data.second_building_age, data.second_future_life,
          data.purchase_date ? new Date(data.purchase_date) : null, data.purchase_order_number, data.purchase_amount, data.seller_name,
          data.income_description, data.landmark, data.state_id, data.district_id, data.taluka_id, data.village, data.pincode, data.remark
        ];
        await client.query(updateQuery, updateValues);
      }

      // Mark tab as filled
      await this.markTabAsFilledInternal(client, sanitizedProposalId || proposalId, 'property', entityType, sanitizedParticipantId);

      return { id: propertyId };
    });
  }

  async deleteProperty(propertyId: string) {
    const query = `DELETE FROM proposal_property_info WHERE id = $1`;
    return await this.db.query(query, [propertyId]);
  }
  async getFinancialInfo(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    const whereClause = entityType === 'B'
      ? 'proposal_id = $1 AND entity_type = \'B\''
      : 'participant_id = $1';
    const query = `SELECT * FROM proposal_financial_info WHERE ${whereClause}`;
    const result = await this.db.query(query, [entityType === 'B' ? proposalId : participantId]);
    return result.rows[0] || null;
  }

  async updateFinancialInfo(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    if (!data) return null;

    return await this.db.transaction(async (client) => {
      // Check if exists
      const whereClause = entityType === 'B'
        ? 'proposal_id = $1 AND entity_type = \'B\''
        : 'participant_id = $1';
      const checkQuery = `SELECT id FROM proposal_financial_info WHERE ${whereClause}`;
      const existing = await client.query(checkQuery, [entityType === 'B' ? proposalId : participantId]);

      const commonFields = `
        bank_name, account_number, 
        is_itr_filed, itr_financial_year, itr_income_amount, itr_tax_amount,
        pays_property_tax, wealth_amount, property_tax_amount, last_assessment_year,
        has_investments, investment_details,
        has_cibil, cibil_type, cibil_date, cibil_cmr, cibil_details
      `;
      const commonValues = [
        data.bank_name ?? null, data.account_number ?? null,
        data.is_itr_filed ?? false, data.itr_financial_year ?? null, data.itr_income_amount ?? 0, data.itr_tax_amount ?? 0,
        data.pays_property_tax ?? false, data.wealth_amount ?? 0, data.property_tax_amount ?? 0, data.last_assessment_year ?? null,
        data.has_investments ?? false, data.investment_details ?? null,
        data.has_cibil ?? false, data.cibil_type ?? null, data.cibil_date ? new Date(data.cibil_date) : null, data.cibil_cmr ?? null, data.cibil_details ?? null
      ];

      if (existing.rowCount === 0) {
        const insertQuery = `
          INSERT INTO proposal_financial_info (
            proposal_id, entity_type, participant_id, ${commonFields}
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
          ) RETURNING *
        `;
        const insertValues = [
          proposalId, entityType, participantId,
          ...commonValues
        ];
        const res = await client.query(insertQuery, insertValues);

        await this.markTabAsFilledInternal(client, proposalId, 'financial', entityType, participantId);

        return res.rows[0];
      } else {
        const updateQuery = `
          UPDATE proposal_financial_info SET
            bank_name = $2, account_number = $3, 
            is_itr_filed = $4, itr_financial_year = $5, itr_income_amount = $6, itr_tax_amount = $7,
            pays_property_tax = $8, wealth_amount = $9, property_tax_amount = $10, last_assessment_year = $11,
            has_investments = $12, investment_details = $13,
            has_cibil = $14, cibil_type = $15, cibil_date = $16, cibil_cmr = $17, cibil_details = $18,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING *
        `;
        const updateValues = [
          existing.rows[0].id,
          ...commonValues
        ];
        const res = await client.query(updateQuery, updateValues);

        await this.markTabAsFilledInternal(client, proposalId, 'financial', entityType, participantId);

        return res.rows[0];
      }
    });
  }

  async getCreditInfo(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    const whereClause = entityType === 'B'
      ? 'proposal_id = $1 AND entity_type = \'B\''
      : 'participant_id = $1';
    const query = `SELECT * FROM proposal_credit_info WHERE ${whereClause}`;
    const res = await this.db.query(query, [entityType === 'B' ? proposalId : participantId]);
    return res.rows[0] || null;
  }

  async upsertCreditInfo(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    if (!data) data = {};
    return await this.db.transaction(async (client) => {
      const whereClause = entityType === 'B'
        ? 'proposal_id = $1 AND entity_type = \'B\''
        : 'participant_id = $1';
      const checkQuery = `SELECT id FROM proposal_credit_info WHERE ${whereClause}`;
      const existing = await client.query(checkQuery, [entityType === 'B' ? proposalId : participantId]);

      const commonFields = `
        has_loan_in_this_bank, has_loan_in_other_banks, 
        has_guarantee_in_this_bank, has_guarantee_in_other_banks, 
        has_previous_loan_in_this_bank, has_previous_loan_in_other_banks, 
        has_account_in_this_bank, has_account_in_other_banks, 
        has_life_insurance, will_do_new_insurance, 
        has_roc_debt_record, has_no_dues_certificate, 
        has_other_collateral, has_loan_statement, has_other_mortgage_share,
        no_dues_certificate_details, other_collateral_details, other_mortgage_share_details,
        loans_this_bank_remarks, loans_other_banks_remarks, guarantees_this_bank_remarks,
        guarantees_other_banks_remarks, previous_loans_this_bank_remarks, previous_loans_other_banks_remarks,
        accounts_this_bank_remarks, accounts_other_banks_remarks, life_insurance_remarks,
        new_insurance_remarks, roc_debts_remarks
      `;
      const commonValues = [
        data.has_loan_in_this_bank ?? false,
        data.has_loan_in_other_banks ?? false,
        data.has_guarantee_in_this_bank ?? false,
        data.has_guarantee_in_other_banks ?? false,
        data.has_previous_loan_in_this_bank ?? false,
        data.has_previous_loan_in_other_banks ?? false,
        data.has_account_in_this_bank ?? false,
        data.has_account_in_other_banks ?? false,
        data.has_life_insurance ?? false,
        data.will_do_new_insurance ?? false,
        data.has_roc_debt_record ?? false,
        data.has_no_dues_certificate ?? false,
        data.has_other_collateral ?? false,
        data.has_loan_statement ?? false,
        data.has_other_mortgage_share ?? false,
        data.no_dues_certificate_details || null,
        data.other_collateral_details || null,
        data.other_mortgage_share_details || null,
        data.loans_this_bank_remarks || null,
        data.loans_other_banks_remarks || null,
        data.guarantees_this_bank_remarks || null,
        data.guarantees_other_banks_remarks || null,
        data.previous_loans_this_bank_remarks || null,
        data.previous_loans_other_banks_remarks || null,
        data.accounts_this_bank_remarks || null,
        data.accounts_other_banks_remarks || null,
        data.life_insurance_remarks || null,
        data.new_insurance_remarks || null,
        data.roc_debts_remarks || null,
      ];

      if (existing.rowCount === 0) {
        const insertQuery = `
          INSERT INTO proposal_credit_info (
            proposal_id, entity_type, participant_id, ${commonFields}
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32
          ) RETURNING *
        `;
        const res = await client.query(insertQuery, [proposalId, entityType, participantId, ...commonValues]);
        await this.markTabAsFilledInternal(client, proposalId, 'credit', entityType, participantId);
        return res.rows[0];
      } else {
        const updateQuery = `
          UPDATE proposal_credit_info SET
            has_loan_in_this_bank = $2, has_loan_in_other_banks = $3, 
            has_guarantee_in_this_bank = $4, has_guarantee_in_other_banks = $5, 
            has_previous_loan_in_this_bank = $6, has_previous_loan_in_other_banks = $7, 
            has_account_in_this_bank = $8, has_account_in_other_banks = $9, 
            has_life_insurance = $10, will_do_new_insurance = $11, 
            has_roc_debt_record = $12, has_no_dues_certificate = $13, 
            has_other_collateral = $14, has_loan_statement = $15, has_other_mortgage_share = $16,
            no_dues_certificate_details = $17, other_collateral_details = $18, other_mortgage_share_details = $19,
            loans_this_bank_remarks = $20, loans_other_banks_remarks = $21, guarantees_this_bank_remarks = $22,
            guarantees_other_banks_remarks = $23, previous_loans_this_bank_remarks = $24, previous_loans_other_banks_remarks = $25,
            accounts_this_bank_remarks = $26, accounts_other_banks_remarks = $27, life_insurance_remarks = $28,
            new_insurance_remarks = $29, roc_debts_remarks = $30,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING *
        `;
        const res = await client.query(updateQuery, [existing.rows[0].id, ...commonValues]);
        await this.markTabAsFilledInternal(client, proposalId, 'credit', entityType, participantId);
        return res.rows[0];
      }
    });
  }

  async getCreditLoansThisBank(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    const whereClause = entityType === 'B'
      ? 'ci.proposal_id = $1 AND ci.entity_type = \'B\''
      : 'ci.participant_id = $1';
    const query = `
      SELECT l.*, b.branch_name, lt.type_name as loan_type_name 
      FROM proposal_credit_loans_this_bank l
      INNER JOIN proposal_credit_info ci ON l.credit_info_id = ci.id
      LEFT JOIN branches b ON l.branch_id = b.id
      LEFT JOIN loan_types lt ON l.loan_type_id = lt.id
      WHERE ${whereClause}
      ORDER BY l.created_at ASC
    `;
    const res = await this.db.query(query, [entityType === 'B' ? proposalId : participantId]);
    return res.rows;
  }

  async upsertCreditLoanThisBank(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    // 1. Ensure Credit Info parent exists for the correct entity
    let creditInfoId = data.credit_info_id;
    if (!creditInfoId) {
      const ci = await this.getCreditInfo(proposalId, entityType, participantId);
      if (!ci) {
        // Create an empty one if it doesn't exist
        const insertCi = await this.db.query(
          `INSERT INTO proposal_credit_info (proposal_id, entity_type, participant_id) VALUES ($1, $2, $3) RETURNING id`,
          [proposalId, entityType, participantId]
        );
        creditInfoId = insertCi.rows[0].id;
      } else {
        creditInfoId = ci.id;
      }
    }

    const values = [
      creditInfoId,
      data.branch_id || null,
      data.account_no || null,
      data.loan_type_id || null,
      data.sanctioned_amount || 0,
      data.amount_paid || 0,
      data.installment_amount || 0,
      data.loan_outstanding || 0,
      data.loan_overdue_amount || 0,
      data.due_maturity_date || null,
      data.is_timely_repayment ?? true,
      data.disbursement_date || null,
      data.mortgage_details || null,
      data.will_repay_loan ?? true,
      data.excess_collateral_details || null,
      data.reported_to_cibil ?? true
    ];

    if (data.id) {
      const updateQuery = `
        UPDATE proposal_credit_loans_this_bank SET
          branch_id = $2, account_no = $3, loan_type_id = $4,
          sanctioned_amount = $5, amount_paid = $6, installment_amount = $7,
          loan_outstanding = $8, loan_overdue_amount = $9, due_maturity_date = $10,
          is_timely_repayment = $11, disbursement_date = $12, mortgage_details = $13,
          will_repay_loan = $14, excess_collateral_details = $15, reported_to_cibil = $16,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $17 AND credit_info_id = $1
        RETURNING *
      `;
      const res = await this.db.query(updateQuery, [...values.slice(0, 16), data.id]);
      return res.rows[0];
    } else {
      const insertQuery = `
        INSERT INTO proposal_credit_loans_this_bank (
          credit_info_id, branch_id, account_no, loan_type_id,
          sanctioned_amount, amount_paid, installment_amount,
          loan_outstanding, loan_overdue_amount, due_maturity_date,
          is_timely_repayment, disbursement_date, mortgage_details,
          will_repay_loan, excess_collateral_details, reported_to_cibil
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING *
      `;
      const res = await this.db.query(insertQuery, values);
      return res.rows[0];
    }
  }

  async deleteCreditLoanThisBank(loanId: string) {
    const query = `DELETE FROM proposal_credit_loans_this_bank WHERE id = $1`;
    await this.db.query(query, [loanId]);
  }

  async getCreditLoansOtherBank(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    const whereClause = entityType === 'B'
      ? 'ci.proposal_id = $1 AND ci.entity_type = \'B\''
      : 'ci.participant_id = $1';
    const query = `
      SELECT l.*
      FROM proposal_credit_loans_other_banks l
      INNER JOIN proposal_credit_info ci ON l.credit_info_id = ci.id
      WHERE ${whereClause}
      ORDER BY l.created_at ASC
    `;
    const res = await this.db.query(query, [entityType === 'B' ? proposalId : participantId]);
    return res.rows;
  }

  async upsertCreditLoanOtherBank(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    let creditInfoId = data.credit_info_id;
    if (!creditInfoId) {
      const ci = await this.getCreditInfo(proposalId, entityType, participantId);
      if (!ci) {
        const insertCi = await this.db.query(
          `INSERT INTO proposal_credit_info (proposal_id, entity_type, participant_id) VALUES ($1, $2, $3) RETURNING id`,
          [proposalId, entityType, participantId]
        );
        creditInfoId = insertCi.rows[0].id;
      } else {
        creditInfoId = ci.id;
      }
    }

    const values = [
      creditInfoId,
      data.bank_category || null,
      data.is_society_member ?? false,
      data.bank_institute_name || null,
      data.branch_name || null,
      data.account_no || null,
      data.loan_type || null,
      data.sanctioned_amount || 0,
      data.amount_paid || 0,
      data.installment_amount || 0,
      data.loan_outstanding || 0,
      data.loan_overdue_amount || 0,
      data.due_maturity_date || null,
      data.is_timely_repayment ?? true,
      data.mortgage_details || null,
      data.will_repay_loan ?? true,
      data.reported_to_cibil ?? true
    ];

    if (data.id) {
      const updateQuery = `
        UPDATE proposal_credit_loans_other_banks SET
          bank_category = $2, is_society_member = $3, bank_institute_name = $4,
          branch_name = $5, account_no = $6, loan_type = $7,
          sanctioned_amount = $8, amount_paid = $9, installment_amount = $10,
          loan_outstanding = $11, loan_overdue_amount = $12, due_maturity_date = $13,
          is_timely_repayment = $14, mortgage_details = $15, will_repay_loan = $16,
          reported_to_cibil = $17, updated_at = CURRENT_TIMESTAMP
        WHERE id = $18 AND credit_info_id = $1
        RETURNING *
      `;
      const res = await this.db.query(updateQuery, [...values.slice(0, 17), data.id]);
      return res.rows[0];
    } else {
      const insertQuery = `
        INSERT INTO proposal_credit_loans_other_banks (
          credit_info_id, bank_category, is_society_member, bank_institute_name,
          branch_name, account_no, loan_type, sanctioned_amount,
          amount_paid, installment_amount, loan_outstanding,
          loan_overdue_amount, due_maturity_date, is_timely_repayment,
          mortgage_details, will_repay_loan, reported_to_cibil
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) RETURNING *
      `;
      const res = await this.db.query(insertQuery, values);
      return res.rows[0];
    }
  }

  async deleteCreditLoanOtherBank(loanId: string) {
    const query = `DELETE FROM proposal_credit_loans_other_banks WHERE id = $1`;
    await this.db.query(query, [loanId]);
  }

  async getCreditGuaranteesThisBank(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    const whereClause = entityType === 'B'
      ? 'ci.proposal_id = $1 AND ci.entity_type = \'B\''
      : 'ci.participant_id = $1';
    const query = `
      SELECT g.*, b.branch_name, lt.type_name as loan_type_name
      FROM proposal_credit_guarantees_this_bank g
      INNER JOIN proposal_credit_info ci ON g.credit_info_id = ci.id
      LEFT JOIN branches b ON g.branch_id = b.id
      LEFT JOIN loan_types lt ON g.loan_type_id = lt.id
      WHERE ${whereClause}
      ORDER BY g.created_at ASC
    `;
    const res = await this.db.query(query, [entityType === 'B' ? proposalId : participantId]);
    return res.rows;
  }

  async upsertCreditGuaranteeThisBank(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    let creditInfoId = data.credit_info_id;
    if (!creditInfoId) {
      const ci = await this.getCreditInfo(proposalId, entityType, participantId);
      if (!ci) {
        const insertCi = await this.db.query(
          `INSERT INTO proposal_credit_info (proposal_id, entity_type, participant_id) VALUES ($1, $2, $3) RETURNING id`,
          [proposalId, entityType, participantId]
        );
        creditInfoId = insertCi.rows[0].id;
      } else {
        creditInfoId = ci.id;
      }
    }

    const values = [
      creditInfoId,
      data.branch_id || null,
      data.account_no || null,
      data.borrower_name || null,
      data.loan_type_id || null,
      data.sanctioned_amount || 0,
      data.loan_outstanding || 0,
      data.loan_overdue_amount || 0,
      data.due_maturity_date || null,
      data.is_timely_repayment ?? true
    ];

    if (data.id) {
      const updateQuery = `
        UPDATE proposal_credit_guarantees_this_bank SET
          branch_id = $2, account_no = $3, borrower_name = $4,
          loan_type_id = $5, sanctioned_amount = $6, loan_outstanding = $7,
          loan_overdue_amount = $8, due_maturity_date = $9,
          is_timely_repayment = $10, updated_at = CURRENT_TIMESTAMP
        WHERE id = $11 AND credit_info_id = $1
        RETURNING *
      `;
      const res = await this.db.query(updateQuery, [...values.slice(0, 10), data.id]);
      return res.rows[0];
    } else {
      const insertQuery = `
        INSERT INTO proposal_credit_guarantees_this_bank (
          credit_info_id, branch_id, account_no, borrower_name,
          loan_type_id, sanctioned_amount, loan_outstanding,
          loan_overdue_amount, due_maturity_date, is_timely_repayment
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) RETURNING *
      `;
      const res = await this.db.query(insertQuery, values);
      return res.rows[0];
    }
  }

  async deleteCreditGuaranteeThisBank(guaranteeId: string) {
    const query = `DELETE FROM proposal_credit_guarantees_this_bank WHERE id = $1`;
    await this.db.query(query, [guaranteeId]);
  }

  async getCreditGuaranteesOtherBank(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    const whereClause = entityType === 'B'
      ? 'ci.proposal_id = $1 AND ci.entity_type = \'B\''
      : 'ci.participant_id = $1';
    const query = `
      SELECT g.*
      FROM proposal_credit_guarantees_other_banks g
      INNER JOIN proposal_credit_info ci ON g.credit_info_id = ci.id
      WHERE ${whereClause}
      ORDER BY g.created_at ASC
    `;
    const res = await this.db.query(query, [entityType === 'B' ? proposalId : participantId]);
    return res.rows;
  }

  async upsertCreditGuaranteeOtherBank(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    let creditInfoId = data.credit_info_id;
    if (!creditInfoId) {
      const ci = await this.getCreditInfo(proposalId, entityType, participantId);
      if (!ci) {
        const insertCi = await this.db.query(
          `INSERT INTO proposal_credit_info (proposal_id, entity_type, participant_id) VALUES ($1, $2, $3) RETURNING id`,
          [proposalId, entityType, participantId]
        );
        creditInfoId = insertCi.rows[0].id;
      } else {
        creditInfoId = ci.id;
      }
    }

    const values = [
      creditInfoId,
      data.bank_category || null,
      data.is_society_member ?? false,
      data.bank_institute_name || null,
      data.branch_name || null,
      data.account_no || null,
      data.borrower_name || null,
      data.loan_type || null,
      data.sanctioned_amount || 0,
      data.loan_outstanding || 0,
      data.loan_overdue_amount || 0,
      data.due_maturity_date || null,
      data.is_timely_repayment ?? true
    ];

    if (data.id) {
      const updateQuery = `
        UPDATE proposal_credit_guarantees_other_banks SET
          bank_category = $2, is_society_member = $3, bank_institute_name = $4,
          branch_name = $5, account_no = $6, borrower_name = $7,
          loan_type = $8, sanctioned_amount = $9, loan_outstanding = $10,
          loan_overdue_amount = $11, due_maturity_date = $12,
          is_timely_repayment = $13, updated_at = CURRENT_TIMESTAMP
        WHERE id = $14 AND credit_info_id = $1
        RETURNING *
      `;
      const res = await this.db.query(updateQuery, [...values.slice(0, 13), data.id]);
      return res.rows[0];
    } else {
      const insertQuery = `
        INSERT INTO proposal_credit_guarantees_other_banks (
          credit_info_id, bank_category, is_society_member, bank_institute_name,
          branch_name, account_no, borrower_name, loan_type,
          sanctioned_amount, loan_outstanding, loan_overdue_amount,
          due_maturity_date, is_timely_repayment
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) RETURNING *
      `;
      const res = await this.db.query(insertQuery, values);
      return res.rows[0];
    }
  }

  async deleteCreditGuaranteeOtherBank(guaranteeId: string) {
    const query = `DELETE FROM proposal_credit_guarantees_other_banks WHERE id = $1`;
    await this.db.query(query, [guaranteeId]);
  }

  async getPreviousLoansThisBank(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    const whereClause = entityType === 'B'
      ? 'ci.proposal_id = $1 AND ci.entity_type = \'B\''
      : 'ci.participant_id = $1';
    const query = `
      SELECT p.*, b.branch_name, lt.type_name as loan_type_name
      FROM proposal_credit_loans_previous_this_bank p
      INNER JOIN proposal_credit_info ci ON p.credit_info_id = ci.id
      LEFT JOIN branches b ON p.branch_id = b.id
      LEFT JOIN loan_types lt ON p.loan_type_id = lt.id
      WHERE ${whereClause}
      ORDER BY p.created_at ASC
    `;
    const res = await this.db.query(query, [entityType === 'B' ? proposalId : participantId]);
    return res.rows;
  }

  async upsertPreviousLoanThisBank(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    let creditInfoId = data.credit_info_id;
    if (!creditInfoId) {
      const ci = await this.getCreditInfo(proposalId, entityType, participantId);
      if (!ci) {
        const insertCi = await this.db.query(
          `INSERT INTO proposal_credit_info (proposal_id, entity_type, participant_id) VALUES ($1, $2, $3) RETURNING id`,
          [proposalId, entityType, participantId]
        );
        creditInfoId = insertCi.rows[0].id;
      } else {
        creditInfoId = ci.id;
      }
    }

    const values = [
      creditInfoId,
      data.branch_id || null,
      data.reason_of_loan || null,
      data.loan_type_id || null,
      data.sanctioned_amount || 0,
      data.sanctioned_date || null,
      data.account_close_date || null
    ];

    if (data.id) {
      const updateQuery = `
        UPDATE proposal_credit_loans_previous_this_bank SET
          branch_id = $2, reason_of_loan = $3, loan_type_id = $4,
          sanctioned_amount = $5, sanctioned_date = $6,
          account_close_date = $7, updated_at = CURRENT_TIMESTAMP
        WHERE id = $8 AND credit_info_id = $1
        RETURNING *
      `;
      const res = await this.db.query(updateQuery, [...values, data.id]);
      return res.rows[0];
    } else {
      const insertQuery = `
        INSERT INTO proposal_credit_loans_previous_this_bank (
          credit_info_id, branch_id, reason_of_loan, loan_type_id,
          sanctioned_amount, sanctioned_date, account_close_date
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7
        ) RETURNING *
      `;
      const res = await this.db.query(insertQuery, values);
      return res.rows[0];
    }
  }

  async deletePreviousLoanThisBank(loanId: string) {
    const query = `DELETE FROM proposal_credit_loans_previous_this_bank WHERE id = $1`;
    await this.db.query(query, [loanId]);
  }

  async getPreviousLoansOtherBank(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    const whereClause = entityType === 'B'
      ? 'ci.proposal_id = $1 AND ci.entity_type = \'B\''
      : 'ci.participant_id = $1';
    const query = `
      SELECT p.*
      FROM proposal_credit_loans_previous_other_banks p
      INNER JOIN proposal_credit_info ci ON p.credit_info_id = ci.id
      WHERE ${whereClause}
      ORDER BY p.created_at ASC
    `;
    const res = await this.db.query(query, [entityType === 'B' ? proposalId : participantId]);
    return res.rows;
  }

  async upsertPreviousLoanOtherBank(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    let creditInfoId = data.credit_info_id;
    if (!creditInfoId) {
      const ci = await this.getCreditInfo(proposalId, entityType, participantId);
      if (!ci) {
        const insertCi = await this.db.query(
          `INSERT INTO proposal_credit_info (proposal_id, entity_type, participant_id) VALUES ($1, $2, $3) RETURNING id`,
          [proposalId, entityType, participantId]
        );
        creditInfoId = insertCi.rows[0].id;
      } else {
        creditInfoId = ci.id;
      }
    }

    const values = [
      creditInfoId,
      data.bank_name || null,
      data.branch_name || null,
      data.reason_of_loan || null,
      data.loan_type || null,
      data.sanctioned_amount || 0,
      data.sanctioned_date || null,
      data.account_close_date || null
    ];

    if (data.id) {
      const updateQuery = `
        UPDATE proposal_credit_loans_previous_other_banks SET
          bank_name = $2, branch_name = $3, reason_of_loan = $4,
          loan_type = $5, sanctioned_amount = $6, sanctioned_date = $7,
          account_close_date = $8, updated_at = CURRENT_TIMESTAMP
        WHERE id = $9 AND credit_info_id = $1
        RETURNING *
      `;
      const res = await this.db.query(updateQuery, [...values, data.id]);
      return res.rows[0];
    } else {
      const insertQuery = `
        INSERT INTO proposal_credit_loans_previous_other_banks (
          credit_info_id, bank_name, branch_name, reason_of_loan,
          loan_type, sanctioned_amount, sanctioned_date, account_close_date
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING *
      `;
      const res = await this.db.query(insertQuery, values);
      return res.rows[0];
    }
  }

  async deletePreviousLoanOtherBank(loanId: string) {
    const query = `DELETE FROM proposal_credit_loans_previous_other_banks WHERE id = $1`;
    await this.db.query(query, [loanId]);
  }

  async getAccountsThisBank(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    const whereClause = entityType === 'B'
      ? 'ci.proposal_id = $1 AND ci.entity_type = \'B\''
      : 'ci.participant_id = $1';
    const query = `
      SELECT a.*, b.branch_name
      FROM proposal_credit_accounts_this_bank a
      INNER JOIN proposal_credit_info ci ON a.credit_info_id = ci.id
      LEFT JOIN branches b ON a.branch_id = b.id
      WHERE ${whereClause}
      ORDER BY a.created_at ASC
    `;
    const res = await this.db.query(query, [entityType === 'B' ? proposalId : participantId]);
    return res.rows;
  }

  async upsertAccountThisBank(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    let creditInfoId = data.credit_info_id;
    if (!creditInfoId) {
      const ci = await this.getCreditInfo(proposalId, entityType, participantId);
      if (!ci) {
        const insertCi = await this.db.query(
          `INSERT INTO proposal_credit_info (proposal_id, entity_type, participant_id) VALUES ($1, $2, $3) RETURNING id`,
          [proposalId, entityType, participantId]
        );
        creditInfoId = insertCi.rows[0].id;
      } else {
        creditInfoId = ci.id;
      }
    }

    const values = [
      creditInfoId,
      data.branch_id || null,
      data.account_type || null,
      data.account_no || null,
      data.opening_date || null,
      data.amount || 0,
      data.is_mortgaged_for_this_loan ?? false,
      data.is_prime_security ?? false,
      data.is_collateral_security ?? false,
      data.expiration_date || null,
      data.is_loan_taken_on_this_bank_deposit ?? false,
      data.loan_details || null
    ];

    if (data.id) {
      const updateQuery = `
        UPDATE proposal_credit_accounts_this_bank SET
          branch_id = $2, account_type = $3, account_no = $4,
          opening_date = $5, amount = $6, is_mortgaged_for_this_loan = $7,
          is_prime_security = $8, is_collateral_security = $9,
          expiration_date = $10, is_loan_taken_on_this_bank_deposit = $11,
          loan_details = $12, updated_at = CURRENT_TIMESTAMP
        WHERE id = $13 AND credit_info_id = $1
        RETURNING *
      `;
      const res = await this.db.query(updateQuery, [...values, data.id]);
      return res.rows[0];
    } else {
      const insertQuery = `
        INSERT INTO proposal_credit_accounts_this_bank (
          credit_info_id, branch_id, account_type, account_no,
          opening_date, amount, is_mortgaged_for_this_loan,
          is_prime_security, is_collateral_security, expiration_date,
          is_loan_taken_on_this_bank_deposit, loan_details
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING *
      `;
      const res = await this.db.query(insertQuery, values);
      return res.rows[0];
    }
  }

  async deleteAccountThisBank(accountId: string) {
    const query = `DELETE FROM proposal_credit_accounts_this_bank WHERE id = $1`;
    await this.db.query(query, [accountId]);
  }

  async getAccountsOtherBank(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    const whereClause = entityType === 'B'
      ? 'ci.proposal_id = $1 AND ci.entity_type = \'B\''
      : 'ci.participant_id = $1';
    const query = `
      SELECT a.*
      FROM proposal_credit_accounts_other_banks a
      INNER JOIN proposal_credit_info ci ON a.credit_info_id = ci.id
      WHERE ${whereClause}
      ORDER BY a.created_at ASC
    `;
    const res = await this.db.query(query, [entityType === 'B' ? proposalId : participantId]);
    return res.rows;
  }

  async upsertAccountOtherBank(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    let creditInfoId = data.credit_info_id;
    if (!creditInfoId) {
      const ci = await this.getCreditInfo(proposalId, entityType, participantId);
      if (!ci) {
        const insertCi = await this.db.query(
          `INSERT INTO proposal_credit_info (proposal_id, entity_type, participant_id) VALUES ($1, $2, $3) RETURNING id`,
          [proposalId, entityType, participantId]
        );
        creditInfoId = insertCi.rows[0].id;
      } else {
        creditInfoId = ci.id;
      }
    }

    const values = [
      creditInfoId,
      data.bank_category || null,
      data.is_society_member ?? false,
      data.bank_name || null,
      data.branch_name || null,
      data.account_type || null,
      data.account_no || null,
      data.opening_date || null,
      data.amount || 0,
      data.is_mortgaged_for_this_loan ?? false,
      data.is_prime_security ?? false,
      data.is_collateral_security ?? false,
      data.expiration_date || null,
      data.is_loan_taken_on_this_bank_deposit ?? false,
      data.loan_details || null
    ];

    if (data.id) {
      const updateQuery = `
        UPDATE proposal_credit_accounts_other_banks SET
          bank_category = $2, is_society_member = $3, bank_name = $4,
          branch_name = $5, account_type = $6, account_no = $7,
          opening_date = $8, amount = $9, is_mortgaged_for_this_loan = $10,
          is_prime_security = $11, is_collateral_security = $12,
          expiration_date = $13, is_loan_taken_on_this_bank_deposit = $14,
          loan_details = $15, updated_at = CURRENT_TIMESTAMP
        WHERE id = $16 AND credit_info_id = $1
        RETURNING *
      `;
      const res = await this.db.query(updateQuery, [...values, data.id]);
      return res.rows[0];
    } else {
      const insertQuery = `
        INSERT INTO proposal_credit_accounts_other_banks (
          credit_info_id, bank_category, is_society_member, bank_name,
          branch_name, account_type, account_no, opening_date, amount,
          is_mortgaged_for_this_loan, is_prime_security, is_collateral_security,
          expiration_date, is_loan_taken_on_this_bank_deposit, loan_details
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        ) RETURNING *
      `;
      const res = await this.db.query(insertQuery, values);
      return res.rows[0];
    }
  }

  async deleteAccountOtherBank(accountId: string) {
    const query = `DELETE FROM proposal_credit_accounts_other_banks WHERE id = $1`;
    await this.db.query(query, [accountId]);
  }

  async getLifeInsurances(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    const whereClause = entityType === 'B'
      ? 'ci.proposal_id = $1 AND ci.entity_type = \'B\''
      : 'ci.participant_id = $1';
    const query = `
      SELECT li.*
      FROM proposal_life_insurance li
      INNER JOIN proposal_credit_info ci ON li.credit_info_id = ci.id
      WHERE ${whereClause}
      ORDER BY li.created_at ASC
    `;
    const res = await this.db.query(query, [entityType === 'B' ? proposalId : participantId]);
    return res.rows;
  }

  async upsertLifeInsurance(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    let creditInfoId = data.credit_info_id;
    if (!creditInfoId) {
      const ci = await this.getCreditInfo(proposalId, entityType, participantId);
      if (!ci) {
        const insertCi = await this.db.query(
          `INSERT INTO proposal_credit_info (proposal_id, entity_type, participant_id) VALUES ($1, $2, $3) RETURNING id`,
          [proposalId, entityType, participantId]
        );
        creditInfoId = insertCi.rows[0].id;
      } else {
        creditInfoId = ci.id;
      }
    }

    const values = [
      creditInfoId,
      data.insurance_date || null,
      data.maturity_date || null,
      data.company_name || null,
      data.policy_number || null,
      data.policy_amount || 0,
      data.installment_amount || 0,
      data.premium_amount_yearly || 0,
      data.premium_mode || null,
      data.amount_paid_till_date || 0,
      data.has_loan ?? false,
      data.loan_remaining_amount || 0,
      data.will_assign_policy ?? false,
      data.non_assignment_reason || null
    ];

    if (data.id) {
      const updateQuery = `
        UPDATE proposal_life_insurance SET
          insurance_date = $2, maturity_date = $3, company_name = $4,
          policy_number = $5, policy_amount = $6, installment_amount = $7,
          premium_amount_yearly = $8, premium_mode = $9, 
          amount_paid_till_date = $10, has_loan = $11, 
          loan_remaining_amount = $12, will_assign_policy = $13,
          non_assignment_reason = $14, updated_at = CURRENT_TIMESTAMP
        WHERE id = $15 AND credit_info_id = $1
        RETURNING *
      `;
      const res = await this.db.query(updateQuery, [...values, data.id]);
      return res.rows[0];
    } else {
      const insertQuery = `
        INSERT INTO proposal_life_insurance (
          credit_info_id, insurance_date, maturity_date, company_name,
          policy_number, policy_amount, installment_amount,
          premium_amount_yearly, premium_mode, amount_paid_till_date,
          has_loan, loan_remaining_amount, will_assign_policy,
          non_assignment_reason
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING *
      `;
      const res = await this.db.query(insertQuery, values);
      return res.rows[0];
    }
  }

  async deleteLifeInsurance(policyId: string) {
    const query = `DELETE FROM proposal_life_insurance WHERE id = $1`;
    await this.db.query(query, [policyId]);
  }

  async getNewInsurances(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    const whereClause = entityType === 'B'
      ? 'ci.proposal_id = $1 AND ci.entity_type = \'B\''
      : 'ci.participant_id = $1';
    const query = `
      SELECT ni.*
      FROM proposal_new_insurance ni
      INNER JOIN proposal_credit_info ci ON ni.credit_info_id = ci.id
      WHERE ${whereClause}
      ORDER BY ni.created_at ASC
    `;
    const res = await this.db.query(query, [entityType === 'B' ? proposalId : participantId]);
    return res.rows;
  }

  async upsertNewInsurance(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    let creditInfoId = data.credit_info_id;
    if (!creditInfoId) {
      const ci = await this.getCreditInfo(proposalId, entityType, participantId);
      if (!ci) {
        const insertCi = await this.db.query(
          `INSERT INTO proposal_credit_info (proposal_id, entity_type, participant_id) VALUES ($1, $2, $3) RETURNING id`,
          [proposalId, entityType, participantId]
        );
        creditInfoId = insertCi.rows[0].id;
      } else {
        creditInfoId = ci.id;
      }
    }

    const values = [
      creditInfoId,
      data.insurance_date || null,
      data.maturity_date || null,
      data.company_name || null,
      data.policy_number || null,
      data.policy_amount || 0,
      data.premium_amount || 0,
      data.premium_amount_yearly || 0,
      data.premium_mode || null,
      data.amount_paid_till_date || 0,
      data.is_loan_sought_for_premium ?? false,
      data.will_assign_policy ?? false,
      data.non_assignment_reason || null
    ];

    if (data.id) {
      const updateQuery = `
        UPDATE proposal_new_insurance SET
          insurance_date = $2, maturity_date = $3, company_name = $4,
          policy_number = $5, policy_amount = $6, premium_amount = $7,
          premium_amount_yearly = $8, premium_mode = $9, 
          amount_paid_till_date = $10, is_loan_sought_for_premium = $11, 
          will_assign_policy = $12, non_assignment_reason = $13,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $14 AND credit_info_id = $1
        RETURNING *
      `;
      const res = await this.db.query(updateQuery, [...values, data.id]);
      return res.rows[0];
    } else {
      const insertQuery = `
        INSERT INTO proposal_new_insurance (
          credit_info_id, insurance_date, maturity_date, company_name,
          policy_number, policy_amount, premium_amount,
          premium_amount_yearly, premium_mode, amount_paid_till_date,
          is_loan_sought_for_premium, will_assign_policy,
          non_assignment_reason
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) RETURNING *
      `;
      const res = await this.db.query(insertQuery, values);
      return res.rows[0];
    }
  }

  async deleteNewInsurance(policyId: string) {
    const query = `DELETE FROM proposal_new_insurance WHERE id = $1`;
    await this.db.query(query, [policyId]);
  }

  async getRocDebts(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    const whereClause = entityType === 'B'
      ? 'ci.proposal_id = $1 AND ci.entity_type = \'B\''
      : 'ci.participant_id = $1';
    const query = `
      SELECT rd.*
      FROM proposal_roc_debts rd
      INNER JOIN proposal_credit_info ci ON rd.credit_info_id = ci.id
      WHERE ${whereClause}
      ORDER BY rd.created_at ASC
    `;
    const res = await this.db.query(query, [entityType === 'B' ? proposalId : participantId]);
    return res.rows;
  }

  async upsertRocDebt(proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    let creditInfoId = data.credit_info_id;
    if (!creditInfoId) {
      const ci = await this.getCreditInfo(proposalId, entityType, participantId);
      if (!ci) {
        const insertCi = await this.db.query(
          `INSERT INTO proposal_credit_info (proposal_id, entity_type, participant_id) VALUES ($1, $2, $3) RETURNING id`,
          [proposalId, entityType, participantId]
        );
        creditInfoId = insertCi.rows[0].id;
      } else {
        creditInfoId = ci.id;
      }
    }

    const values = [
      creditInfoId,
      data.srn || null,
      data.charge_id || null,
      data.creation_date || null,
      data.charge_amount || 0,
      data.charge_holder || null
    ];

    if (data.id) {
      const updateQuery = `
        UPDATE proposal_roc_debts SET
          srn = $2, charge_id = $3, creation_date = $4,
          charge_amount = $5, charge_holder = $6, updated_at = CURRENT_TIMESTAMP
        WHERE id = $7 AND credit_info_id = $1
        RETURNING *
      `;
      const res = await this.db.query(updateQuery, [...values, data.id]);
      return res.rows[0];
    } else {
      const insertQuery = `
        INSERT INTO proposal_roc_debts (
          credit_info_id, srn, charge_id, creation_date,
          charge_amount, charge_holder
        ) VALUES (
          $1, $2, $3, $4, $5, $6
        ) RETURNING *
      `;
      const res = await this.db.query(insertQuery, values);
      return res.rows[0];
    }
  }

  async deleteRocDebt(debtId: string) {
    const query = `DELETE FROM proposal_roc_debts WHERE id = $1`;
    await this.db.query(query, [debtId]);
  }

  async getIncomes(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    const incomes: any = {
      jobs: [],
      businesses: [],
      professions: [],
      agriculture: [],
      rents: [],
      milk: [],
      others: []
    };

    const whereClause = entityType === 'B'
      ? 'proposal_id = $1 AND entity_type = \'B\''
      : 'participant_id = $1';
    const params = [entityType === 'B' ? proposalId : participantId];

    // 1. Jobs
    const jobRes = await this.db.query(`SELECT * FROM proposal_income_job WHERE ${whereClause} ORDER BY created_at ASC`, params);
    incomes.jobs = jobRes.rows;

    // 2. Businesses and Professions
    const bizRes = await this.db.query(`SELECT * FROM proposal_income_business WHERE ${whereClause} ORDER BY created_at ASC`, params);
    for (const biz of bizRes.rows) {
      const branches = await this.db.query(`SELECT * FROM proposal_income_business_branches WHERE business_id = $1`, [biz.id]);
      const licenses = await this.db.query(`SELECT * FROM proposal_income_business_licenses WHERE business_id = $1`, [biz.id]);
      const financials = await this.db.query(`SELECT * FROM proposal_income_business_financials WHERE business_id = $1 ORDER BY year_order ASC`, [biz.id]);
      biz.branches = branches.rows;
      biz.licenses = licenses.rows;
      biz.financials = financials.rows;
    }
    incomes.businesses = bizRes.rows.filter((b: any) => b.category === 'business');
    incomes.professions = bizRes.rows.filter((b: any) => b.category === 'profession');

    // 3. Agriculture
    const agriRes = await this.db.query(`SELECT * FROM proposal_income_agriculture WHERE ${whereClause} ORDER BY created_at ASC`, params);
    for (const agri of agriRes.rows) {
      const bills = await this.db.query(`SELECT * FROM proposal_income_agri_sugarcane_bills WHERE agri_id = $1`, [agri.id]);
      const nextSeason = await this.db.query(`SELECT * FROM proposal_income_agri_next_season WHERE agri_id = $1`, [agri.id]);
      agri.sugarcane_bills = bills.rows;
      agri.next_season = nextSeason.rows;
    }
    incomes.agriculture = agriRes.rows;

    // 4. Rents
    const rentRes = await this.db.query(`SELECT * FROM proposal_income_rent WHERE ${whereClause} ORDER BY created_at ASC`, params);
    incomes.rents = rentRes.rows;

    // 5. Milk
    const milkRes = await this.db.query(`SELECT * FROM proposal_income_milk WHERE ${whereClause} ORDER BY created_at ASC`, params);
    for (const milk of milkRes.rows) {
      const rows = await this.db.query(`SELECT * FROM proposal_income_milk_rows WHERE milk_id = $1`, [milk.id]);
      milk.rows = rows.rows;
    }
    incomes.milk = milkRes.rows;

    // 6. Others
    const otherRes = await this.db.query(`SELECT * FROM proposal_income_other WHERE ${whereClause} ORDER BY created_at ASC`, params);
    incomes.others = otherRes.rows;

    return incomes;
  }

  async updateIncome(proposalId: string, category: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    if (!data) return null;

    return await this.db.transaction(async (client) => {
      let result;
      switch (category.toLowerCase()) {
        case 'job':
          result = await this.upsertJobIncome(client, proposalId, data, entityType, participantId);
          break;
        case 'business':
        case 'profession':
          result = await this.upsertBusinessIncome(client, proposalId, category, data, entityType, participantId);
          break;
        case 'agriculture':
          result = await this.upsertAgriIncome(client, proposalId, data, entityType, participantId);
          break;
        case 'rent':
          result = await this.upsertRentIncome(client, proposalId, data, entityType, participantId);
          break;
        case 'milk':
          result = await this.upsertMilkIncome(client, proposalId, data, entityType, participantId);
          break;
        case 'other':
          result = await this.upsertOtherIncome(client, proposalId, data, entityType, participantId);
          break;
        default:
          throw new Error(`Invalid income category: ${category}`);
      }

      // Mark 'income' tab as filled
      await this.markTabAsFilledInternal(client, proposalId, 'income', entityType, participantId);
      return result;
    });
  }

  async deleteIncome(id: string, category: string) {
    let tableName = '';
    switch (category.toLowerCase()) {
      case 'job': tableName = 'proposal_income_job'; break;
      case 'business':
      case 'profession': tableName = 'proposal_income_business'; break;
      case 'agriculture': tableName = 'proposal_income_agriculture'; break;
      case 'rent': tableName = 'proposal_income_rent'; break;
      case 'milk': tableName = 'proposal_income_milk'; break;
      case 'other': tableName = 'proposal_income_other'; break;
      default: throw new Error(`Invalid income category: ${category}`);
    }
    const query = `DELETE FROM ${tableName} WHERE id = $1`;
    return await this.db.query(query, [id]);
  }

  private async upsertJobIncome(client: any, proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    const id = data.id || this.idService.generate();
    const query = `
      INSERT INTO proposal_income_job (
        id, proposal_id, entity_type, participant_id, organization_name, organization_contact, branch, department, designation,
        token_number, branch_address, branch_contact, job_details, job_type, nature_of_job,
        service_date, retirement_date, last_salary_month, permanent_date, has_salary_proof,
        years_employed, salary_grade, basic_salary, grade_pay, da_amount, hra_amount,
        other_allowance, other_income_amount, other_income_info, total_gross_salary,
        provident_fund, insurance_amount, professional_tax, loan_installment,
        savings_reduction, society_deduction, other_deduction_amount, other_deduction_info,
        total_deduction, net_salary, transfer_possibility, transfer_replacement_place,
        has_pension_scheme, total_provident_fund, will_deduct_installment,
        is_borrowed, borrowed_amount_to_pay, has_credit_society, is_credit_society_member,
        credit_society_investment_details, credit_society_loan_details, salary_payout_mode,
        org_address, org_landmark, org_state_id, org_district_id, org_taluka_id,
        org_village, org_pincode, salary_bank_name, salary_branch_name, salary_ifsc_code
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
        $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37,
        $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50,
        $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62
      )
      ON CONFLICT (id) DO UPDATE SET
        organization_name = EXCLUDED.organization_name,
        organization_contact = EXCLUDED.organization_contact,
        branch = EXCLUDED.branch,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation,
        token_number = EXCLUDED.token_number,
        branch_address = EXCLUDED.branch_address,
        branch_contact = EXCLUDED.branch_contact,
        job_details = EXCLUDED.job_details,
        job_type = EXCLUDED.job_type,
        nature_of_job = EXCLUDED.nature_of_job,
        service_date = EXCLUDED.service_date,
        retirement_date = EXCLUDED.retirement_date,
        last_salary_month = EXCLUDED.last_salary_month,
        permanent_date = EXCLUDED.permanent_date,
        has_salary_proof = EXCLUDED.has_salary_proof,
        years_employed = EXCLUDED.years_employed,
        salary_grade = EXCLUDED.salary_grade,
        basic_salary = EXCLUDED.basic_salary,
        grade_pay = EXCLUDED.grade_pay,
        da_amount = EXCLUDED.da_amount,
        hra_amount = EXCLUDED.hra_amount,
        other_allowance = EXCLUDED.other_allowance,
        other_income_amount = EXCLUDED.other_income_amount,
        other_income_info = EXCLUDED.other_income_info,
        total_gross_salary = EXCLUDED.total_gross_salary,
        provident_fund = EXCLUDED.provident_fund,
        insurance_amount = EXCLUDED.insurance_amount,
        professional_tax = EXCLUDED.professional_tax,
        loan_installment = EXCLUDED.loan_installment,
        savings_reduction = EXCLUDED.savings_reduction,
        society_deduction = EXCLUDED.society_deduction,
        other_deduction_amount = EXCLUDED.other_deduction_amount,
        other_deduction_info = EXCLUDED.other_deduction_info,
        total_deduction = EXCLUDED.total_deduction,
        net_salary = EXCLUDED.net_salary,
        transfer_possibility = EXCLUDED.transfer_possibility,
        transfer_replacement_place = EXCLUDED.transfer_replacement_place,
        has_pension_scheme = EXCLUDED.has_pension_scheme,
        total_provident_fund = EXCLUDED.total_provident_fund,
        will_deduct_installment = EXCLUDED.will_deduct_installment,
        is_borrowed = EXCLUDED.is_borrowed,
        borrowed_amount_to_pay = EXCLUDED.borrowed_amount_to_pay,
        has_credit_society = EXCLUDED.has_credit_society,
        is_credit_society_member = EXCLUDED.is_credit_society_member,
        credit_society_investment_details = EXCLUDED.credit_society_investment_details,
        credit_society_loan_details = EXCLUDED.credit_society_loan_details,
        salary_payout_mode = EXCLUDED.salary_payout_mode,
        org_address = EXCLUDED.org_address,
        org_landmark = EXCLUDED.org_landmark,
        org_state_id = EXCLUDED.org_state_id,
        org_district_id = EXCLUDED.org_district_id,
        org_taluka_id = EXCLUDED.org_taluka_id,
        org_village = EXCLUDED.org_village,
        org_pincode = EXCLUDED.org_pincode,
        salary_bank_name = EXCLUDED.salary_bank_name,
        salary_branch_name = EXCLUDED.salary_branch_name,
        salary_ifsc_code = EXCLUDED.salary_ifsc_code,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const values = [
      id, proposalId, entityType, participantId, data.organization_name, data.organization_contact, data.branch, data.department, data.designation,
      data.token_number, data.branch_address, data.branch_contact, data.job_details, data.job_type, data.nature_of_job,
      data.service_date ? new Date(data.service_date) : null, data.retirement_date ? new Date(data.retirement_date) : null,
      data.last_salary_month ? new Date(data.last_salary_month) : null, data.permanent_date ? new Date(data.permanent_date) : null, data.has_salary_proof ?? false,
      data.years_employed ?? 0, data.salary_grade, data.basic_salary ?? 0, data.grade_pay ?? 0, data.da_amount ?? 0, data.hra_amount ?? 0,
      data.other_allowance ?? 0, data.other_income_amount ?? 0, data.other_income_info, data.total_gross_salary ?? 0,
      data.provident_fund ?? 0, data.insurance_amount ?? 0, data.professional_tax ?? 0, data.loan_installment ?? 0,
      data.savings_reduction ?? 0, data.society_deduction ?? 0, data.other_deduction_amount ?? 0, data.other_deduction_info,
      data.total_deduction ?? 0, data.net_salary ?? 0, data.transfer_possibility ?? false, data.transfer_replacement_place,
      data.has_pension_scheme ?? false, data.total_provident_fund ?? 0, data.will_deduct_installment ?? false,
      data.is_borrowed ?? false, data.borrowed_amount_to_pay ?? 0, data.has_credit_society ?? false, data.is_credit_society_member ?? false,
      data.credit_society_investment_details, data.credit_society_loan_details, data.salary_payout_mode,
      data.org_address, data.org_landmark, data.org_state_id, data.org_district_id, data.org_taluka_id,
      data.org_village, data.org_pincode, data.salary_bank_name, data.salary_branch_name, data.salary_ifsc_code
    ];
    const res = await client.query(query, values);
    return res.rows[0];
  }

  private async upsertBusinessIncome(client: any, proposalId: string, category: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    const id = data.id || this.idService.generate();
    const query = `
      INSERT INTO proposal_income_business (
        id, proposal_id, entity_type, participant_id, category, firm_name, nature_of_business, license_owner_name,
        years_in_business, turnover_amount, net_profit_loss, contact_no, email_id,
        space_status, business_constitution, pan_number, has_required_laws,
        ownership_type, is_msme_registered, msme_registration_number,
        msme_registration_date, has_dist_cert, has_gst_cert, gst_number,
        is_shop_act_licensed, shop_act_number, is_shop_act_renewed,
       business_remark,
place_owner_name,
has_rental_agreement,
lease_expiry_date,
business_address,
address,
landmark,
state_id,
district_id,
taluka_id,
village,
pincode
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39
      )
      ON CONFLICT (id) DO UPDATE SET
        firm_name = EXCLUDED.firm_name,
        nature_of_business = EXCLUDED.nature_of_business,
        license_owner_name = EXCLUDED.license_owner_name,
        years_in_business = EXCLUDED.years_in_business,
        turnover_amount = EXCLUDED.turnover_amount,
        net_profit_loss = EXCLUDED.net_profit_loss,
        contact_no = EXCLUDED.contact_no,
        email_id = EXCLUDED.email_id,
        space_status = EXCLUDED.space_status,
        business_constitution = EXCLUDED.business_constitution,
        pan_number = EXCLUDED.pan_number,
        has_required_laws = EXCLUDED.has_required_laws,
        ownership_type = EXCLUDED.ownership_type,
        is_msme_registered = EXCLUDED.is_msme_registered,
        msme_registration_number = EXCLUDED.msme_registration_number,
        msme_registration_date = EXCLUDED.msme_registration_date,
        has_dist_cert = EXCLUDED.has_dist_cert,
        has_gst_cert = EXCLUDED.has_gst_cert,
        gst_number = EXCLUDED.gst_number,
        is_shop_act_licensed = EXCLUDED.is_shop_act_licensed,
        shop_act_number = EXCLUDED.shop_act_number,
        is_shop_act_renewed = EXCLUDED.is_shop_act_renewed,
        business_remark = EXCLUDED.business_remark,
        address = EXCLUDED.address,
        landmark = EXCLUDED.landmark,
        state_id = EXCLUDED.state_id,
        district_id = EXCLUDED.district_id,
        taluka_id = EXCLUDED.taluka_id,
        village = EXCLUDED.village,
        pincode = EXCLUDED.pincode,
        place_owner_name = EXCLUDED.place_owner_name,
        has_rental_agreement = EXCLUDED.has_rental_agreement,
        lease_expiry_date = EXCLUDED.lease_expiry_date,
        business_address = EXCLUDED.business_address,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const values = [
      id, proposalId, entityType, participantId, category, data.firm_name, data.nature_of_business, data.license_owner_name,
      data.years_in_business ?? 0, data.turnover_amount ?? 0, data.net_profit_loss ?? 0, data.contact_no, data.email_id,
      data.space_status, data.business_constitution, data.pan_number, data.has_required_laws ?? false,
      data.ownership_type, data.is_msme_registered ?? false, data.msme_registration_number,
      data.msme_registration_date ? new Date(data.msme_registration_date) : null,
      data.has_dist_cert ?? false, data.has_gst_cert ?? false, data.gst_number, data.is_shop_act_licensed ?? false,
      data.shop_act_number, data.is_shop_act_renewed ?? false, data.business_remark,
      data.place_owner_name,
      data.has_rental_agreement ?? false,
      data.lease_expiry_date ? new Date(data.lease_expiry_date) : null,
      data.business_address,
      data.address,
      data.landmark,
      data.state_id,
      data.district_id,
      data.taluka_id,
      data.village,
      data.pincode
    ];
    const res = await client.query(query, values);

    // Sync Financial Years
    await client.query(`DELETE FROM proposal_income_business_financials WHERE business_id = $1`, [id]);
    if (data.financials && Array.isArray(data.financials)) {
      for (const fy of data.financials) {
        const fyId = fy.id || this.idService.generate();
        await client.query(`
          INSERT INTO proposal_income_business_financials (
            id, business_id, year_order, year_label,
            sales, purchases, depreciation, int_on_cc, int_on_tl, net_profit,
            capital, cash_credit_loan, term_loan, unsecured_loans, creditors, other_liabilities,
            fixed_asset, investments, stock, debtors, cash_and_bank, loans_and_advances, other_asset
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
        `, [
          fyId, id, fy.year_order, fy.year_label,
          fy.sales ?? 0, fy.purchases ?? 0, fy.depreciation ?? 0, fy.int_on_cc ?? 0, fy.int_on_tl ?? 0, fy.net_profit ?? 0,
          fy.capital ?? 0, fy.cash_credit_loan ?? 0, fy.term_loan ?? 0, fy.unsecured_loans ?? 0, fy.creditors ?? 0, fy.other_liabilities ?? 0,
          fy.fixed_asset ?? 0, fy.investments ?? 0, fy.stock ?? 0, fy.debtors ?? 0, fy.cash_and_bank ?? 0, fy.loans_and_advances ?? 0, fy.other_asset ?? 0
        ]);
      }
    }

    // Sync Branches
    await client.query(`DELETE FROM proposal_income_business_branches WHERE business_id = $1`, [id]);
    if (data.branches && Array.isArray(data.branches)) {
      for (const b of data.branches) {
        const branchId = b.id || this.idService.generate();
        await client.query(`
          INSERT INTO proposal_income_business_branches (id, business_id, branch_name, address, landmark, state_id, district_id, taluka_id, village, pincode)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [branchId, id, b.branch_name, b.address, b.landmark, b.state_id, b.district_id, b.taluka_id, b.village, b.pincode]);
      }
    }

    // Sync Licenses
    await client.query(`DELETE FROM proposal_income_business_licenses WHERE business_id = $1`, [id]);
    // Sync Licenses
    await client.query(`DELETE FROM proposal_income_business_licenses WHERE business_id = $1`, [id]);
    if (data.licenses && Array.isArray(data.licenses)) {
      for (const l of data.licenses) {
        const licId = l.id || this.idService.generate();
        await client.query(`
          INSERT INTO proposal_income_business_licenses (id, business_id, license_name, license_number)
          VALUES ($1, $2, $3, $4)
        `, [licId, id, l.license_name, l.license_number]);
      }
    }

    return res.rows[0];
  }

  private async upsertAgriIncome(client: any, proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    const id = data.id || this.idService.generate();
    const query = `
      INSERT INTO proposal_income_agriculture (
        id, proposal_id, entity_type, participant_id, land_owner_name, current_crops, annual_income,
        horticulture_hector, horticulture_aar, arable_hector, arable_aar,
        total_agri_hector, total_agri_aar, sugarcane_hector, sugarcane_aar,
        other_crop_hector, other_crop_aar, income_sugarcane, income_other,
        total_agri_income, address, group_no, state_id, district_id,
        taluka_id, village, pincode
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      )
      ON CONFLICT (id) DO UPDATE SET
        land_owner_name = EXCLUDED.land_owner_name,
        current_crops = EXCLUDED.current_crops,
        annual_income = EXCLUDED.annual_income,
        horticulture_hector = EXCLUDED.horticulture_hector,
        horticulture_aar = EXCLUDED.horticulture_aar,
        arable_hector = EXCLUDED.arable_hector,
        arable_aar = EXCLUDED.arable_aar,
        total_agri_hector = EXCLUDED.total_agri_hector,
        total_agri_aar = EXCLUDED.total_agri_aar,
        sugarcane_hector = EXCLUDED.sugarcane_hector,
        sugarcane_aar = EXCLUDED.sugarcane_aar,
        other_crop_hector = EXCLUDED.other_crop_hector,
        other_crop_aar = EXCLUDED.other_crop_aar,
        income_sugarcane = EXCLUDED.income_sugarcane,
        income_other = EXCLUDED.income_other,
        total_agri_income = EXCLUDED.total_agri_income,
        address = EXCLUDED.address,
        group_no = EXCLUDED.group_no,
        state_id = EXCLUDED.state_id,
        district_id = EXCLUDED.district_id,
        taluka_id = EXCLUDED.taluka_id,
        village = EXCLUDED.village,
        pincode = EXCLUDED.pincode,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const values = [
      id, proposalId, entityType, participantId, data.land_owner_name, data.current_crops, data.annual_income ?? 0,
      data.horticulture_hector ?? 0, data.horticulture_aar ?? 0, data.arable_hector ?? 0, data.arable_aar ?? 0,
      data.total_agri_hector ?? 0, data.total_agri_aar ?? 0, data.sugarcane_hector ?? 0, data.sugarcane_aar ?? 0,
      data.other_crop_hector ?? 0, data.other_crop_aar ?? 0, data.income_sugarcane ?? 0, data.income_other ?? 0,
      data.total_agri_income ?? 0, data.address, data.group_no, data.state_id, data.district_id,
      data.taluka_id, data.village, data.pincode
    ];
    const res = await client.query(query, values);

    // Sync Sugarcane Bills
    await client.query(`DELETE FROM proposal_income_agri_sugarcane_bills WHERE agri_id = $1`, [id]);
    if (data.sugarcane_bills && Array.isArray(data.sugarcane_bills)) {
      for (const b of data.sugarcane_bills) {
        const billId = b.id || this.idService.generate();
        await client.query(`
          INSERT INTO proposal_income_agri_sugarcane_bills (id, agri_id, factory_name, dry_season, sugarcane_area, tonnage, bill_amount)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [billId, id, b.factory_name, b.dry_season, b.sugarcane_area, b.tonnage ?? 0, b.bill_amount ?? 0]);
      }
    }

    // Sync Next Season Area
    await client.query(`DELETE FROM proposal_income_agri_next_season WHERE agri_id = $1`, [id]);
    if (data.next_season && Array.isArray(data.next_season)) {
      for (const ns of data.next_season) {
        const nsId = ns.id || this.idService.generate();
        await client.query(`
          INSERT INTO proposal_income_agri_next_season (id, agri_id, factory_name, dry_season, sugarcane_area)
          VALUES ($1, $2, $3, $4, $5)
        `, [nsId, id, ns.factory_name, ns.dry_season, ns.sugarcane_area]);
      }
    }

    return res.rows[0];
  }

  private async upsertRentIncome(client: any, proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    const id = data.id || this.idService.generate();
    const query = `
      INSERT INTO proposal_income_rent (
        id, proposal_id, entity_type, participant_id, rented_to_name, property_no, has_agreement,
        agreement_term, lease_expiry_date, monthly_rent_amount, gst_amount,
        tds_amount, net_rent_received, is_rent_discounting_scheme, remark
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        rented_to_name = EXCLUDED.rented_to_name,
        property_no = EXCLUDED.property_no,
        has_agreement = EXCLUDED.has_agreement,
        agreement_term = EXCLUDED.agreement_term,
        lease_expiry_date = EXCLUDED.lease_expiry_date,
        monthly_rent_amount = EXCLUDED.monthly_rent_amount,
        gst_amount = EXCLUDED.gst_amount,
        tds_amount = EXCLUDED.tds_amount,
        net_rent_received = EXCLUDED.net_rent_received,
        is_rent_discounting_scheme = EXCLUDED.is_rent_discounting_scheme,
        remark = EXCLUDED.remark,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const values = [
      id, proposalId, entityType, participantId, data.rented_to_name, data.property_no, data.has_agreement ?? false,
      data.agreement_term, data.lease_expiry_date ? new Date(data.lease_expiry_date) : null,
      data.monthly_rent_amount ?? 0, data.gst_amount ?? 0, data.tds_amount ?? 0,
      data.net_rent_received ?? 0, data.is_rent_discounting_scheme ?? false, data.remark
    ];
    const res = await client.query(query, values);
    return res.rows[0];
  }

  private async upsertMilkIncome(client: any, proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    const id = data.id || this.idService.generate();
    const query = `
      INSERT INTO proposal_income_milk (id, proposal_id, entity_type, participant_id, remark)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        remark = EXCLUDED.remark,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const res = await client.query(query, [id, proposalId, entityType, participantId, data.remark]);

    // Sync Rows
    await client.query(`DELETE FROM proposal_income_milk_rows WHERE milk_id = $1`, [id]);
    if (data.rows && Array.isArray(data.rows)) {
      for (const r of data.rows) {
        const rowId = r.id || this.idService.generate();
        await client.query(`
          INSERT INTO proposal_income_milk_rows (id, milk_id, duration_label, morning_litre, morning_rate, morning_amount, evening_litre, evening_rate, evening_amount)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [rowId, id, r.duration_label, r.morning_litre ?? 0, r.morning_rate ?? 0, r.morning_amount ?? 0, r.evening_litre ?? 0, r.evening_rate ?? 0, r.evening_amount ?? 0]);
      }
    }

    return res.rows[0];
  }

  private async upsertOtherIncome(client: any, proposalId: string, data: any, entityType: string = 'B', participantId: string | null = null) {
    const id = data.id || this.idService.generate();
    const query = `
      INSERT INTO proposal_income_other (
        id, proposal_id, entity_type, participant_id, source_name, source_type, years_active,
        annual_income, contact_no, landmark, state_id, district_id,
        taluka_id, village, pincode, address, details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (id) DO UPDATE SET
        source_name = EXCLUDED.source_name,
        source_type = EXCLUDED.source_type,
        years_active = EXCLUDED.years_active,
        annual_income = EXCLUDED.annual_income,
        contact_no = EXCLUDED.contact_no,
        landmark = EXCLUDED.landmark,
        state_id = EXCLUDED.state_id,
        district_id = EXCLUDED.district_id,
        taluka_id = EXCLUDED.taluka_id,
        village = EXCLUDED.village,
        pincode = EXCLUDED.pincode,
        address = EXCLUDED.address,
        details = EXCLUDED.details,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const values = [
      id, proposalId, entityType, participantId, data.source_name, data.source_type, data.years_active ?? 0,
      data.annual_income ?? 0, data.contact_no, data.landmark, data.state_id,
      data.district_id, data.taluka_id, data.village, data.pincode, data.address, data.details
    ];
    const res = await client.query(query, values);
    return res.rows[0];
  }


  async getProposalTabs(proposalId: string, entityType: string = 'B', participantId: string | null = null) {
    // 1. Try to fetch specific mapping for this proposal/participant
    const mappingQuery = `
      SELECT 
        tm.key, tm.label, tm.icon, tm.sort_order, ptm.is_mandatory, ptm.is_filled
      FROM proposal_tab_mapping ptm
      JOIN tab_master tm ON ptm.tab_id = tm.id
      WHERE ptm.proposal_id = $1 
        AND ptm.entity_type = $2
        AND (ptm.participant_id = $3 OR (ptm.participant_id IS NULL AND $3 IS NULL))
        AND tm.is_active = TRUE
      ORDER BY ptm.sort_order ASC, tm.sort_order ASC
    `;
    const mappedResult = await this.db.query(mappingQuery, [proposalId, entityType, participantId]);

    if (mappedResult.rowCount > 0) {
      return mappedResult.rows;
    }

    // 2. Fallback: Fetch all active tabs from master if no specific mapping exists
    const masterQuery = `
      SELECT key, label, icon, sort_order, TRUE as is_mandatory, FALSE as is_filled
      FROM tab_master
      WHERE is_active = TRUE
      ORDER BY sort_order ASC
    `;
    const masterResult = await this.db.query(masterQuery);
    return masterResult.rows;
  }

  async getTabMaster() {
    const query = `
      SELECT key, label, icon, sort_order
      FROM tab_master
      WHERE is_active = TRUE
      ORDER BY sort_order ASC
    `;
    const result = await this.db.query(query);
    return result.rows;
  }

  async updateProposalTabsMapping(proposalId: string, tabKeys: string[]) {
    return await this.db.transaction(async (client) => {
      // 1. Delete existing mappings for this proposal
      const deleteQuery = `DELETE FROM proposal_tab_mapping WHERE proposal_id = $1`;
      await client.query(deleteQuery, [proposalId]);

      if (!tabKeys || tabKeys.length === 0) return [];

      // 2. Resolve tab keys to IDs and sort_orders from tab_master
      const placeholders = tabKeys.map((_, i) => `$${i + 1}`).join(', ');
      const resolveQuery = `SELECT id, key, sort_order FROM tab_master WHERE key IN (${placeholders}) AND is_active = TRUE`;
      const tabMasterResult = await client.query(resolveQuery, tabKeys);

      const tabInfoMap = new Map<string, { id: string, sort_order: number }>();
      tabMasterResult.rows.forEach(row => tabInfoMap.set(row.key, {
        id: row.id,
        sort_order: row.sort_order
      }));

      // 3. Insert new mappings in the order provided
      const insertedRows = [];
      for (let i = 0; i < tabKeys.length; i++) {
        const key = tabKeys[i];
        const tabInfo = tabInfoMap.get(key);

        if (tabInfo) {
          const mappingId = this.idService.generate();
          const insertQuery = `
            INSERT INTO proposal_tab_mapping (id, proposal_id, tab_id, sort_order)
            VALUES ($1, $2, $3, $4)
            RETURNING *
          `;
          const res = await client.query(insertQuery, [mappingId, proposalId, tabInfo.id, tabInfo.sort_order]);
          insertedRows.push(res.rows[0]);
        }
      }

      return insertedRows;
    });
  }

  /**
   * Helper to mark a tab as filled.
   * Internal version for use within an existing transaction.
   */
  private async markTabAsFilledInternal(client: any, proposalId: string, tabKey: string, entityType: string = 'B', participantId: string | null = null) {
    const query = `
      INSERT INTO proposal_tab_mapping (id, proposal_id, tab_id, is_filled, sort_order, entity_type, participant_id)
      SELECT $1, $2, id, TRUE, sort_order, $4, $5
      FROM tab_master
      WHERE key = $3
      ON CONFLICT (proposal_id, tab_id, entity_type, (COALESCE(participant_id, ''))) DO UPDATE 
      SET is_filled = TRUE, updated_at = CURRENT_TIMESTAMP
    `;
    const id = this.idService.generate();
    return await client.query(query, [id, proposalId, tabKey, entityType, participantId]);
  }

  /**
   * Helper to mark a tab as filled (standard call).
   */
  async markTabAsFilled(proposalId: string, tabKey: string, entityType: string = 'B', participantId: string | null = null) {
    return await this.markTabAsFilledInternal(this.db, proposalId, tabKey, entityType, participantId);
  }

  async submitProposal(proposalId: string, remarks: string) {
    const query = `
      UPDATE proposals 
      SET status = 'Submitted', 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `;
    await this.db.query(query, [proposalId]);

    // Optional: save submission remarks in a separate audit table or a column if exists
    // For now, we'll just update the status.
    return { status: 'Submitted' };
  }

  async getBranchReportData(proposalId: string) {
    const personalInfo = await this.getPersonalInfo(proposalId);
    const loanInfo = await this.getLoanInfo(proposalId);

    // Fetch basic proposal info for applicant details
    const proposalRes = await this.db.query('SELECT * FROM proposals WHERE id = $1', [proposalId]);
    const proposal = proposalRes.rows[0];

    return {
      branchName: 'SANGAMNER MAIN', // Placeholder
      applicant: {
        name: proposal?.applicant_name || '',
        age: proposal?.age || '',
        pan: proposal?.pan_number || '',
        mobile: proposal?.mobile_no || '',
        occupation: personalInfo?.profession || '',
        address: personalInfo?.full_address || '',
      },
      bankAccounts: [], // To be implemented when tables are added
      loans: [], // To be implemented when tables are added
      loanRequest: {
        reason: loanInfo?.reason_of_loan || '',
        amount: loanInfo?.requested_amount || 0,
        duration: loanInfo?.duration_months || 0,
        interest: loanInfo?.interest_rate || 0,
        emi: loanInfo?.monthly_installment || 0,
      },
      dscr: {
        totalA: 0,
        totalB: 0,
        ratio: '0:1',
      },
    };
  }
}
