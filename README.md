# CatCare UTM — Backend API

Campus Cat Welfare Management System for Universiti Teknologi Malaysia.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (Render hosted)
- **Auth**: JWT (HttpOnly cookies) + CSRF (Double Submit Cookie)
- **File Storage**: Supabase Storage (primary) / base64 fallback (dev)
- **Email**: Nodemailer (Microsoft 365 / Office 365 SMTP)
- **Validation**: Zod v3
- **Logging**: Pino (structured JSON)
- **Testing**: Jest + Supertest

## Architecture

The backend follows a **four-layer pattern** per module:

```
routes → controller → service → repository
```

Each team member's module lives in its own namespaced folder (e.g., `Layth_Amgad-CCU-S1-01-Auth/`). Shared infrastructure is in `Mohamed_Abdelgawwad-CCU-S1-04-Foundation/`.

## File Storage Backends

The project uses **Supabase Storage** as the primary file upload backend. Here's how it works:

| Environment | Storage Backend | Behaviour |
|---|---|---|
| **Production** (Supabase configured) | Supabase Storage | Files are uploaded to a Supabase bucket and served via persistent URLs |
| **Development** (Supabase not configured) | Base64 data URL | Files are encoded as base64 and stored directly in the database. Not recommended for production but works for local testing |

**Configuration**: Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_BUCKET` in your `.env` file. If these are not set, the system automatically falls back to base64 encoding.

> **Note**: The `res.cloudinary.com` hostname in the frontend's `next.config.ts` image domains is a legacy reference. The active storage backend is Supabase, not Cloudinary.

## Email Delivery

Password reset and email verification emails are sent via **Nodemailer** using Microsoft 365 SMTP:

- Host: `smtp.office365.com`
- Port: `587` (STARTTLS)

If SMTP is not configured (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` env vars missing), the reset token is:
1. **Logged to the server console** (for development testing)
2. **Returned in the API response** (so the frontend can handle the reset in-app)

This means the password reset flow works **without email** — the frontend displays the reset form directly after the user enters their email.

## Security Features

- **JWT in HttpOnly cookies** with `sameSite: 'none'` + `secure: true` (cross-origin Vercel + Render)
- **CSRF protection** on all state-changing routes (Double Submit Cookie pattern)
- **Refresh tokens** stored server-side (SHA-256 hashed), revoked on logout/password reset
- **Password strength** enforced on both frontend AND backend (Zod schema: 8+ chars + special character)
- **File upload validation**: MIME type check + magic-byte signature verification
- **Rate limiting**: Global (200 req/15 min) + auth-specific stricter limits
- **SQL injection prevention**: Parameterized queries throughout
- **Email enumeration prevention**: Forgot-password always returns same message
- **Admin account protection**: `admin@utm.my` role cannot be changed

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `development` / `test` / `production` |
| `PORT` | Yes | Server port (e.g., 5000) |
| `DATABASE_HOST` | Yes | PostgreSQL host |
| `DATABASE_PORT` | Yes | PostgreSQL port |
| `DATABASE_USER` | Yes | PostgreSQL user |
| `DATABASE_PASSWORD` | Yes | PostgreSQL password |
| `DATABASE_NAME` | Yes | PostgreSQL database name |
| `JWT_SECRET` | Yes | Min 32 characters |
| `JWT_EXPIRES_IN` | Yes | Access token expiry (e.g., `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token expiry (default: `7d`) |
| `CORS_ORIGIN` | Yes | Allowed frontend origin |
| `ENCRYPTION_KEY` | No | 64-char hex string for encryption |
| `CSRF_SECRET` | No | Min 32 characters |
| `SUPABASE_URL` | No | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key |
| `SUPABASE_BUCKET` | No | Storage bucket name (default: `uploads`) |
| `SMTP_HOST` | No | SMTP server (e.g., `smtp.office365.com`) |
| `SMTP_PORT` | No | SMTP port (default: `587`) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | From address for emails |
| `FRONTEND_URL` | No | Frontend URL for email links (default: `http://localhost:3000`) |
| `GOOGLE_MAPS_API_KEY` | No | Google Maps API key |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/logout` | Yes | Logout |
| GET | `/api/auth/me` | Yes | Get current user |
| POST | `/api/auth/forgot-password` | No | Request password reset |
| POST | `/api/auth/reset-password` | No | Reset password with token |
| PATCH | `/api/auth/change-password` | Yes | Change password |
| POST | `/api/auth/refresh` | No | Refresh access token |
| GET | `/api/auth/users` | Admin | List all users |
| POST | `/api/auth/users` | Admin | Create user |
| PATCH | `/api/auth/users/:id` | Admin | Update user |
| PATCH | `/api/auth/users/:id/role` | Admin | Update user role |
| DELETE | `/api/auth/users/:id` | Admin | Delete user |
| GET | `/api/cats` | No | List cats |
| POST | `/api/cats` | Yes | Create cat |
| GET | `/api/cats/:id` | No | Get cat by ID |
| PATCH | `/api/cats/:id` | Yes | Update cat |
| DELETE | `/api/cats/:id` | Admin | Soft-delete cat |
| GET | `/api/emergencies` | No | List emergencies |
| POST | `/api/emergencies` | Yes | Create emergency |
| GET | `/api/emergencies/:id` | No | Get emergency by ID |
| PATCH | `/api/emergencies/:id` | Yes | Update emergency |
| GET | `/api/donations` | Admin | List all donations |
| POST | `/api/donations` | Yes | Create donation |
| GET | `/api/donations/mine` | Yes | Get own donations |
| GET | `/api/donations/:id` | Yes | Get donation by ID |
| PATCH | `/api/donations/:id/review` | Admin | Review donation |
| GET | `/api/volunteers` | Admin | List volunteers |
| POST | `/api/volunteers` | No | Apply as volunteer |
| PATCH | `/api/volunteers/:id/status` | Admin | Update volunteer status |
| GET | `/api/map/geocode` | No | Geocode search |
| GET | `/api/map/places` | No | Place search |
| GET | `/api/health` | No | Health check |
| GET | `/api/csrf-token` | No | Get CSRF token |

## Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

## Deployment (Render)

1. Connect your GitHub repo to Render
2. Set build command: `npm install --include=dev && npm run build`
3. Set start command: `node dist/server.js`
4. Add all required environment variables
5. Deploy!
