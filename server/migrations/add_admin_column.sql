-- Add isAdmin column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT FALSE;

-- Set the designated user as admin
UPDATE users SET "isAdmin" = TRUE WHERE username = 'ryoikitokuiten'; 