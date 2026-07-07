CREATE TABLE "important_date_persons" (
	"important_date_id" uuid,
	"person_id" uuid,
	CONSTRAINT "important_date_persons_pkey" PRIMARY KEY("important_date_id","person_id")
);
--> statement-breakpoint
CREATE INDEX "idx_important_date_persons_person_id" ON "important_date_persons" ("person_id");--> statement-breakpoint
ALTER TABLE "important_date_persons" ADD CONSTRAINT "important_date_persons_ETs5P0jinDWZ_fkey" FOREIGN KEY ("important_date_id") REFERENCES "important_dates"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "important_date_persons" ADD CONSTRAINT "important_date_persons_person_id_persons_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE;