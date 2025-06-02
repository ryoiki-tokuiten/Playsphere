// File: server/seed.ts
// This script seeds the database with default users

import { db } from './db';
import { users } from '@shared/schema';
import bcrypt from 'bcrypt';

async function seed() {
  try {
    console.log('Starting database seeding...');

    // Hash passwords for default users
    const password1 = await bcrypt.hash('5crore', 10);
    const password2 = await bcrypt.hash('dee.2', 10);

    // First default user
    const amitabh = await db.insert(users).values({
      username: '5crore',
      password: password1,
      profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=5crore',
      language: 'marathi',
      region: 'satara',
      gamesPlayed: ['valorant'],
      currentGame: 'valorant',
      currentGameId: '50mnqw/34',
      lastActive: new Date()
    }).returning();

    console.log('Created first user:', amitabh[0]);

    // Second default user
    const samay = await db.insert(users).values({
      username: 'dee.2',
      password: password2,
      profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dee.2',
      language: 'Hindi',
      region: 'Mumbai',
      gamesPlayed: ['chess'],
      currentGame: 'chess',
      currentGameId: 'crazy@11',
      lastActive: new Date()
    }).returning();

    console.log('Created second user:', samay[0]);

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed(); 