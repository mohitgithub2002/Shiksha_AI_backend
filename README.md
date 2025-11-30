# SHIKSHA AI - Backend System

AI-powered school management system backend built with Next.js, Drizzle ORM, and PostgreSQL.

## Features

- 🚀 Next.js 16 with App Router
- 🗄️ PostgreSQL database with Drizzle ORM
- 📱 CORS enabled for web and mobile clients
- 🛡️ Type-safe database queries with TypeScript
- 📊 Health check endpoints
- 🔄 Database migrations support with Drizzle Kit
- 🎯 Modular architecture with utility functions

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (local or remote)
- TypeScript knowledge (optional but recommended)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd shikshai-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory with the following variables:

   ```env
   # Database Configuration
   # Option 1: Direct connection string
   DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

   # Option 2: Individual database variables (alternative to DATABASE_URL)
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=shiksha_ai

   # API Configuration
   NODE_ENV=development

   # CORS Configuration (optional, defaults to '*' in development)
   # For production, specify allowed origins separated by commas
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   ```

## Database Setup

### 1. Initialize Database Schema

Generate migration files from your schema:

```bash
npm run db:generate
```

This will create migration files in the `drizzle/` directory.

### 2. Run Migrations

Apply migrations to your database:

```bash
npm run db:migrate
```

Or push schema directly (for development):

```bash
npm run db:push
```

### 3. Open Drizzle Studio (Optional)

View and manage your database with Drizzle Studio:

```bash
npm run db:studio
```

## Running the Application

### Development Mode

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Build

```bash
npm run build
npm start
```

## API Endpoints

### Health Check
- `GET /api/health` - Check system and database health status
  - Returns: System status, database connection status, uptime, and timestamp

## Database Schema

The database schema is defined in `lib/db/schema.ts` using Drizzle ORM. The current schema includes:

- **Users**: Base user table with roles (admin, teacher, student, parent)
  - Fields: id, email, password, firstName, lastName, role, phone, isActive, timestamps
  - Indexes: email (unique), role
  
- **Students**: Student-specific information linked to users
  - Fields: id, userId, studentId, dateOfBirth, address, parentName, parentPhone, enrollmentDate, timestamps
  - Indexes: userId, studentId (unique)
  
- **Teachers**: Teacher-specific information linked to users
  - Fields: id, userId, employeeId, department, qualification, experience, hireDate, timestamps
  - Indexes: userId, employeeId (unique)
  
- **Classes**: Class/course information
  - Fields: id, name, code, description, teacherId, academicYear, maxStudents, currentStudents, isActive, timestamps
  - Indexes: code (unique), teacherId
  
- **StudentClasses**: Many-to-many relationship for student enrollments
  - Fields: id, studentId, classId, enrollmentDate, isActive, createdAt
  - Indexes: composite index on (studentId, classId)

All tables include proper foreign key relationships and cascade delete rules where appropriate.

## Project Structure

```
shikshai-backend/
├── app/
│   ├── api/              # API routes
│   │   └── health/       # Health check endpoint
│   │       └── route.ts
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home page
│   ├── globals.css       # Global styles
│   └── favicon.ico
├── lib/
│   ├── db/               # Database configuration
│   │   ├── index.ts      # Drizzle client & connection management
│   │   └── schema.ts     # Database schema definitions
│   ├── middleware/       # Middleware utilities
│   │   └── cors.ts       # CORS handling
│   └── utils/            # Utility functions
│       ├── api-response.ts    # API response helpers
│       └── error-handler.ts   # Error handling utilities
├── public/               # Static assets
├── drizzle/              # Drizzle migrations (generated)
├── drizzle.config.ts     # Drizzle configuration
├── next.config.ts        # Next.js configuration
├── tsconfig.json         # TypeScript configuration
├── eslint.config.mjs     # ESLint configuration
└── package.json
```

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | Full PostgreSQL connection string | Yes* | - |
| `DB_HOST` | Database hostname | Yes* | - |
| `DB_PORT` | Database port | No | 5432 |
| `DB_USER` | Database username | Yes* | - |
| `DB_PASSWORD` | Database password | Yes* | - |
| `DB_NAME` | Database name | Yes* | - |
| `NODE_ENV` | Environment mode (development/production) | No | development |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | No | * (all origins) |

\* Either `DATABASE_URL` or all `DB_*` variables are required.

## Security Considerations

1. **Never commit `.env.local`** - It contains sensitive credentials
2. **Restrict CORS origins** in production by setting `ALLOWED_ORIGINS` environment variable
3. **Enable SSL** for database connections (use `?sslmode=require` in connection string)
4. **Use strong database passwords** and rotate credentials regularly
5. **Keep dependencies updated** - Run `npm audit` regularly
6. **Use environment-specific configurations** - Different settings for dev/staging/production

## Troubleshooting

### Database Connection Issues

- Verify all database environment variables are set correctly
- Check RDS endpoint and port are correct
- Ensure database user has proper permissions
- Verify SSL mode matches your RDS configuration

### Migration Issues

- Ensure database connection is working before running migrations
- Check that schema changes are valid
- Review migration files in `drizzle/` directory (generated after running `npm run db:generate`)

### TypeScript Errors

- Run `npm run lint` to check for code issues
- Ensure all environment variables are properly typed
- Check `tsconfig.json` for path aliases configuration

## Development Roadmap

- [ ] Implement JWT authentication
- [ ] Add role-based access control (RBAC)
- [ ] Create API endpoints for users, students, teachers, and classes
- [ ] Add request validation with Zod (already in dependencies)
- [ ] Implement API rate limiting
- [ ] Add request logging and monitoring
- [ ] Set up automated testing (Jest/Vitest)
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Implement password hashing (bcrypt)
- [ ] Add email verification
- [ ] Create admin dashboard endpoints

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

[Your License Here]

## Support

For issues and questions, please open an issue in the repository.
