import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/core/database/database.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  const assessmentId = 197;

  try {
    const res = await db.query(`
      SELECT ans.id, ans.question_id, ans.is_compliance, ans.business_risk, ans.control_risk, qm.option_id
      FROM answers_data ans
      INNER JOIN question_master qm ON qm.id = ans.question_id
      WHERE ans.assesment_id = $1
        AND (ans.business_risk IN ('1', '2', '3') OR ans.control_risk IN ('1', '2', '3'))
        AND ans.deleted_at IS NULL
      LIMIT 20;
    `, [assessmentId]);

    console.log("Answers data sample:");
    console.table(res.rows);

    const counts = await db.query(`
      SELECT 
        COUNT(*) AS total,
        COUNT(CASE WHEN is_compliance = 1 THEN 1 END) AS comp_1,
        COUNT(CASE WHEN is_compliance = 0 THEN 1 END) AS comp_0,
        COUNT(CASE WHEN is_compliance IS NULL THEN 1 END) AS comp_null
      FROM answers_data ans
      INNER JOIN question_master qm ON qm.id = ans.question_id
      WHERE ans.assesment_id = $1
        AND qm.option_id != 4
        AND (ans.business_risk IN ('1', '2', '3') OR ans.control_risk IN ('1', '2', '3'))
        AND ans.deleted_at IS NULL
    `, [assessmentId]);
    console.log("Counts for regular answers with risk:");
    console.table(counts.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await app.close();
  }
}

bootstrap();
