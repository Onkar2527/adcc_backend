import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MasterBulkUploadService } from '../src/modules/admin/master-bulk-upload/master-bulk-upload.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(MasterBulkUploadService);

  // We simulate a CSV row payload for Executive Summary Bulk Upload
  const mockRows = [
    {
      year_id: '1',
      audit_unit_code: '1',     // DAPOLI (unit 1002)
      gl_code: '501_NPA',        // Cash Credit NPA
      march_position: '99.99',   // March position value
      admin_id: '1'
    }
  ];

  try {
    console.log('Simulating bulk upload of executive-summary with NPA GL code...');
    const result = await service.upload('executivesummary', mockRows);
    console.log('Upload completed successfully!', result);
  } catch (err) {
    console.error('Upload failed:', err);
  } finally {
    await app.close();
  }
}

run();
