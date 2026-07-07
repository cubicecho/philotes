CREATE TABLE "gratitudes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"person_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_gratitudes_person_id" ON "gratitudes" ("person_id");--> statement-breakpoint
CREATE INDEX "idx_gratitudes_user_id" ON "gratitudes" ("user_id");--> statement-breakpoint
ALTER TABLE "gratitudes" ADD CONSTRAINT "gratitudes_person_id_persons_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "gratitudes" ADD CONSTRAINT "gratitudes_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;