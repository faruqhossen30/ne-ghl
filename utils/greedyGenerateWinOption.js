const mysql = require('mysql2/promise');

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
});


async function getData() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query();
    return rows; // Returns the query result as a variable
  } catch (error) {
    console.error(error);
    return null;
  } finally {
    connection.release(); // Release the connection back to the pool
  }
}

module.exports = { getData };
