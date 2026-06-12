import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DatabaseService } from './src/core/database/database.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  console.log('Dumping risk_branch_rating data...');
  try {
    const res = await db.query('SELECT * FROM risk_branch_rating');
    console.log(`Total branch ratings: ${res.rows.length}`);
    console.log('Sample rows:');
    console.log(res.rows.slice(0, 50));
  } catch (err) {
    console.error('Failed to dump ratings:', err);
  } finally {
    await app.close();
  }
}

bootstrap();
