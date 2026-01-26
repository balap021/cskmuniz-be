const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'photography_site';
const DB_PORT = process.env.DB_PORT || 3306;

async function createDatabase() {
  try {
    // Connect to MySQL server (without specifying database)
    const connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      port: DB_PORT
    });

    console.log('✅ Connected to MySQL server');

    // Create database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    console.log(`✅ Database '${DB_NAME}' created or already exists`);

    await connection.end();
    console.log('✅ Database setup complete!');
    console.log('\nYou can now start the server with: npm start\n');
  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    console.log('\nPlease check:');
    console.log('1. MySQL is running');
    console.log('2. DB_USER and DB_PASSWORD in .env are correct');
    console.log('3. You have permission to create databases\n');
    process.exit(1);
  }
}

createDatabase();

