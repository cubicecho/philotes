-- better-auth requires a name. Accounts made by the old magic link have none, so they take the email's local part.
UPDATE "users" SET "name" = split_part("email", '@', 1) WHERE "name" IS NULL;
