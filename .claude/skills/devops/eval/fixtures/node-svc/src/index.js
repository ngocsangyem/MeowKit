const url = process.env.DATABASE_URL;
const key = process.env.API_KEY;
require('http').createServer((q, s) => s.end('ok')).listen(process.env.PORT || 3000);
