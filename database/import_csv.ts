import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/core/database/database.service';
import * as fs from 'fs';

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];

  // Parse first 7 fields from left
  let temp = line;
  for (let i = 0; i < 7; i++) {
    temp = temp.trim();
    if (temp.startsWith('"')) {
      let closeIdx = -1;
      for (let j = 1; j < temp.length; j++) {
        if (temp[j] === '"' && (j === temp.length - 1 || temp[j + 1] === ',')) {
          closeIdx = j;
          break;
        }
      }
      if (closeIdx === -1) {
        throw new Error(`Unclosed quote in first 7 fields: ${temp}`);
      }
      fields.push(temp.substring(1, closeIdx));
      temp = temp.substring(closeIdx + 1);
      if (temp.startsWith(',')) temp = temp.substring(1);
    } else {
      const commaIdx = temp.indexOf(',');
      if (commaIdx === -1) {
        fields.push(temp);
        temp = '';
      } else {
        fields.push(temp.substring(0, commaIdx));
        temp = temp.substring(commaIdx + 1);
      }
    }
  }

  // Parse last 16 fields from right
  const rightFields: string[] = [];
  for (let i = 0; i < 16; i++) {
    temp = temp.trim();
    if (temp.endsWith('"')) {
      let openIdx = -1;
      for (let j = temp.length - 2; j >= 0; j--) {
        if (temp[j] === '"' && (j === 0 || temp[j - 1] === ',')) {
          openIdx = j;
          break;
        }
      }
      if (openIdx === -1) {
        throw new Error(`Unclosed quote in last 16 fields: ${temp}`);
      }
      rightFields.unshift(temp.substring(openIdx + 1, temp.length - 1));
      temp = temp.substring(0, openIdx);
      if (temp.endsWith(',')) temp = temp.substring(0, temp.length - 1);
    } else {
      const commaIdx = temp.lastIndexOf(',');
      if (commaIdx === -1) {
        rightFields.unshift(temp);
        temp = '';
      } else {
        rightFields.unshift(temp.substring(commaIdx + 1));
        temp = temp.substring(0, commaIdx);
      }
    }
  }

  // Now, temp contains the middle 3 fields: parameters, suggestions, mr_suggestions
  temp = temp.trim();
  if (temp.startsWith(',')) temp = temp.substring(1);
  if (temp.endsWith(',')) temp = temp.substring(0, temp.length - 1);
  temp = temp.trim();

  const middleFields: string[] = [];
  for (let k = 0; k < 2; k++) {
    temp = temp.trim();
    if (!temp.startsWith('"')) {
      const commaIdx = temp.indexOf(',');
      if (commaIdx === -1) {
        middleFields.push(temp);
        temp = '';
      } else {
        middleFields.push(temp.substring(0, commaIdx));
        temp = temp.substring(commaIdx + 1);
      }
    } else {
      let closeIdx = -1;
      for (let j = 1; j < temp.length; j++) {
        if (temp[j] === '"' && (temp[j - 1] === ']' || temp[j - 1] === '}') && (j === temp.length - 1 || temp[j + 1] === ',')) {
          closeIdx = j;
          break;
        }
      }
      if (closeIdx === -1) {
        for (let j = 1; j < temp.length; j++) {
          if (temp[j] === '"' && (j === temp.length - 1 || temp[j + 1] === ',')) {
            closeIdx = j;
            break;
          }
        }
      }
      if (closeIdx === -1) {
        middleFields.push(temp);
        temp = '';
      } else {
        middleFields.push(temp.substring(1, closeIdx));
        temp = temp.substring(closeIdx + 1);
        if (temp.startsWith(',')) temp = temp.substring(1);
      }
    }
  }
  temp = temp.trim();
  if (temp.startsWith('"') && temp.endsWith('"')) {
    middleFields.push(temp.substring(1, temp.length - 1));
  } else {
    middleFields.push(temp);
  }

  return [...fields, ...middleFields, ...rightFields];
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  const csvFilePath = 'C:\\Users\\dell\\Downloads\\question Data.csv';

  try {
    console.log('1. Altering table question_master to ensure columns exist...');
    await db.query(`
      ALTER TABLE question_master ADD COLUMN IF NOT EXISTS mr_question TEXT DEFAULT NULL;
      ALTER TABLE question_master ADD COLUMN IF NOT EXISTS suggestions TEXT DEFAULT NULL;
      ALTER TABLE question_master ADD COLUMN IF NOT EXISTS mr_suggestions TEXT DEFAULT NULL;
    `);
    console.log('Columns added/verified.');

    console.log(`2. Reading and splitting CSV file from: ${csvFilePath}...`);
    const content = fs.readFileSync(csvFilePath, 'utf8');
    const rows = content.split(/\r?\n(?=\d+,\d+,\d+,)/);
    const dataRows = rows.slice(1); // Skip header row
    console.log(`Finished parsing. Total data rows found: ${dataRows.length}`);

    console.log('3. Upserting rows into database in bulk batches...');
    
    // Batch size of 100 rows
    const batchSize = 100;
    for (let i = 0; i < dataRows.length; i += batchSize) {
      const batch = dataRows.slice(i, i + batchSize);
      
      const valuesPlaceholders: string[] = [];
      const valuesList: any[] = [];
      let paramCounter = 1;

      for (const rowStr of batch) {
        if (!rowStr.trim()) continue;
        
        const parsed = parseCSVLine(rowStr);
        
        const parseVal = (val: string | undefined, type: 'int' | 'text' | 'timestamp') => {
          if (val === undefined || val === null) return null;
          const trimmed = val.trim();
          if (trimmed === '' || trimmed.toUpperCase() === 'NULL') {
            return null;
          }
          if (type === 'int') {
            const num = parseInt(trimmed, 10);
            return isNaN(num) ? null : num;
          }
          if (type === 'timestamp') {
            const hasDateSeparator = trimmed.includes('-') || trimmed.includes('/') || trimmed.includes(':');
            if (!hasDateSeparator || isNaN(Date.parse(trimmed)) || trimmed === '0' || trimmed.startsWith('0000-00-00')) {
              return null;
            }
          }
          return trimmed;
        };

        const id = parseVal(parsed[0], 'int');
        if (id === null) continue;

        const header_id = parseVal(parsed[1], 'int');
        const set_id = parseVal(parsed[2], 'int');
        const question = parseVal(parsed[3], 'text');
        const mr_question = parseVal(parsed[4], 'text');
        const risk_category_id = parseVal(parsed[5], 'int');
        const option_id = parseVal(parsed[6], 'int');
        const parameters = parseVal(parsed[7], 'text');
        const suggestions = parseVal(parsed[8], 'text');
        const mr_suggestions = parseVal(parsed[9], 'text');
        const question_type_id = parseVal(parsed[10], 'int');
        const annexure_id = parseVal(parsed[11], 'int');
        const subset_multi_id = parseVal(parsed[12], 'text');
        const area_of_audit_id = parseVal(parsed[13], 'int');
        const applicable_id = parseVal(parsed[14], 'int');
        const control_risk_id = parseVal(parsed[15], 'int');
        const key_aspect_id = parseVal(parsed[16], 'int');
        const residual_risk_id = parseVal(parsed[17], 'int');
        const show_instances = parseVal(parsed[18], 'int');
        const is_active = parseVal(parsed[19], 'int') ?? 1;
        const audit_ev_upload = parseVal(parsed[20], 'int');
        const compliance_ev_upload = parseVal(parsed[21], 'int');
        const admin_id = parseVal(parsed[22], 'int');
        const created_at = parseVal(parsed[23], 'timestamp');
        const updated_at = parseVal(parsed[24], 'timestamp');
        const deleted_at = parseVal(parsed[25], 'timestamp');

        const rowValues = [
          id, header_id, set_id, question, mr_question, risk_category_id, option_id, parameters, suggestions, mr_suggestions,
          question_type_id, annexure_id, subset_multi_id, area_of_audit_id, applicable_id, control_risk_id, key_aspect_id,
          residual_risk_id, show_instances, is_active, audit_ev_upload, compliance_ev_upload, admin_id, created_at, updated_at, deleted_at
        ];

        const placeholders: string[] = [];
        for (let j = 0; j < 26; j++) {
          placeholders.push(`$${paramCounter++}`);
          valuesList.push(rowValues[j]);
        }
        valuesPlaceholders.push(`(${placeholders.join(', ')})`);
      }

      if (valuesList.length === 0) continue;

      const sql = `
        INSERT INTO question_master (
          id, header_id, set_id, question, mr_question, risk_category_id, option_id, parameters, suggestions, mr_suggestions,
          question_type_id, annexure_id, subset_multi_id, area_of_audit_id, applicable_id, control_risk_id, key_aspect_id,
          residual_risk_id, show_instances, is_active, audit_ev_upload, compliance_ev_upload, admin_id, created_at, updated_at, deleted_at
        )
        VALUES ${valuesPlaceholders.join(', ')}
        ON CONFLICT (id) DO UPDATE SET
          header_id = EXCLUDED.header_id,
          set_id = EXCLUDED.set_id,
          question = EXCLUDED.question,
          mr_question = EXCLUDED.mr_question,
          risk_category_id = EXCLUDED.risk_category_id,
          option_id = EXCLUDED.option_id,
          parameters = EXCLUDED.parameters,
          suggestions = EXCLUDED.suggestions,
          mr_suggestions = EXCLUDED.mr_suggestions,
          question_type_id = EXCLUDED.question_type_id,
          annexure_id = EXCLUDED.annexure_id,
          subset_multi_id = EXCLUDED.subset_multi_id,
          area_of_audit_id = EXCLUDED.area_of_audit_id,
          applicable_id = EXCLUDED.applicable_id,
          control_risk_id = EXCLUDED.control_risk_id,
          key_aspect_id = EXCLUDED.key_aspect_id,
          residual_risk_id = EXCLUDED.residual_risk_id,
          show_instances = EXCLUDED.show_instances,
          is_active = EXCLUDED.is_active,
          audit_ev_upload = EXCLUDED.audit_ev_upload,
          compliance_ev_upload = EXCLUDED.compliance_ev_upload,
          admin_id = EXCLUDED.admin_id,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at
      `;

      await db.query(sql, valuesList);
      console.log(`Processed row ${i + batch.length}/${dataRows.length}...`);
    }

    console.log('4. Correcting the PostgreSQL serial ID sequence...');
    const seqRes = await db.query(`
      SELECT pg_get_serial_sequence('question_master', 'id') AS seq_name;
    `);
    const seqName = seqRes.rows[0].seq_name;
    if (seqName) {
      console.log(`Found sequence: ${seqName}. Updating it...`);
      await db.query(`
        SELECT setval('${seqName}', COALESCE((SELECT MAX(id)+1 FROM question_master), 1), false);
      `);
      console.log('Sequence updated successfully!');
    }
    
    console.log('Migration and import completed successfully.');

  } catch (err) {
    console.error('Import failed:', err);
  } finally {
    await app.close();
  }
}

bootstrap();
