ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
