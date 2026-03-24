// src/server.ts
// Entry point. Validates required env vars, verifies DB connection, starts HTTP server.
import 'dotenv/config';
import logger from './utils/logger';

// ── Required environment variable validation ───────────────────────────────────
const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missing = REQUIRED_VARS.filter((k) => !process.env[k]);

if (missing.length > 0) {
  logger.error(`Missing required environment variables: ${missing.join(', ')}`);
  logger.error('Copy .env.template to .env and fill in the required values.');
  process.exit(1);
}

// ── Supabase presence check (warns, does not crash) ───────────────────────────
const supabaseConfigured =
  !!process.env.SUPABASE_URL &&
  process.env.SUPABASE_URL !== 'https://placeholder.supabase.co' &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.SUPABASE_SERVICE_ROLE_KEY !== 'placeholder';

if (!supabaseConfigured) {
  logger.warn('Supabase is not configured. File uploads will return placeholder URLs.');
  logger.warn('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env to enable real storage.');
  process.env.SUPABASE_URL              = process.env.SUPABASE_URL              ?? 'https://placeholder.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder';
}

import app from './app';
import db  from './config/db';

const PORT = parseInt(process.env.PORT ?? '4000', 10);

async function start(): Promise<void> {
  // Verify database connectivity before accepting traffic
  try {
    await db.query('SELECT 1');
    logger.info('✓ Database connection verified.');
  } catch (err) {
    logger.error('Cannot connect to PostgreSQL. Check DATABASE_URL in .env.', {
      error: (err as Error).message,
    });
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`✓ CBH API running → http://localhost:${PORT} [${process.env.NODE_ENV ?? 'development'}]`);
    logger.info(`  Health check  → http://localhost:${PORT}/health`);
    logger.info(`  API base      → http://localhost:${PORT}${process.env.API_PREFIX ?? '/api/v1'}`);
    if (!supabaseConfigured) {
      logger.warn('  File uploads  → PLACEHOLDER MODE (configure Supabase for real storage)');
    }
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = (signal: string): void => {
    logger.info(`${signal} received — shutting down…`);
    server.close(async () => {
      await db.pool.end();
      logger.info('Database pool closed. Goodbye.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Promise Rejection', { reason: String(reason) });
  });

  process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

start();
