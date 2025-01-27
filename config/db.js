const mysql = require("mysql2");

// Create the connection pool. The pool-specific settings are the defaults
// const mysqlPool = mysql.createPool({
//   host: "193.203.184.160",
//   user: "u854194333_honeylive",
//   database: "u854194333_honeylive",
//   password: "Hostingdb@$123",
// });

const mysqlPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
});

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
});

module.exports = { mysqlPool };
