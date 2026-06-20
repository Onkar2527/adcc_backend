const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { AuditDashboardService } = require('./dist/modules/auditor/audit-dashboard/audit-dashboard.service');

async function main() {
  console.log('Initializing NestJS context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('NestJS context initialized. Fetching service...');
  const service = app.get(AuditDashboardService);
  
  try {
    console.log('Calling getUnitDashboardDetails(0, 1, 1)...');
    const result = await service.getUnitDashboardDetails(0, 1, 1);
    console.log('Success! Details returned.');
  } catch (err) {
    console.error('Error caught in getUnitDashboardDetails:');
    console.error(err);
    if (err.stack) {
      console.error(err.stack);
    }
  } finally {
    await app.close();
  }
}

main();
