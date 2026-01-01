ALTER TABLE "schools" ALTER COLUMN "contact_phone" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "password_hash" text;