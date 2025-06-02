// File: server/check-users.ts
// This script checks user data in the database

import { db } from './db';
import { users } from '@shared/schema';

async function checkUsers() {
  try {
    console.log('Checking users in database...');

    // Get all users
    const allUsers = await db.select().from(users);
    
    // Print user data
    allUsers.forEach(user => {
      console.log('\nUser:', {
        username: user.username,
        password: user.password.substring(0, 10) + '...',  // Only show start of password
        isAdmin: user.isAdmin
      });
    });

    console.log('\nTotal users:', allUsers.length);
  } catch (error) {
    console.error('Error checking users:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

checkUsers(); 