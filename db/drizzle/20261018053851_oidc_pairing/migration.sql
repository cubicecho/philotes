CREATE TABLE "oidc_settings" (
	"id" text PRIMARY KEY DEFAULT 'oidc',
	"issuer" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text,
	"client_auth" text DEFAULT 'client_secret_basic' NOT NULL,
	"name" text NOT NULL,
	"registration_access_token" text,
	"registration_client_uri" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_settings_singleton" CHECK ("id" = 'oidc')
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- An instance that already has accounts keeps an owner: the oldest one.
UPDATE "users" SET "is_admin" = true WHERE "id" = (SELECT "id" FROM "users" ORDER BY "created_at" LIMIT 1);
