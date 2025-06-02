// File: server/update-passwords.ts
// This script updates existing users' passwords to hashed versions

import { db } from './db';
import { users } from '@shared/schema';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

// Function to check if a string is a bcrypt hash
function isBcryptHash(str: string) {
  // bcrypt hashes always start with $2b$ or $2a$ and are 60 characters long
  return /^\$2[ab]\$\d+\$/.test(str);
}

async function updatePasswords() {
  try {
    console.log('Starting password update...');

    // Get all users
    const allUsers = await db.select().from(users);
    let updatedCount = 0;
    
    // Update each user's password if it's not already hashed
    for (const user of allUsers) {
      if (isBcryptHash(user.password)) {
        console.log(`Password for ${user.username} is already hashed, skipping...`);
      } else {
        console.log(`Updating password for user: ${user.username} (current: ${user.password})`);
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await db.update(users)
          .set({ password: hashedPassword })
          .where(eq(users.id, user.id));
        console.log(`Updated password for ${user.username} to: ${hashedPassword}`);
        updatedCount++;
      }
    }

    console.log(`\nPassword update completed successfully!`);
    console.log(`Updated ${updatedCount} users, ${allUsers.length - updatedCount} already hashed`);
  } catch (error) {
    console.error('Error updating passwords:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

updatePasswords(); 