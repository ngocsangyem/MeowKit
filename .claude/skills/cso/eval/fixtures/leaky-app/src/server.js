const config = require('./config');
const db = require('./db');
module.exports = (req) => db.query("SELECT * FROM users WHERE name = '" + req.query.name + "'");
