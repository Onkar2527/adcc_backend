import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/core/database/database.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  try {
    const res = await db.query(`
      SELECT id, question, suggestions, mr_suggestions 
      FROM question_master 
      WHERE mr_suggestions IS NOT NULL 
      LIMIT 3
    `);
    
    for (const row of res.rows) {
      console.log(`ID: ${row.id}`);
      console.log(`Question: ${row.question}`);
      console.log(`Suggestions (EN): ${row.suggestions}`);
      console.log(`Suggestions (MR): ${row.mr_suggestions}`);
      console.log("-----------------------------------------");
    }

  } catch (err) {
    console.error(err);
  } finally {
    await app.close();
  }
}

bootstrap();
