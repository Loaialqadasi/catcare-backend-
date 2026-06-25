import request from 'supertest';
import express from 'express';

// Mock env module to avoid requiring real env vars
jest.mock('../../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3001,
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: 5432,
    DATABASE_USER: 'test',
    DATABASE_PASSWORD: 'test',
    DATABASE_NAME: 'test',
    JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long!!',
    JWT_EXPIRES_IN: '1h',
    CORS_ORIGIN: 'http://localhost:3000',
    CLOUDINARY_CLOUD_NAME: 'test',
    CLOUDINARY_API_KEY: 'test',
    CLOUDINARY_API_SECRET: 'test',
  },
}));

jest.mock('../../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/database.js', () => ({
  db: {
    query: jest.fn(),
    on: jest.fn(),
  },
}));

import { validate } from '../../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/validate.middleware.js';
import { errorHandler } from '../../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/error.middleware.js';
import { notFoundHandler } from '../../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/not-found.middleware.js';
import { authMiddleware } from '../auth.middleware.js';
import { registerSchema, loginSchema } from '../auth.schemas.js';

// Build a minimal Express app with auth route validation logic only (no DB)
function createAuthTestApp() {
  const app = express();
  app.use(express.json());

  // POST /api/auth/register — validates body against registerSchema
  app.post('/api/auth/register', validate({ body: registerSchema }), (_req, res) => {
    res.json({ success: true, data: { message: 'register validation passed' } });
  });

  // POST /api/auth/login — validates body against loginSchema
  app.post('/api/auth/login', validate({ body: loginSchema }), (_req, res) => {
    res.json({ success: true, data: { message: 'login validation passed' } });
  });

  // GET /api/auth/me — requires auth middleware
  app.get('/api/auth/me', authMiddleware, (_req, res) => {
    res.json({ success: true, data: { message: 'authenticated' } });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('Auth Routes — Validation & Auth', () => {
  const app = createAuthTestApp();

  describe('POST /api/auth/register', () => {
    it('returns 400 with missing fields', async () => {
      const res = await request(app).post('/api/auth/register').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 with missing email', async () => {
      const res = await request(app).post('/api/auth/register').send({
        fullName: 'Test User',
        password: 'Password1!',
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 with invalid email domain', async () => {
      const res = await request(app).post('/api/auth/register').send({
        fullName: 'Test User',
        email: 'test@gmail.com',
        password: 'Password1!',
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 with short password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        fullName: 'Test User',
        email: 'test@utm.my',
        password: 'short',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 400 with missing fields', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 with missing password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@utm.my',
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 with missing email', async () => {
      const res = await request(app).post('/api/auth/login').send({
        password: 'Password1!',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
