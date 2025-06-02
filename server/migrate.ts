import pkg from 'pg';
const { Pool } = pkg;
// import { drizzle } from 'drizzle-orm/node-postgres'; // No longer needed for Drizzle migrate
// import { migrate } from 'drizzle-orm/node-postgres/migrator'; // No longer needed
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises'; // Added for reading setup.sql

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in .env file');
  }

  console.log('Database URL:', process.env.DATABASE_URL);
  console.log('Current directory:', __dirname);
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // const db = drizzle(pool); // drizzle instance not needed if not using Drizzle ORM migrate

  try {
    console.log('Reading setup.sql...');
    const setupSqlPath = join(__dirname, '..', 'setup.sql');
    const sqlContent = await fs.readFile(setupSqlPath, 'utf-8');
    
    console.log('Executing setup.sql...');
    await pool.query(sqlContent);
    console.log('setup.sql executed successfully!');

    // Optional: Verify the tables to confirm script execution
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('Tables in public schema:', result.rows.map(row => row.table_name));

  } catch (error) {
    console.error('Error executing setup.sql:', error);
    throw error; // Rethrow to ensure process exits with error code
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

main().catch((err) => {
  console.error('Script execution failed!', err);
  process.exit(1);
}); 