import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/core/database/database.service';
import { syncAssessmentScoring } from '../src/common/helpers/assessment-scoring.helper';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  const assessmentId = 197;
  console.log(`Recalculating scoring for assessment ${assessmentId}...`);
  try {
    await syncAssessmentScoring(db, assessmentId);
    console.log('Recalculation successful!');

    // Fetch and display updated row
    const res = await db.query(
      `SELECT id, assesment_id, risk_data, weighted_score 
       FROM report_scoring_master 
       WHERE assesment_id = $1 AND deleted_at IS NULL`,
      [assessmentId]
    );
    console.log("Updated report_scoring_master:", JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error('Error during recalculation:', err);
  } finally {
    await app.close();
  }
}

bootstrap();
