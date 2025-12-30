CREATE TYPE "public"."stream" AS ENUM('science', 'arts', 'commerce');--> statement-breakpoint
CREATE TABLE "ncert_chapters" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_class_id" integer NOT NULL,
	"chapter_name" varchar(255) NOT NULL,
	"chapter_number" integer,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "classlist" ADD COLUMN "class_number" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "classlist" ADD COLUMN "stream" "stream";--> statement-breakpoint
ALTER TABLE "classlist" ADD COLUMN "code" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "ncert_chapters" ADD CONSTRAINT "ncert_chapters_subject_class_id_subject_classes_id_fk" FOREIGN KEY ("subject_class_id") REFERENCES "public"."subject_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ncert_chapters_subject_class_id_idx" ON "ncert_chapters" USING btree ("subject_class_id");--> statement-breakpoint
CREATE INDEX "ncert_chapters_chapter_name_idx" ON "ncert_chapters" USING btree ("chapter_name");--> statement-breakpoint
CREATE INDEX "ncert_chapters_chapter_number_idx" ON "ncert_chapters" USING btree ("chapter_number");--> statement-breakpoint
CREATE INDEX "classlist_class_number_idx" ON "classlist" USING btree ("class_number");--> statement-breakpoint
CREATE INDEX "classlist_code_idx" ON "classlist" USING btree ("code");--> statement-breakpoint
CREATE INDEX "classlist_class_number_stream_idx" ON "classlist" USING btree ("class_number","stream");--> statement-breakpoint
ALTER TABLE "classlist" ADD CONSTRAINT "classlist_code_unique" UNIQUE("code");