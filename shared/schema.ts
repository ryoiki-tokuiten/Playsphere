import { pgTable, text, serial, integer, json, timestamp, boolean, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  profilePicture: text("profilePicture"),
  language: text("language").notNull(),
  region: text("region").notNull(),
  gamesPlayed: json("gamesPlayed").$type<string[]>().notNull(),
  currentGame: text("currentGame").notNull(),
  currentGameId: text("currentGameId").notNull(),
  lastActive: timestamp("lastActive").notNull().defaultNow(),
  isAdmin: boolean("isAdmin").notNull().default(false),
});

// Groups table renamed to match the database schema
export const groups = pgTable("group_chats", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // Column renamed to match database schema
  ownerId: integer("createdBy")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  adminIds: json("adminIds").$type<number[]>().notNull().default([]),
});

// Group members table adjusted to match database schema
export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("groupId")
    .notNull()
    .references(() => groups.id),
  userId: integer("userId")
    .notNull()
    .references(() => users.id),
  joinedAt: timestamp("joinedAt").notNull().defaultNow(),
  // Add a unique constraint to prevent duplicate memberships
  // This will be handled in the database function
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  fromUserId: integer("fromUserId")
    .notNull()
    .references(() => users.id),
  // toUserId can be null for group messages
  toUserId: integer("toUserId")
    .references(() => users.id),
  // Changed column name to match database schema
  groupId: integer("groupId")
    .references(() => groups.id),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  isRead: boolean("isRead").notNull().default(false),
  readAt: timestamp("readAt"),
  type: text("type").notNull().default("text"),
});

export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  language: z.string().min(1, "Language is required"),
  region: z.string().min(1, "Region is required"),
  currentGame: z.string().min(1, "Current game is required"),
  currentGameId: z.string().min(1, "Current game ID is required"),
}).omit({ 
  id: true,
  lastActive: true 
});

// Updated insert schema for groups
export const insertGroupSchema = createInsertSchema(groups, {
  name: z.string().min(1, "Group name is required"),
  // Changed to match the new column name
  ownerId: z.number()
}).omit({
  id: true,
  createdAt: true
});

// Updated insert schema for group members
export const insertGroupMemberSchema = createInsertSchema(groupMembers).omit({
  id: true,
  joinedAt: true
});

// Update message schema to handle group messages
export const insertMessageSchema = createInsertSchema(messages, {
  // Make toUserId optional for group messages
  toUserId: z.number().optional(),
  // Add groupId as optional
  groupId: z.number().optional(),
  // Validation to ensure either toUserId or groupId is present
}).omit({
  id: true,
  timestamp: true,
  isRead: true,
  readAt: true,
  type: true
}).refine(data => 
  (data.toUserId !== undefined && data.groupId === undefined) || 
  (data.toUserId === undefined && data.groupId !== undefined),
  {
    message: "Either toUserId or groupId must be provided, but not both",
    path: ["toUserId", "groupId"]
  }
);

// Game table for storing games from Games.json
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  categories: json("categories").$type<string[]>().notNull(),
  platforms: json("platforms").$type<string[]>().notNull(),
  contact: text("contact"),
  downloads: bigint("downloads", { mode: "number" }),
});

// Create insert schema for games
export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
});

// Ideas table
export const ideas = pgTable("ideas", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id")
    .notNull()
    .references(() => games.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  votes: integer("votes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Extended Idea type for frontend use
export type IdeaWithRelations = typeof ideas.$inferSelect & {
  game_name: string;
  game_contact: string | null;
  creator_username: string;
  has_voted: boolean;
  game: typeof games.$inferSelect;
};

// Ideas relations
export const ideasRelations = relations(ideas, ({ one, many }) => ({
  game: one(games, {
    fields: [ideas.gameId],
    references: [games.id],
  }),
  creator: one(users, {
    fields: [ideas.userId],
    references: [users.id],
  }),
  votes: many(ideaVotes),
}));

// Idea votes table
export const ideaVotes = pgTable("idea_votes", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id")
    .notNull()
    .references(() => ideas.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Idea votes relations
export const ideaVotesRelations = relations(ideaVotes, ({ one }) => ({
  idea: one(ideas, {
    fields: [ideaVotes.ideaId],
    references: [ideas.id],
  }),
  user: one(users, {
    fields: [ideaVotes.userId],
    references: [users.id],
  }),
}));

// Create insert schema for ideas
export const insertIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  votes: true,
  createdAt: true,
});

// Create insert schema for idea votes
export const insertIdeaVoteSchema = createInsertSchema(ideaVotes).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type InsertGroupMember = z.infer<typeof insertGroupMemberSchema>;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;
export type InsertIdea = z.infer<typeof insertIdeaSchema>;
export type Idea = typeof ideas.$inferSelect;
export type IdeaVote = typeof ideaVotes.$inferSelect;
