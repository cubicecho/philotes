-- A person row was shared between users through user_persons. Each user now owns their own row.
DROP INDEX "uq_persons_email";--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "contact_frequency" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "how_we_met" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "first_met_date" date;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "avatar_path" text;--> statement-breakpoint
-- Who gets which row. The user who linked a person first keeps the row and its id; every other user gets a copy.
CREATE TABLE "person_owner_map" AS
SELECT
  "up"."person_id" AS "old_id",
  "up"."user_id" AS "user_id",
  CASE
    WHEN row_number() OVER (PARTITION BY "up"."person_id" ORDER BY "up"."created_at", "up"."user_id") = 1 THEN "up"."person_id"
    ELSE gen_random_uuid()
  END AS "new_id"
FROM "user_persons" "up";--> statement-breakpoint
INSERT INTO "persons" ("id", "user_id", "first_name", "last_name", "email", "contact_frequency", "how_we_met", "first_met_date", "avatar_path", "created_at", "updated_at")
SELECT "m"."new_id", "m"."user_id", "p"."first_name", "p"."last_name", "p"."email", "up"."contact_frequency", "up"."how_we_met", "up"."first_met_date", "up"."avatar_path", "p"."created_at", "p"."updated_at"
FROM "person_owner_map" "m"
JOIN "persons" "p" ON "p"."id" = "m"."old_id"
JOIN "user_persons" "up" ON "up"."person_id" = "m"."old_id" AND "up"."user_id" = "m"."user_id"
WHERE "m"."new_id" <> "m"."old_id";--> statement-breakpoint
UPDATE "persons" "p"
SET "user_id" = "up"."user_id", "contact_frequency" = "up"."contact_frequency", "how_we_met" = "up"."how_we_met", "first_met_date" = "up"."first_met_date", "avatar_path" = "up"."avatar_path"
FROM "person_owner_map" "m"
JOIN "user_persons" "up" ON "up"."person_id" = "m"."old_id" AND "up"."user_id" = "m"."user_id"
WHERE "p"."id" = "m"."old_id" AND "m"."new_id" = "m"."old_id";--> statement-breakpoint
-- What each user keeps about a person follows that user's row.
UPDATE "tasks" "t" SET "person_id" = "m"."new_id"
FROM "person_owner_map" "m"
WHERE "t"."person_id" = "m"."old_id" AND "t"."user_id" = "m"."user_id" AND "m"."new_id" <> "m"."old_id";--> statement-breakpoint
UPDATE "addresses" "t" SET "person_id" = "m"."new_id"
FROM "person_owner_map" "m"
WHERE "t"."person_id" = "m"."old_id" AND "t"."user_id" = "m"."user_id" AND "m"."new_id" <> "m"."old_id";--> statement-breakpoint
UPDATE "contact_infos" "t" SET "person_id" = "m"."new_id"
FROM "person_owner_map" "m"
WHERE "t"."person_id" = "m"."old_id" AND "t"."user_id" = "m"."user_id" AND "m"."new_id" <> "m"."old_id";--> statement-breakpoint
UPDATE "important_dates" "t" SET "person_id" = "m"."new_id"
FROM "person_owner_map" "m"
WHERE "t"."person_id" = "m"."old_id" AND "t"."user_id" = "m"."user_id" AND "m"."new_id" <> "m"."old_id";--> statement-breakpoint
UPDATE "important_date_persons" "t" SET "person_id" = "m"."new_id"
FROM "person_owner_map" "m"
WHERE "t"."person_id" = "m"."old_id" AND "t"."user_id" = "m"."user_id" AND "m"."new_id" <> "m"."old_id";--> statement-breakpoint
UPDATE "gratitudes" "t" SET "person_id" = "m"."new_id"
FROM "person_owner_map" "m"
WHERE "t"."person_id" = "m"."old_id" AND "t"."user_id" = "m"."user_id" AND "m"."new_id" <> "m"."old_id";--> statement-breakpoint
UPDATE "person_labels" "t" SET "person_id" = "m"."new_id"
FROM "person_owner_map" "m"
WHERE "t"."person_id" = "m"."old_id" AND "t"."user_id" = "m"."user_id" AND "m"."new_id" <> "m"."old_id";--> statement-breakpoint
UPDATE "interactions" "t" SET "person_id" = "m"."new_id"
FROM "person_owner_map" "m"
WHERE "t"."person_id" = "m"."old_id" AND "t"."user_id" = "m"."user_id" AND "m"."new_id" <> "m"."old_id";--> statement-breakpoint
UPDATE "notes" "t" SET "person_id" = "m"."new_id"
FROM "person_owner_map" "m"
WHERE "t"."person_id" = "m"."old_id" AND "t"."user_id" = "m"."user_id" AND "m"."new_id" <> "m"."old_id";--> statement-breakpoint
UPDATE "note_mentions" "t" SET "mentioned_person_id" = "m"."new_id"
FROM "person_owner_map" "m"
WHERE "t"."mentioned_person_id" = "m"."old_id" AND "t"."user_id" = "m"."user_id" AND "m"."new_id" <> "m"."old_id";--> statement-breakpoint
UPDATE "person_relationships" "t" SET "from_person_id" = "m"."new_id"
FROM "person_owner_map" "m"
WHERE "t"."from_person_id" = "m"."old_id" AND "t"."user_id" = "m"."user_id" AND "m"."new_id" <> "m"."old_id";--> statement-breakpoint
UPDATE "person_relationships" "t" SET "to_person_id" = "m"."new_id"
FROM "person_owner_map" "m"
WHERE "t"."to_person_id" = "m"."old_id" AND "t"."user_id" = "m"."user_id" AND "m"."new_id" <> "m"."old_id";--> statement-breakpoint
-- Rows a user left on a person they had since removed from their contacts point at a row that is not theirs. A note outlives its person; the rest go.
UPDATE "notes" "t" SET "person_id" = NULL
FROM "persons" "p"
WHERE "t"."person_id" = "p"."id" AND "p"."user_id" IS DISTINCT FROM "t"."user_id";--> statement-breakpoint
DELETE FROM "tasks" "t" USING "persons" "p"
WHERE "t"."person_id" = "p"."id" AND "p"."user_id" IS DISTINCT FROM "t"."user_id";--> statement-breakpoint
DELETE FROM "addresses" "t" USING "persons" "p"
WHERE "t"."person_id" = "p"."id" AND "p"."user_id" IS DISTINCT FROM "t"."user_id";--> statement-breakpoint
DELETE FROM "contact_infos" "t" USING "persons" "p"
WHERE "t"."person_id" = "p"."id" AND "p"."user_id" IS DISTINCT FROM "t"."user_id";--> statement-breakpoint
DELETE FROM "important_dates" "t" USING "persons" "p"
WHERE "t"."person_id" = "p"."id" AND "p"."user_id" IS DISTINCT FROM "t"."user_id";--> statement-breakpoint
DELETE FROM "important_date_persons" "t" USING "persons" "p"
WHERE "t"."person_id" = "p"."id" AND "p"."user_id" IS DISTINCT FROM "t"."user_id";--> statement-breakpoint
DELETE FROM "gratitudes" "t" USING "persons" "p"
WHERE "t"."person_id" = "p"."id" AND "p"."user_id" IS DISTINCT FROM "t"."user_id";--> statement-breakpoint
DELETE FROM "person_labels" "t" USING "persons" "p"
WHERE "t"."person_id" = "p"."id" AND "p"."user_id" IS DISTINCT FROM "t"."user_id";--> statement-breakpoint
DELETE FROM "interactions" "t" USING "persons" "p"
WHERE "t"."person_id" = "p"."id" AND "p"."user_id" IS DISTINCT FROM "t"."user_id";--> statement-breakpoint
DELETE FROM "note_mentions" "t" USING "persons" "p"
WHERE "t"."mentioned_person_id" = "p"."id" AND "p"."user_id" IS DISTINCT FROM "t"."user_id";--> statement-breakpoint
DELETE FROM "person_relationships" "t" USING "persons" "p"
WHERE "t"."from_person_id" = "p"."id" AND "p"."user_id" IS DISTINCT FROM "t"."user_id";--> statement-breakpoint
DELETE FROM "person_relationships" "t" USING "persons" "p"
WHERE "t"."to_person_id" = "p"."id" AND "p"."user_id" IS DISTINCT FROM "t"."user_id";--> statement-breakpoint
-- A person in nobody's contacts was invisible to everyone.
DELETE FROM "persons" WHERE "user_id" IS NULL;--> statement-breakpoint
-- The person's own email becomes a contact detail, unless that user already keeps the same address for them. It is the primary one when they have no primary email.
INSERT INTO "contact_infos" ("person_id", "user_id", "type", "value", "is_primary")
SELECT "p"."id", "p"."user_id", 'email', "p"."email", NOT EXISTS (
  SELECT 1 FROM "contact_infos" "c" WHERE "c"."person_id" = "p"."id" AND "c"."type" = 'email' AND "c"."is_primary"
)
FROM "persons" "p"
WHERE "p"."email" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "contact_infos" "c" WHERE "c"."person_id" = "p"."id" AND "c"."type" = 'email' AND lower("c"."value") = lower("p"."email")
);--> statement-breakpoint
DROP TABLE "person_owner_map";--> statement-breakpoint
DROP TABLE "user_persons";--> statement-breakpoint
ALTER TABLE "persons" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "persons" DROP COLUMN "email";--> statement-breakpoint
CREATE INDEX "idx_persons_user_id" ON "persons" ("user_id");--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
