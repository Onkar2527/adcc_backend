import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DatabaseService } from './src/core/database/database.service';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  const migrationPath = path.join(__dirname, 'database', 'migrations', '20260611_add_audit_calendar.sql');
  console.log(`Reading migration from: ${migrationPath}`);
  
  if (!fs.existsSync(migrationPath)) {
    console.error('Migration file not found!');
    await app.close();
    return;
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executing SQL migration for audit_calendar...');
  try {
    await db.query(sql);
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await app.close();
  }
}

bootstrap();
