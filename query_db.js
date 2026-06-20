const http = require('http');

const params = new URLSearchParams({
  audit_type_id: '1',
  selectSearchTypeFilter: '3',
  reportAuditUnit: '1',
  financial_year: '4',
  reportAuditAssesment: '287',
  startDate: '',
  endDate: '',
  freeFlow: 'false',
});

const options = {
  hostname: 'localhost',
  port: 3577,
  path: `/reports/question-wise-scoring-report/data?${params.toString()}`,
  method: 'GET',
};

console.log('URL: http://localhost:3577' + options.path);
console.log('Start:', new Date().toISOString());
const startMs = Date.now();

const req = http.request(options, (res) => {
  console.log('HTTP Status:', res.statusCode);
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    const elapsed = Date.now() - startMs;
    console.log(`Response in: ${elapsed}ms`);
    try {
      const data = JSON.parse(raw);
      const rows = data.rows || [];
      let totalQuestions = 0;
      rows.forEach(menu => {
        (menu.risk_category_wise || []).forEach(risk => {
          totalQuestions += (risk.questions || []).length;
        });
      });
      console.log(`✅ Menu rows:        ${rows.length}`);
      console.log(`✅ Total questions:  ${totalQuestions}`);
      console.log(`✅ JSON size:        ${(raw.length / 1024).toFixed(1)} KB`);
      if (rows.length > 0) {
        const m = rows[0];
        const riskCats = (m.risk_category_wise||[]);
        console.log(`\n1st menu: "${m.menu_name}" (${riskCats.length} risk categories)`);
        const r = riskCats[0];
        if (r) {
          console.log(`1st risk:  "${r.risk_category_master?.risk_category}" — ${(r.questions||[]).length} questions`);
          const q = (r.questions||[])[0];
          if (q) console.log(`Sample q:  acc="${q.account_no||'-'}" ans="${q.answer_given||''}" score=${q.risk_score}`);
        }
      }
      if (data.error || (res.statusCode !== 200)) {
        console.log('Error body:', raw.slice(0, 500));
      }
    } catch (e) {
      console.log('Parse error:', e.message);
      console.log('Body:', raw.slice(0, 500));
    }
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.setTimeout(120000, () => { console.error('TIMEOUT 120s'); req.destroy(); });
req.end();
