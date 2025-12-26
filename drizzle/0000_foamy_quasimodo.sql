CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM('active', 'inactive', 'suspended', 'graduated', 'transferred');--> statement-breakpoint
CREATE TABLE "classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"session" varchar(100) NOT NULL,
	"class" varchar(100) NOT NULL,
	"section" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"class" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"class_id" integer NOT NULL,
	"enrollment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"pin_code" varchar(10),
	"owner_name" varchar(255),
	"contact_email" varchar(255),
	"contact_phone" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schools_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"gender" "gender" NOT NULL,
	"email" varchar(255) NOT NULL,
	"address" text,
	"date_of_birth" timestamp with time zone,
	"father_name" varchar(200),
	"mother_name" varchar(200),
	"category" varchar(100),
	"aadhar_number" varchar(20),
	"enrollment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "student_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subject_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" integer NOT NULL,
	"classlist_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"employee_id" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"gender" "gender" NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"address" text,
	"department" varchar(100),
	"joining_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teachers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" varchar(20) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_classes" ADD CONSTRAINT "subject_classes_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_classes" ADD CONSTRAINT "subject_classes_classlist_id_classlist_id_fk" FOREIGN KEY ("classlist_id") REFERENCES "public"."classlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classes_school_id_idx" ON "classes" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "classes_session_idx" ON "classes" USING btree ("session");--> statement-breakpoint
CREATE INDEX "classes_class_idx" ON "classes" USING btree ("class");--> statement-breakpoint
CREATE INDEX "classes_section_idx" ON "classes" USING btree ("section");--> statement-breakpoint
CREATE UNIQUE INDEX "classes_school_session_class_section_unique" ON "classes" USING btree ("school_id","session","class","section");--> statement-breakpoint
CREATE INDEX "classlist_class_idx" ON "classlist" USING btree ("class");--> statement-breakpoint
CREATE INDEX "enrollments_student_id_idx" ON "enrollments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "enrollments_class_id_idx" ON "enrollments" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "enrollments_is_active_idx" ON "enrollments" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_student_class_unique" ON "enrollments" USING btree ("student_id","class_id");--> statement-breakpoint
CREATE INDEX "schools_name_idx" ON "schools" USING btree ("name");--> statement-breakpoint
CREATE INDEX "students_user_id_idx" ON "students" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "students_school_id_idx" ON "students" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "subject_classes_subject_id_idx" ON "subject_classes" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "subject_classes_classlist_id_idx" ON "subject_classes" USING btree ("classlist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subject_classes_subject_classlist_unique" ON "subject_classes" USING btree ("subject_id","classlist_id");--> statement-breakpoint
CREATE INDEX "subjects_name_idx" ON "subjects" USING btree ("name");--> statement-breakpoint
CREATE INDEX "teachers_employee_id_idx" ON "teachers" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "teachers_school_id_idx" ON "teachers" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "teachers_school_id_employee_id_idx" ON "teachers" USING btree ("school_id","employee_id");