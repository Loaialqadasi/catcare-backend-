import dns from 'node:dns';
import type { LookupOneOptions } from 'node:dns';
import pg from 'pg';
import { env } from './env.js';
import { logger } from './logger.js';

// ─── Force IPv4 DNS resolution ───
// Some cloud hosts (notably Render) have broken IPv6 routing — connections to
// Supabase's IPv6 addresses fail with ENETUNREACH. Telling Node to prefer IPv4
// when resolving hostnames fixes this without breaking anything else.
// This must run BEFORE any pg Pool is created.
dns.setDefaultResultOrder('ipv4first');

// ─── Build pool config ───
// Supports two connection modes:
//   1) DATABASE_URL — a single connection string (e.g. from Supabase, Neon, etc.)
//   2) Individual vars — DATABASE_HOST / PORT / USER / PASSWORD / NAME
// If DATABASE_URL is set it takes priority; otherwise the individual vars are used.

// ─── SSL configuration ───
// Supabase's connection POOLER (port 6543) uses a self-signed certificate that
// is NOT in Node.js's trust store, causing "self-signed certificate in certificate
// chain" errors on cloud hosts like Render.
//
// The connection is still TLS-encrypted — we just skip cert identity verification.
// This is the standard workaround documented by Supabase for Node.js apps using
// the pooler connection.
//
// If you want to enforce cert verification (e.g., using the DIRECT connection on
// port 5432, which has a proper CA-signed cert), set DB_SSL_REJECT_UNAUTHORIZED=true.
//
// Refs:
//   - https://supabase.com/docs/guides/database/connecting-to-postgres
//   - https://github.com/brianc/node-postgres/issues/2009

function buildSslConfig() {
  const rejectUnauthorized = env.DB_SSL_REJECT_UNAUTHORIZED === 'true';
  return { rejectUnauthorized };
}

// Custom DNS lookup that ONLY returns IPv4 addresses.
// Belt-and-suspenders fix for hosts with broken IPv6 routing.
type DnsCallback = (err: NodeJS.ErrnoException | null, address: string, family: number) => void;
const ipv4OnlyLookup = (
  hostname: string,
  options: LookupOneOptions | number,
  callback: DnsCallback,
): void => {
  const opts: LookupOneOptions =
    typeof options === 'number' ? { family: options } : { ...options, family: 4 };
  dns.lookup(hostname, opts, callback);
};

const poolConfig = {
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Force IPv4 — Render's containers cannot reach IPv6 addresses.
  // Cast to unknown→pg.PoolConfig because pg's types don't expose `lookup`,
  // even though the underlying pg-pool / net.Socket code honours it.
  lookup: ipv4OnlyLookup,
} as unknown as pg.PoolConfig;

if (env.DATABASE_URL) {
  // Connection-string mode (Supabase, Neon, Render, etc.)
  poolConfig.connectionString = env.DATABASE_URL;
  poolConfig.ssl = buildSslConfig();
} else {
  // Individual-vars mode (local Postgres, Docker, etc.)
  poolConfig.host = env.DATABASE_HOST;
  poolConfig.port = env.DATABASE_PORT;
  poolConfig.user = env.DATABASE_USER;
  poolConfig.password = env.DATABASE_PASSWORD;
  poolConfig.database = env.DATABASE_NAME;
  // Local Postgres typically doesn't use SSL
  poolConfig.ssl = env.NODE_ENV === 'production' ? buildSslConfig() : false;
}

export const db = new pg.Pool(poolConfig);

// MED-05 Fix: Handle unexpected PostgreSQL pool errors
db.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error — connection may have been dropped');
});
