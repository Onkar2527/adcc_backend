import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { IdService } from '../../core/id/id.service';


@Injectable()
export class AuditorDataService {
  private readonly logger = new Logger(AuditorDataService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly idService: IdService,
  ) {}

 async findAll(auditortId:number) {

    const query = `

SELECT 

    au.audit_unit_code,
    au.name,

    COUNT(am.id) AS total_audit,

    SUM(
        CASE 
            WHEN am.audit_status_id = '1'
            THEN 1
            ELSE 0
        END
    ) AS audit_pending,

    SUM(
        CASE 
            WHEN am.audit_status_id = '5'
            THEN 1
            ELSE 0
        END
    ) AS review_pending,

    SUM(
        CASE 
            WHEN am.audit_status_id = '4'
            THEN 1
            ELSE 0
        END
    ) AS compliance_pending,

    SUM(
        CASE 
            WHEN am.audit_status_id = '7'
            THEN 1
            ELSE 0
        END
    ) AS audit_completed,

    CASE MAX(am.audit_status_id)

        WHEN '1'
        THEN 'AUDIT (PENDING / ACTIVE)'

        WHEN '2'
        THEN 'REVIEW (PENDING / ACTIVE)'

        WHEN '3'
        THEN 'RE AUDIT (PENDING / ACTIVE)'

        WHEN '4'
        THEN 'COMPLIANCE (PENDING / ACTIVE)'

        WHEN '5'
        THEN 'REVIEW (PENDING / ACTIVE)'

        WHEN '6'
        THEN 'RE COMPLIANCE (PENDING / ACTIVE)'

        WHEN '7'
        THEN 'ASSESMENT COMPLETED'

        ELSE 'UNKNOWN'

    END AS last_audit_status

FROM audit_assesment_master am

LEFT JOIN audit_unit_master au

    ON au.audit_unit_code =
       am.audit_unit_id::text

LEFT JOIN employee_master em

    ON am.audit_unit_id::text = ANY(

        string_to_array(
            em.audit_unit_authority,
            ','
        )

    )

WHERE em.id = $1

AND am.year_id = (

    SELECT id
    FROM year_master
    ORDER BY id DESC
    LIMIT 1

)

GROUP BY 

    au.audit_unit_code,
    au.name

ORDER BY 

    au.audit_unit_code;

    `;

    const result =
        await this.db.query(

            query,

            [auditortId]

        );

    return result.rows;

}
}