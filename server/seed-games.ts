// server/seed-games.ts
// Script to seed the games database with games from Games.json

import fs from 'fs';
import path from 'path';
import { db } from './db';
import { games } from '@shared/schema';

interface GameEntry {
  Game: string;
  Category: string[] | string;
  Support: string[] | string;
  Contact?: string;
  Downloads?: number;
}

async function seedGames() {
  try {
    // Read the Games.json file
    const gamesData = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'Games.json'), 'utf-8')
    ) as GameEntry[];

    console.log(`Found ${gamesData.length} games to import.`);

    // Clear existing games (optional)
    await db.delete(games);
    console.log('Cleared existing games data.');

    // Insert games in batches to avoid overwhelming the database
    const batchSize = 100;
    const batches = Math.ceil(gamesData.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min((i + 1) * batchSize, gamesData.length);
      const batch = gamesData.slice(start, end);

      // Transform data to match our schema
      const gamesToInsert = batch.map(game => ({
        name: game.Game,
        categories: Array.isArray(game.Category) ? game.Category : [game.Category],
        platforms: Array.isArray(game.Support) ? game.Support : [game.Support],
        contact: game.Contact || null,
        downloads: game.Downloads || 0
      }));

      // Insert the batch
      await db.insert(games).values(gamesToInsert);
      console.log(`Imported games ${start + 1} to ${end}.`);
    }

    console.log('Games import completed successfully!');
  } catch (error) {
    console.error('Error seeding games:', error);
  } finally {
    process.exit(0);
  }
}

// Run the seed function
seedGames(); 