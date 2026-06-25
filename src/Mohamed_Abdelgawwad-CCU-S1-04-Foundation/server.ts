import app from './app.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { runMigrations } from './migrate.js';
import { db } from './database.js';

// MED-04 Fix: Process-level crash guards for unhandled rejections and exceptions
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection — shutting down');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

// Graceful shutdown: close HTTP server and database pool on SIGTERM/SIGINT
function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal — draining connections...');
  db.end()
    .then(() => {
      logger.info('Database pool closed. Exiting.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Error closing database pool during shutdown');
      process.exit(1);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// MIN-7: Run pending database migrations before starting the server
runMigrations()
  .then(() => {
    logger.info('Migrations complete. Starting server...');
    const server = app.listen(env.PORT, () => {
      logger.info({ port: env.PORT }, 'CatCare UTM API running');
    });

    // Ensure server closes gracefully
    server.on('close', () => {
      logger.info('HTTP server closed');
    });
  })
  .catch((err) => {
    logger.error({ err }, 'Database migrations failed — server not started');
    process.exit(1);
  });
