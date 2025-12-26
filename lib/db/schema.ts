import { pgTable, serial, varchar, text, timestamp, boolean, integer, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const genderEnum = pgEnum('gender', ['male', 'female', 'other']);
export const studentStatusEnum = pgEnum('student_status', ['active', 'inactive', 'suspended', 'graduated', 'transferred']);


export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  pinCode: varchar("pin_code", { length: 10 }),
  ownerName: varchar("owner_name", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('schools_name_idx').on(table.name),
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 20 }).unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});


// Students table
export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  gender: genderEnum('gender').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  address: text('address'),
  dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),
  fatherName: varchar('father_name', { length: 200 }),
  motherName: varchar('mother_name', { length: 200 }),
  category: varchar('category', { length: 100 }),
  aadharNumber: varchar('aadhar_number', { length: 20 }),
  enrollmentDate: timestamp('enrollment_date', { withTimezone: true }).notNull().defaultNow(),
  status: studentStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('students_user_id_idx').on(table.userId),
  index('students_school_id_idx').on(table.schoolId),

]);

// Teachers table
export const teachers = pgTable('teachers', {   
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 50 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  gender: genderEnum('gender').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  address: text('address'),
  department: varchar('department', { length: 100 }),
  joiningDate: timestamp('joining_date', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('teachers_employee_id_idx').on(table.employeeId),
  index('teachers_school_id_idx').on(table.schoolId),
  index('teachers_school_id_employee_id_idx').on(table.schoolId, table.employeeId),
]);

// Classes table
export const classes = pgTable('classes', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
  session: varchar('session', { length: 100 }).notNull(),
  className: varchar('class', { length: 100 }).notNull(),
  section: varchar('section', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [  
  index('classes_school_id_idx').on(table.schoolId),
  index('classes_session_idx').on(table.session),
  index('classes_class_idx').on(table.className),
  index('classes_section_idx').on(table.section),
  uniqueIndex('classes_school_session_class_section_unique').on(table.schoolId, table.session, table.className, table.section),
]);

// Enrollments table
export const enrollments = pgTable('enrollments', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  enrollmentDate: timestamp('enrollment_date', { withTimezone: true }).notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('enrollments_student_id_idx').on(table.studentId),
  index('enrollments_class_id_idx').on(table.classId),
  index('enrollments_is_active_idx').on(table.isActive),
  uniqueIndex('enrollments_student_class_unique').on(table.studentId, table.classId),
]);

// subjects table
export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
}, (table) => [
  index('subjects_name_idx').on(table.name),
]);

// classlist table
export const classlist = pgTable('classlist', {
  id: serial('id').primaryKey(),
  className: varchar('class', { length: 100 }).notNull(),
}, (table) => [
  index('classlist_class_idx').on(table.className),
]);

// subject_classes table
export const subjectClasses = pgTable('subject_classes', {
  id: serial('id').primaryKey(),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  classlistId: integer('classlist_id').notNull().references(() => classlist.id, { onDelete: 'cascade' }),
}, (table) => [
  index('subject_classes_subject_id_idx').on(table.subjectId),
  index('subject_classes_classlist_id_idx').on(table.classlistId),
  uniqueIndex('subject_classes_subject_classlist_unique').on(table.subjectId, table.classlistId),
]);

// Relations
export const schoolsRelations = relations(schools, ({ many }) => ({
  students: many(students),
  teachers: many(teachers),
  classes: many(classes),
}));

export const usersRelations = relations(users, ({ many }) => ({
  students: many(students),
}));

export const studentsRelations = relations(students, ({ many, one }) => ({
  enrollments: many(enrollments),
  school: one(schools, {
    fields: [students.schoolId],
    references: [schools.id],
  }),
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
}));

export const teachersRelations = relations(teachers, ({ one }) => ({
  school: one(schools, {
    fields: [teachers.schoolId],
    references: [schools.id],
  }),
}));

export const classesRelations = relations(classes, ({ many, one }) => ({
  enrollments: many(enrollments),
  school: one(schools, {
    fields: [classes.schoolId],
    references: [schools.id],
  }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(students, {
    fields: [enrollments.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [enrollments.classId],
    references: [classes.id],
  }),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  subjectClasses: many(subjectClasses),
}));

export const classlistRelations = relations(classlist, ({ many }) => ({
  subjectClasses: many(subjectClasses),
}));

export const subjectClassesRelations = relations(subjectClasses, ({ one }) => ({
  subject: one(subjects, {
    fields: [subjectClasses.subjectId],
    references: [subjects.id],
  }),
  classlist: one(classlist, {
    fields: [subjectClasses.classlistId],
    references: [classlist.id],
  }),
}));


