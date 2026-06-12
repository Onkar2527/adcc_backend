import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import { DatabaseService } from '../src/core/database/database.service';
import { syncAssessmentScoring } from '../src/common/helpers/assessment-scoring.helper';
import { ConfigService } from '@nestjs/config';

async function run() {
  const configService = new ConfigService();
  const db = new DatabaseService(configService);
  db.onModuleInit();

  try {
    console.log('Fetching all completed assessments (status > 3)...');
    const result = await db.query(
      `SELECT id FROM audit_assesment_master WHERE audit_status_id > 3 AND deleted_at IS NULL ORDER BY id ASC`
    );
    
    console.log(`Found ${result.rows.length} assessments to sync.`);
    
    for (let i = 0; i < result.rows.length; i++) {
      const assessmentId = Number(result.rows[i].id);
      console.log(`[${i + 1}/${result.rows.length}] Syncing assessment ID ${assessmentId}...`);
      try {
        await syncAssessmentScoring(db, assessmentId);
      } catch (err: any) {
        console.error(`Failed to sync assessment ID ${assessmentId}:`, err.message);
      }
    }
    
    console.log('All assessments synchronized successfully!');
  } catch (err) {
    console.error('Failed to run sync:', err);
  } finally {
    await db.onModuleDestroy();
  }
}

run();
