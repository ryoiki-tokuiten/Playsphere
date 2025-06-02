CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"fromUserId" integer NOT NULL,
	"toUserId" integer NOT NULL,
	"content" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "messages" ADD CONSTRAINT "messages_fromUserId_users_id_fk" FOREIGN KEY ("fromUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_toUserId_users_id_fk" FOREIGN KEY ("toUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;