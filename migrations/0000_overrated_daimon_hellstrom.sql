CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"messageId" integer NOT NULL,
	"fileUrl" text NOT NULL,
	"fileName" text NOT NULL,
	"fileSize" integer NOT NULL,
	"fileType" text NOT NULL,
	"uploadedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"groupId" integer NOT NULL,
	"userId" integer NOT NULL,
	"joinedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"fromUserId" integer NOT NULL,
	"toUserId" integer,
	"groupId" integer,
	"content" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"readAt" timestamp,
	"type" text DEFAULT 'text' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"profilePicture" text,
	"language" text NOT NULL,
	"region" text NOT NULL,
	"gamesPlayed" json NOT NULL,
	"currentGame" text NOT NULL,
	"currentGameId" text NOT NULL,
	"lastActive" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_messageId_messages_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chats" ADD CONSTRAINT "group_chats_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_groupId_group_chats_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."group_chats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_fromUserId_users_id_fk" FOREIGN KEY ("fromUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_toUserId_users_id_fk" FOREIGN KEY ("toUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_groupId_group_chats_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."group_chats"("id") ON DELETE no action ON UPDATE no action;