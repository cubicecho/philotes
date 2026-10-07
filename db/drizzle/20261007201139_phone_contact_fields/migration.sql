DROP INDEX "idx_persons_last_name_first_name";--> statement-breakpoint
ALTER TABLE "contact_infos" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "contact_infos" ADD COLUMN "normalized_value" text;--> statement-breakpoint
ALTER TABLE "important_dates" ADD COLUMN "kind" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
-- The kind was only ever in the name.
UPDATE "important_dates" SET "kind" = CASE
	WHEN "name" ~* '\mbirthday' THEN 'birthday'
	WHEN "name" ~* '\manniversary' THEN 'anniversary'
	ELSE 'other'
END;--> statement-breakpoint
ALTER TABLE "important_dates" ADD COLUMN "has_year" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "name_prefix" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "middle_name" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "name_suffix" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "nickname" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "organization" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "about" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "display_name" text GENERATED ALWAYS AS (coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), nullif(btrim(nickname), ''), nullif(btrim(organization), ''), '')) STORED;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "sort_name" text GENERATED ALWAYS AS (lower(coalesce(nullif(btrim(coalesce(last_name, '') || ' ' || coalesce(first_name, '')), ''), nullif(btrim(nickname), ''), nullif(btrim(organization), ''), ''))) STORED;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "uid" text DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
-- A person who was here before sync keeps their id as the uid.
UPDATE "persons" SET "uid" = "id"::text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "vcard_extra" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_country" text DEFAULT 'US' NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_infos" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
-- A written label says where a detail reaches the person; the old "mobile" type said it too.
UPDATE "contact_infos" SET "kind" = CASE
	WHEN "type" = 'mobile' THEN 'mobile'
	WHEN "label" ~* '\m(mobile|cell)' THEN 'mobile'
	WHEN "label" ~* '\mhome' THEN 'home'
	WHEN "label" ~* '\mwork' THEN 'work'
END;--> statement-breakpoint
UPDATE "contact_infos" SET "type" = 'phone' WHERE "type" = 'mobile';--> statement-breakpoint
-- Phones as E.164, read as US numbers where no country code is written: every account starts with
-- that default country. A number that fits neither shape keeps its digits. The rest are lower-cased.
UPDATE "contact_infos" SET "normalized_value" = CASE
	WHEN "type" NOT IN ('phone', 'fax') THEN lower(btrim("value"))
	WHEN btrim("value") LIKE '+%' THEN '+' || regexp_replace("value", '\D', '', 'g')
	WHEN length(regexp_replace("value", '\D', '', 'g')) = 10 THEN '+1' || regexp_replace("value", '\D', '', 'g')
	WHEN regexp_replace("value", '\D', '', 'g') ~ '^1\d{10}$' THEN '+' || regexp_replace("value", '\D', '', 'g')
	ELSE regexp_replace("value", '\D', '', 'g')
END;--> statement-breakpoint
ALTER TABLE "contact_infos" ALTER COLUMN "normalized_value" SET NOT NULL;--> statement-breakpoint
DROP TYPE "contact_type";--> statement-breakpoint
CREATE TYPE "contact_type" AS ENUM('email', 'phone', 'fax', 'im', 'linkedin', 'twitter', 'instagram', 'website', 'other');--> statement-breakpoint
ALTER TABLE "contact_infos" ALTER COLUMN "type" SET DATA TYPE "contact_type" USING "type"::"contact_type";--> statement-breakpoint
ALTER TABLE "persons" ALTER COLUMN "first_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "persons" ALTER COLUMN "last_name" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_contact_infos_user_id_normalized_value" ON "contact_infos" ("user_id","normalized_value");--> statement-breakpoint
CREATE INDEX "idx_persons_user_id_sort_name" ON "persons" ("user_id","sort_name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_persons_user_id_uid" ON "persons" ("user_id","uid");