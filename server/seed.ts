// File: server/seed.ts
// This script seeds the database with default users

import { db } from './db';
import { users, type InsertUser } from '@shared/schema';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

// Helper function to seed a single user
async function seedIndividualUser(userData: InsertUser) {
  // userData.username should exist for InsertUser, but we add '!' for explicit check by eq
  const existingUser = await db.select().from(users).where(eq(users.username, userData.username!));

  if (existingUser.length === 0) {
    if (!userData.password) {
        // This case should ideally not be reached if InsertUser schema enforces password
        console.warn(`Password not provided for new user ${userData.username}. Skipping password hashing.`);
    } else {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        userData.password = hashedPassword;
    }
    
    // Ensure all required fields for insert are present, even if some come from schema defaults
    const completeUserData: typeof users.$inferInsert = {
        username: userData.username!,
        password: userData.password!,
        profilePicture: userData.profilePicture || null, // Handle optionality explicitly
        language: userData.language!,
        region: userData.region!,
        gamesPlayed: userData.gamesPlayed!, 
        currentGame: userData.currentGame!,
        currentGameId: userData.currentGameId!,
        isAdmin: userData.isAdmin === undefined ? false : userData.isAdmin, // Explicitly provide default if not in userData
    };

    const newUser = await db.insert(users).values(completeUserData).returning();
    console.log(`Created default user: ${newUser[0].username}`);
    return newUser[0];
  } else {
    console.log(`Default user ${userData.username} already exists. Skipping creation.`);
    return existingUser[0];
  }
}

async function seed() {
  console.log('Starting database seeding for default users...');

  // Based on InsertUser type from schema.ts
  const defaultUsersData: InsertUser[] = [
    {
      username: '5crore',
      password: 'password123', // Plain text password, will be hashed
      profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=5crore',
      language: 'Marathi', // Corrected case
      region: 'Satara',   // Corrected case
      gamesPlayed: ['Valorant'], 
      currentGame: 'Valorant',
      currentGameId: 'valorant_id_placeholder', 
      isAdmin: false 
    },
    {
      username: 'dee.2',
      password: 'password456', // Plain text password, will be hashed
      profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dee.2',
      language: 'Hindi',
      region: 'Mumbai',
      gamesPlayed: ['Chess'], 
      currentGame: 'Chess',
      currentGameId: 'chess_id_placeholder', 
      isAdmin: false 
    }
  ];

  for (const userData of defaultUsersData) {
    await seedIndividualUser(userData);
  }

  console.log('Database seeding for default users completed!');
}

seed()
  .then(() => {
    console.log('Seed script finished successfully.');
    // No process.exit(0) needed, script will exit with 0 by default if no error.
  })
  .catch((error) => {
    console.error('Error during database seeding:');
    console.error(error); // Log the full error object for more details
    process.exitCode = 1; // Set exit code to indicate failure
  });