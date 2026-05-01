import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DatabaseService } from './src/core/database/database.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  const sql = `
    -- Branches Master
    CREATE TABLE IF NOT EXISTS branches (
      id BIGINT PRIMARY KEY,
      branch_code VARCHAR(50) UNIQUE NOT NULL,
      branch_name VARCHAR(255) NOT NULL,
      address TEXT,
      contact_number VARCHAR(20),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Roles Master
    CREATE TABLE IF NOT EXISTS roles (
      id BIGINT PRIMARY KEY,
      role_name VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Special Roles (Initial Data)
    INSERT INTO roles (id, role_name, description) VALUES 
      (1, 'admin', 'System Administrator'),
      (2, 'bm', 'Branch Manager'),
      (3, 'ba', 'Branch Associate'),
      (4, 'loan_officer', 'Loan Officer')
    ON CONFLICT (id) DO NOTHING;

    -- Users Master
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE,
      mobile_number VARCHAR(20),
      role_id BIGINT REFERENCES roles(id),
      branch_id BIGINT REFERENCES branches(id),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Loan Types Master (Loan Master)
    CREATE TABLE IF NOT EXISTS loan_types (
      id BIGINT PRIMARY KEY,
      type_code VARCHAR(50) UNIQUE NOT NULL,
      type_name VARCHAR(255) NOT NULL,
      description TEXT,
      interest_rate DECIMAL(5, 2),
      max_tenure_months INTEGER,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  console.log('Executing SQL migrations...');
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
