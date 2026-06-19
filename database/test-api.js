const http = require('http');

http.get('http://localhost:3577/audit-calendar/scheduling', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const branch10Schedules = json.projected_schedules.filter(p => p.audit_unit_id === 10);
      console.log('--- API Projected Schedules for Branch 10 ---');
      console.log(JSON.stringify(branch10Schedules, null, 2));
    } catch (err) {
      console.error('Failed to parse response:', err.message);
    }
  });
}).on('error', (err) => {
  console.error('HTTP request failed:', err.message);
});
