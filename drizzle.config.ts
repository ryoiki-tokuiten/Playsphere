import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') });

const dbUrl = new URL(process.env.DATABASE_URL || '');

export default defineConfig({
  schema: './shared/schema.ts',
  out: './drizzle',
  dbCredentials: {
    host: dbUrl.hostname,
    port: parseInt(dbUrl.port) || 5432,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.slice(1),
    ssl: false,
  },
  dialect: 'postgresql',
});
