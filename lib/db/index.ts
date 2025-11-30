import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let connectionString: string | null = null;
let sql: postgres.Sql | null = null;
let db: ReturnType<typeof drizzle> | null = null;

/**
 * Initialize database connection with SSH tunnel
 */
export async function initDatabase() {
  try {
    
    // Direct connection (for production or local development)
    connectionString = process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?sslmode=require`;
    
    if (!connectionString) {
      throw new Error('Database connection string is not configured. Please set DATABASE_URL or DB_* environment variables.');
    }

    // Create postgres connection with connection pooling
    sql = postgres(connectionString, {
      max: 10, // Maximum number of connections in the pool
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Connection timeout in seconds
    });

    // Create Drizzle instance
    db = drizzle(sql, { schema });

    console.log('Database connection established successfully');
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Get database instance (initializes if not already done)
 */
export async function getDatabase() {
  if (!db) {
    await initDatabase();
  }
  return db!;
}

/**
 * Close database connection and tunnel
 */
export async function closeDatabase() {
  try {
    if (sql) {
      await sql.end();
      sql = null;
      console.log('Database connection closed');
    }

    db = null;
    connectionString = null;
  } catch (error) {
    console.error('Error closing database connection:', error);
    throw error;
  }
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    if (!db || !sql) {
      await initDatabase();
    }
    
    // Simple query to check connection using sql directly
    const result = await sql!.unsafe('SELECT 1');
    return result.length > 0;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

export { db, schema };

