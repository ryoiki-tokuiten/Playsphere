// server/init-games.ts
// Script to initialize games table with data from Games.json

import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from './db';
import fs from 'fs';
import path from 'path';
import { games } from '@shared/schema';

const execAsync = promisify(exec);

interface GameEntry {
  Game: string;
  Category: string[] | string;
  Support: string[] | string;
  Contact?: string;
  Downloads?: number;
}

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    await execAsync('npx drizzle-kit push:pg');
    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

async function seedGames() {
  try {
    // Read the Games.json file
    const originalGamesData = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'Games.json'), 'utf-8')
    ) as GameEntry[];

    console.log(`Found ${originalGamesData.length} entries in Games.json.`);

    // De-duplicate gamesData
    const seenGameNames = new Set<string>();
    const uniqueGamesList: GameEntry[] = [];
    for (const gameEntry of originalGamesData) {
      if (!seenGameNames.has(gameEntry.Game)) {
        seenGameNames.add(gameEntry.Game);
        uniqueGamesList.push(gameEntry);
      } else {
        console.log(`Skipping duplicate game entry from Games.json: ${gameEntry.Game}`);
      }
    }
    console.log(`Found ${uniqueGamesList.length} unique games to import after de-duplication.`);

    // Clear existing games
    console.log('Clearing existing games data...');
    await db.delete(games);
    console.log('Cleared existing games data.');

    // Insert games in batches to avoid overwhelming the database
    const batchSize = 100;
    // Use uniqueGamesList for batching
    const batches = Math.ceil(uniqueGamesList.length / batchSize); 

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      // Use uniqueGamesList for slicing and length
      const end = Math.min((i + 1) * batchSize, uniqueGamesList.length); 
      const batch = uniqueGamesList.slice(start, end); 

      // Transform data to match our schema
      const gamesToInsert = batch.map(game => ({
        name: game.Game,
        categories: Array.isArray(game.Category) ? game.Category : [game.Category],
        platforms: Array.isArray(game.Support) ? game.Support : [game.Support],
        contact: game.Contact || null,
        downloads: game.Downloads || 0
      }));

      // Insert the batch
      if (gamesToInsert.length > 0) { // Ensure there's something to insert
        await db.insert(games).values(gamesToInsert);
        console.log(`Imported batch ${i + 1}/${batches}: games ${start + 1} to ${end} from unique list.`);
      }
    }

    console.log('Games import completed successfully!');
  } catch (error) {
    console.error('Error seeding games:', error);
    throw error;
  }
}

async function initGames() {
  try {
    // Run migrations first
    await runMigrations();
    
    // Then seed games
    await seedGames();
    
    console.log('Database initialization completed successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error; // Re-throw the error
  }
  // Removed finally block with process.exit(0)
}

// Run the initialization function
initGames()
  .then(() => {
    console.log('Game initialization script completed.');
  })
  .catch(error => {
    console.error('An error occurred during game initialization script execution:', error);
    process.exitCode = 1;
  });