-- Add new column
ALTER TABLE "group_chats" ADD COLUMN "adminIds_new" json DEFAULT '[]'::json NOT NULL;

-- Copy data with conversion
UPDATE "group_chats" SET "adminIds_new" = array_to_json("adminIds");

-- Drop old column
ALTER TABLE "group_chats" DROP COLUMN "adminIds";

-- Rename new column
ALTER TABLE "group_chats" RENAME COLUMN "adminIds_new" TO "adminIds";