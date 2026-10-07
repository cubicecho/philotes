-- The junction tables gain their owner: added nullable, filled from the parent row, then required.
-- The old timestamps held UTC wall-clock values, so they are read as UTC.
ALTER TABLE "persons" DROP CONSTRAINT "persons_email_key";--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_infos" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "important_date_tags" ADD COLUMN "user_id" uuid;--> statement-breakpoint
UPDATE "important_date_tags" SET "user_id" = "important_dates"."user_id" FROM "important_dates" WHERE "important_dates"."id" = "important_date_tags"."important_date_id";--> statement-breakpoint
ALTER TABLE "important_date_tags" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "important_dates" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "important_dates" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "interaction_tags" ADD COLUMN "user_id" uuid;--> statement-breakpoint
UPDATE "interaction_tags" SET "user_id" = "interactions"."user_id" FROM "interactions" WHERE "interactions"."id" = "interaction_tags"."interaction_id";--> statement-breakpoint
ALTER TABLE "interaction_tags" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "note_mentions" ADD COLUMN "user_id" uuid;--> statement-breakpoint
UPDATE "note_mentions" SET "user_id" = "notes"."user_id" FROM "notes" WHERE "notes"."id" = "note_mentions"."note_id";--> statement-breakpoint
ALTER TABLE "note_mentions" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "note_tags" ADD COLUMN "user_id" uuid;--> statement-breakpoint
UPDATE "note_tags" SET "user_id" = "notes"."user_id" FROM "notes" WHERE "notes"."id" = "note_tags"."note_id";--> statement-breakpoint
ALTER TABLE "note_tags" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "person_relationships" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "person_relationships" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "relationship_types" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_persons" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "addresses" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "contact_infos" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "due_at" SET DATA TYPE timestamp with time zone USING "due_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "completed_at" SET DATA TYPE timestamp with time zone USING "completed_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
CREATE INDEX "idx_important_date_tags_label_id" ON "important_date_tags" ("label_id");--> statement-breakpoint
CREATE INDEX "idx_important_date_tags_user_id" ON "important_date_tags" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_interaction_tags_label_id" ON "interaction_tags" ("label_id");--> statement-breakpoint
CREATE INDEX "idx_interaction_tags_user_id" ON "interaction_tags" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_note_mentions_user_id" ON "note_mentions" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_note_tags_label_id" ON "note_tags" ("label_id");--> statement-breakpoint
CREATE INDEX "idx_note_tags_user_id" ON "note_tags" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_persons_email" ON "persons" ("email");--> statement-breakpoint
CREATE INDEX "idx_relationship_types_user_id" ON "relationship_types" ("user_id");--> statement-breakpoint
ALTER TABLE "important_date_tags" ADD CONSTRAINT "important_date_tags_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interaction_tags" ADD CONSTRAINT "interaction_tags_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "note_mentions" ADD CONSTRAINT "note_mentions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notes" DROP CONSTRAINT "notes_person_id_persons_id_fkey", ADD CONSTRAINT "notes_person_id_persons_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL;