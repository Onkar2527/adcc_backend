import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/core/database/database.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  const auditUnitId = 1;
  const assessmentId = "197";

  console.log(`Testing heatmap query for assessmentId ${assessmentId}...`);
  try {
    const heatRes = await db.query(
      `SELECT business_risk, control_risk, COUNT(*)::int AS count
       FROM (
         -- 1. Regular questions
         SELECT 
           NULLIF(ans.business_risk::text, '')::int AS business_risk, 
           NULLIF(ans.control_risk::text, '')::int AS control_risk
         FROM answers_data ans
         INNER JOIN question_master qm ON qm.id = ans.question_id
         WHERE ans.assesment_id = $1
           AND qm.option_id != 4
           AND NULLIF(ans.business_risk::text, '')::int IN (1, 2, 3)
           AND NULLIF(ans.control_risk::text, '')::int IN (1, 2, 3)
           AND ans.is_compliance = 1
           AND ans.deleted_at IS NULL
           AND qm.deleted_at IS NULL

         UNION ALL

         -- 2. Annexure questions (all existing annexure rows are deviations)
         SELECT 
           NULLIF(ax.business_risk::text, '')::int AS business_risk, 
           NULLIF(ax.control_risk::text, '')::int AS control_risk
         FROM answers_data_annexure ax
         INNER JOIN answers_data ans ON ans.id = ax.answer_id
         INNER JOIN question_master qm ON qm.id = ans.question_id
         WHERE ax.assesment_id = $1
           AND qm.option_id = 4
           AND NULLIF(ax.business_risk::text, '')::int IN (1, 2, 3)
           AND NULLIF(ax.control_risk::text, '')::int IN (1, 2, 3)
           AND ax.deleted_at IS NULL
           AND ans.deleted_at IS NULL
           AND qm.deleted_at IS NULL
       ) combined
       GROUP BY business_risk, control_risk`,
      [Number(assessmentId)]
    );
    console.log("Heatmap results:", heatRes.rows);
  } catch (err) {
    console.error("Heatmap query failed:", err.message);
  }

  await app.close();
}

bootstrap();
