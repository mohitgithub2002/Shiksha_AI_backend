DROP INDEX "classes_class_idx";--> statement-breakpoint
DROP INDEX "classes_school_session_class_section_unique";--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "class_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_class_id_classlist_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classlist"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classes_class_id_idx" ON "classes" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "classes_school_session_class_section_unique" ON "classes" USING btree ("school_id","session","class_id","section");--> statement-breakpoint
ALTER TABLE "classes" DROP COLUMN "class";