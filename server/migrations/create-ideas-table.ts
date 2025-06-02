import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/vercel-postgres';

export async function createIdeasTable() {
  try {
    const db = drizzle(sql);
    
    // Create the ideas table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS ideas (
        id SERIAL PRIMARY KEY,
        game_id INTEGER NOT NULL REFERENCES games(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        votes INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create index for faster lookups
      CREATE INDEX IF NOT EXISTS ideas_game_id_idx ON ideas(game_id);
      CREATE INDEX IF NOT EXISTS ideas_user_id_idx ON ideas(user_id);

      -- Create table for tracking user votes
      CREATE TABLE IF NOT EXISTS idea_votes (
        idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (idea_id, user_id)
      );
    `);

    console.log('Ideas tables created successfully');
  } catch (error) {
    console.error('Error creating ideas tables:', error);
    throw error;
  }
} 