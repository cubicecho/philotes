ALTER TABLE "interactions" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "direction" text;--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_interactions_user_id_source_external_id_person_id" ON "interactions" ("user_id","source","external_id","person_id");