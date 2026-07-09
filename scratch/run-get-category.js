const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { InternalAuditService } = require('../dist/modules/auditor/internal-audit/internal-audit.service');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(InternalAuditService);
  
  const db = service.db;
  const emp = await db.findOne("SELECT id, name FROM employee_master WHERE name ILIKE '%PRABHU%' LIMIT 1");
  console.log('Employee:', emp);
  
  if (emp) {
    const res = await service.getCategory(285, 52, emp.id, 0, true);
    console.log('Category Info:', res.category);
    console.log('Accounts Count:', res.accounts?.length);
    console.log('Accounts sample:', res.accounts?.[0]);
  }
  
  await app.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
