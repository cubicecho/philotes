CREATE TABLE "person_tombstones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"uid" text NOT NULL,
	"revision" bigint NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "revision" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "persons_revision" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_person_tombstones_user_id_uid" ON "person_tombstones" ("user_id","uid");--> statement-breakpoint
CREATE INDEX "idx_person_tombstones_user_id_revision" ON "person_tombstones" ("user_id","revision");--> statement-breakpoint
CREATE INDEX "idx_persons_user_id_revision" ON "persons" ("user_id","revision");--> statement-breakpoint
ALTER TABLE "person_tombstones" ADD CONSTRAINT "person_tombstones_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
-- Everyone a user already has counts as their first change, so a first sync sees them all.
UPDATE "persons" SET "revision" = 1;--> statement-breakpoint
UPDATE "users" SET "persons_revision" = 1 WHERE "id" IN (SELECT "user_id" FROM "persons");
