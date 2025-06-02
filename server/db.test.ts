import { db } from './db';

async function testConnection() {
  try {
    // Try to query the users table
    const result = await db.query.users.findFirst();
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}

testConnection().then((success) => {
  if (!success) {
    process.exit(1);
  }
}); 