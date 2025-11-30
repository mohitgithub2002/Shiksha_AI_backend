import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USER ?? 'user',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? '',
    ssl: { rejectUnauthorized: false },
  },
} satisfies Config;
