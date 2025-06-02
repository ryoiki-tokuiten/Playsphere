// File: server/check-users.ts
// This script checks user data in the database

import { db } from './db';
import { users } from '@shared/schema';

function isBcryptHash(str: string) {
  return /^\$2[ab]\$\d+\$/.test(str) && str.length === 60;
}

async function checkUsers() {
  try {
    console.log('Checking users in database...');

    // Get all users
    const allUsers = await db.select().from(users);
    
    // Print user data
    allUsers.forEach(user => {
      let passwordStatus = "Unknown";
      if (!user.password) {
        passwordStatus = "Empty";
      } else if (isBcryptHash(user.password)) {
        passwordStatus = "Hashed";
      } else {
        passwordStatus = "Not Hashed (Potential Issue)";
      }

      console.log('\nUser:', {
        username: user.username,
        passwordStatus: passwordStatus,
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