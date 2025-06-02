CREATE TABLE IF NOT EXISTS "games" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "categories" json NOT NULL,
  "platforms" json NOT NULL,
  "contact" text,
  "downloads" integer,
  CONSTRAINT "games_name_unique" UNIQUE("name")
);