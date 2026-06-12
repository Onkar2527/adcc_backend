import * as fs from 'fs';
import * as path from 'path';

function search() {
  const filePath = path.join(__dirname, 'src', 'modules', 'reports', 'reports.service.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  console.log('Printing reports.service.ts lines 4900 to 4945...');
  for (let i = 4899; i < 4945; i++) {
    if (lines[i] !== undefined) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  }
}

search();
