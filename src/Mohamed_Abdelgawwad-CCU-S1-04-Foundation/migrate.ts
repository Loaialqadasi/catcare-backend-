// ============================================
// MIN-7: Database Migration System
// ============================================
// Reads SQL files from the migrations/ directory and runs them in order,
// tracking applied migrations in the schema_migrations table.

import fs from 'node:fs';
import path from 'node:path';
import { db } from './database.js';
import { logger } from './logger.js';

// ─── Resolve migrations directory ───
// When running from the backend root (via tsx or node), migrations/ is
// resolved relative to the current working directory (backend/).
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

// ─── Bootstrap: ensure schema_migrations table exists ───
async function ensureMigrationsTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// ─── Get already-applied migration versions ───
async function getAppliedVersions(): Promise<Set<string>> {
  const result = await db.query('SELECT version FROM schema_migrations');
  return new Set(result.rows.map((row: { version: string }) => row.version));
}

// ─── Discover migration files in order ───
function discoverMigrations(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    logger.warn({ dir: MIGRATIONS_DIR }, 'Migrations directory does not exist');
    return [];
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  return files;
}

// ─── Run a single migration inside a transaction ───
async function runMigration(filename: string): Promise<void> {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf-8');
  const version = filename.replace(/\.sql$/, '');

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Execute the migration SQL
    await client.query(sql);

    // Record the migration as applied (parameterized query)
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [version]
    );

    await client.query('COMMIT');
    logger.info({ migration: filename }, 'Migration applied successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err, migration: filename }, 'Migration failed — rolled back');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Run all pending migrations ───
export async function runMigrations(): Promise<void> {
  logger.info('Running pending database migrations...');

  // Step 1: Ensure the tracking table exists (bootstraps if needed)
  await ensureMigrationsTable();

  // Step 2: Get already-applied versions
  const applied = await getAppliedVersions();

  // Step 3: Discover and filter pending migrations
  const allMigrations = discoverMigrations();
  const pending = allMigrations.filter((file) => {
    const version = file.replace(/\.sql$/, '');
    return !applied.has(version);
  });

  if (pending.length === 0) {
    logger.info('No pending migrations — database is up to date');
    return;
  }

  logger.info({ count: pending.length, pending }, 'Pending migrations found');

  // Step 4: Run each pending migration in order
  for (const migration of pending) {
    await runMigration(migration);
  }

  logger.info({ count: pending.length }, 'All pending migrations applied');
}

// ─── Allow running as a standalone script ───
// Usage: npx tsx src/Mohamed_Abdelgawwad-CCU-S1-04-Foundation/migrate.ts
// Detect standalone invocation by checking if this module is the entry point
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(() => {
      logger.info('Standalone migration run complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Standalone migration run failed');
      process.exit(1);
    });
}
