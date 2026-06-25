// Comprehensive integration tests for CatCare UTM API
import request from 'supertest';
import app from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/app.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Unique email generator to avoid collisions between test runs */
const uniqueEmail = () => `test+${Date.now()}@graduate.utm.my`;

/** Admin credentials that should exist in the seed data */
const ADMIN_EMAIL = 'admin@utm.my';
const ADMIN_PASSWORD = 'password123';

/** Extract cookies from a supertest response */
const extractCookies = (res: request.Response): string[] => {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return [];
  return Array.isArray(setCookie) ? setCookie : [setCookie];
};

/** Build a cookie header string from a response's Set-Cookie headers */
const cookieString = (res: request.Response): string => {
  return extractCookies(res)
    .map((c: string) => c.split(';')[0])
    .join('; ');
};

/** Login as admin and return cookie string + csrf token */
const loginAdmin = async (): Promise<{ cookies: string; csrfToken: string }> => {
  // Get CSRF token first
  const csrfRes = await request(app).get('/api/csrf-token');
  const csrfToken = csrfRes.body.data.token;
  const csrfCookies = cookieString(csrfRes);

  // Login
  const loginRes = await request(app)
    .post('/api/auth/login')
    .set('Cookie', csrfCookies)
    .set('X-CSRF-Token', csrfToken)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

  const loginCookies = cookieString(loginRes);
  // Merge csrf cookies with login cookies
  const allCookies = [csrfCookies, loginCookies].filter(Boolean).join('; ');

  return { cookies: allCookies, csrfToken };
};

/** Login as a regular user and return cookie string + csrf token */
const loginUser = async (email: string, password: string): Promise<{ cookies: string; csrfToken: string }> => {
  const csrfRes = await request(app).get('/api/csrf-token');
  const csrfToken = csrfRes.body.data.token;
  const csrfCookies = cookieString(csrfRes);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .set('Cookie', csrfCookies)
    .set('X-CSRF-Token', csrfToken)
    .send({ email, password });

  const loginCookies = cookieString(loginRes);
  const allCookies = [csrfCookies, loginCookies].filter(Boolean).join('; ');

  return { cookies: allCookies, csrfToken };
};

// ─── Health Check Endpoints ─────────────────────────────────────────────────

describe('Health Check Endpoints', () => {
  it('GET /api/health should return 200 with ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.service).toBe('catcare-utm-api');
  });

  it('GET /api/csrf-token should return a CSRF token', async () => {
    const res = await request(app).get('/api/csrf-token');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.token.length).toBeGreaterThan(0);
  });

  it('GET /api/unknown should return 404', async () => {
    const res = await request(app).get('/api/unknown-endpoint');
    expect(res.status).toBe(404);
  });
});

// ─── Auth Sad Path (existing) ───────────────────────────────────────────────

describe('Auth Endpoints — Sad Path', () => {
  it('POST /api/auth/login should require email and password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login should reject invalid email domains', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@gmail.com', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/register should require valid UTM email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Test User',
        email: 'test@gmail.com',
        password: 'Password!123',
      });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/forgot-password should require valid email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'invalid-email' });
    expect(res.status).toBe(400);
  });

  it('GET /api/auth/me should require authentication', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ─── Auth Happy Path ────────────────────────────────────────────────────────

describe('Auth Endpoints — Happy Path', () => {
  const registeredEmail = uniqueEmail();
  const registeredPassword = 'TestP@ss123';
  let authCookies: string;
  let csrfToken: string;

  it('should register a new user', async () => {
    // Get CSRF token
    const csrfRes = await request(app).get('/api/csrf-token');
    csrfToken = csrfRes.body.data.token;
    const csrfCookies = cookieString(csrfRes);

    const res = await request(app)
      .post('/api/auth/register')
      .set('Cookie', csrfCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Integration Test User',
        email: registeredEmail,
        password: registeredPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(registeredEmail);
    expect(res.body.data.user.fullName).toBe('Integration Test User');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('should login with the registered user', async () => {
    const csrfRes = await request(app).get('/api/csrf-token');
    csrfToken = csrfRes.body.data.token;
    const csrfCookies = cookieString(csrfRes);

    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', csrfCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        email: registeredEmail,
        password: registeredPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(registeredEmail);

    // Capture cookies for subsequent requests
    authCookies = [csrfCookies, cookieString(res)].filter(Boolean).join('; ');
    expect(authCookies).toContain('token=');
  });

  it('should get the authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', authCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(registeredEmail);
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('should logout successfully', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', authCookies)
      .set('X-CSRF-Token', csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject requests after logout', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', authCookies);

    // After logout, the cookie is cleared so the token should be invalid
    expect(res.status).toBe(401);
  });
});

// ─── Password Reset Flow ────────────────────────────────────────────────────

describe('Password Reset Flow', () => {
  it('should request a password reset and return a token', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: ADMIN_EMAIL });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBeDefined();
    // The API returns the token directly for in-app reset
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe('string');
  });

  it('should return success even for non-existent email (prevents enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@utm.my' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Should NOT reveal whether the email exists
    expect(res.body.data.token).toBeUndefined();
  });

  it('should reset password with a valid token', async () => {
    // Step 1: Request reset
    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: ADMIN_EMAIL });

    const resetToken = forgotRes.body.data.token;
    if (!resetToken) {
      // Skip if token not returned (e.g., production mode)
      return;
    }

    // Step 2: Reset password with the token
    const newPassword = 'NewP@ssword456';
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: resetToken,
        password: newPassword,
      });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);
    expect(resetRes.body.data.message).toContain('reset');

    // Step 3: Login with the new password
    const csrfRes = await request(app).get('/api/csrf-token');
    const csrfToken = csrfRes.body.data.token;
    const csrfCookies = cookieString(csrfRes);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Cookie', csrfCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: ADMIN_EMAIL, password: newPassword });

    expect(loginRes.status).toBe(200);

    // Step 4: Reset back to original password for other tests
    const forgotRes2 = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: ADMIN_EMAIL });
    const resetToken2 = forgotRes2.body.data.token;
    if (resetToken2) {
      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken2, password: ADMIN_PASSWORD });
    }
  });

  it('should reject reset with invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: 'invalid-token-12345',
        password: 'NewP@ssword789',
      });

    expect(res.status).toBe(401);
  });
});

// ─── Cat CRUD ───────────────────────────────────────────────────────────────

describe('Cat CRUD', () => {
  let cookies: string;
  let csrfToken: string;
  let createdCatId: number;

  beforeAll(async () => {
    const admin = await loginAdmin();
    cookies = admin.cookies;
    csrfToken = admin.csrfToken;
  });

  it('should create a new cat', async () => {
    const res = await request(app)
      .post('/api/cats')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        nickname: 'Test Cat',
        description: 'A cat for integration testing',
        locationName: 'UTM Johor Bahru',
        healthStatus: 'healthy',
        ownershipTag: 'stray',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nickname).toBe('Test Cat');
    expect(res.body.data.id).toBeDefined();
    createdCatId = res.body.data.id;
  });

  it('should list cats', async () => {
    const res = await request(app)
      .get('/api/cats')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('should list cats with pagination', async () => {
    const res = await request(app)
      .get('/api/cats?page=1&pageSize=5')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should get a cat by ID', async () => {
    if (!createdCatId) return;
    const res = await request(app)
      .get(`/api/cats/${createdCatId}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdCatId);
    expect(res.body.data.nickname).toBe('Test Cat');
  });

  it('should update a cat', async () => {
    if (!createdCatId) return;
    const res = await request(app)
      .patch(`/api/cats/${createdCatId}`)
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        nickname: 'Updated Test Cat',
        healthStatus: 'needs_attention',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nickname).toBe('Updated Test Cat');
    expect(res.body.data.healthStatus).toBe('needs_attention');
  });

  it('should delete (soft-delete) a cat', async () => {
    if (!createdCatId) return;
    const res = await request(app)
      .delete(`/api/cats/${createdCatId}`)
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 404 for deleted cat', async () => {
    if (!createdCatId) return;
    const res = await request(app)
      .get(`/api/cats/${createdCatId}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(404);
  });
});

// ─── Emergency CRUD ─────────────────────────────────────────────────────────

describe('Emergency CRUD', () => {
  let cookies: string;
  let csrfToken: string;
  let createdEmergencyId: number;

  beforeAll(async () => {
    const admin = await loginAdmin();
    cookies = admin.cookies;
    csrfToken = admin.csrfToken;
  });

  it('should create a new emergency', async () => {
    const res = await request(app)
      .post('/api/emergencies')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: 'Injured Cat Near Library',
        description: 'A cat appears to have an injured leg near the UTM library building. Needs immediate attention.',
        emergencyType: 'injury',
        priority: 'high',
        locationName: 'UTM Library',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Injured Cat Near Library');
    expect(res.body.data.id).toBeDefined();
    createdEmergencyId = res.body.data.id;
  });

  it('should list emergencies', async () => {
    const res = await request(app)
      .get('/api/emergencies')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should list emergencies with filters', async () => {
    const res = await request(app)
      .get('/api/emergencies?status=open&priority=high')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should get an emergency by ID', async () => {
    if (!createdEmergencyId) return;
    const res = await request(app)
      .get(`/api/emergencies/${createdEmergencyId}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdEmergencyId);
    expect(res.body.data.title).toBe('Injured Cat Near Library');
  });

  it('should update emergency status (admin only)', async () => {
    if (!createdEmergencyId) return;
    const res = await request(app)
      .patch(`/api/emergencies/${createdEmergencyId}/status`)
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('in_progress');
  });
});

// ─── Donation CRUD ──────────────────────────────────────────────────────────

describe('Donation CRUD', () => {
  let cookies: string;
  let csrfToken: string;
  let createdDonationId: number;

  beforeAll(async () => {
    const admin = await loginAdmin();
    cookies = admin.cookies;
    csrfToken = admin.csrfToken;
  });

  it('should create a new donation', async () => {
    const res = await request(app)
      .post('/api/donations')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        donorName: 'Test Donor',
        donorEmail: 'donor@utm.my',
        amount: 50.00,
        note: 'Integration test donation',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.donorName).toBe('Test Donor');
    expect(res.body.data.amount).toBeDefined();
    expect(res.body.data.id).toBeDefined();
    createdDonationId = res.body.data.id;
  });

  it('should list donations (admin)', async () => {
    const res = await request(app)
      .get('/api/donations')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should get own donations', async () => {
    const res = await request(app)
      .get('/api/donations/my')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should get a donation by ID', async () => {
    if (!createdDonationId) return;
    const res = await request(app)
      .get(`/api/donations/${createdDonationId}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdDonationId);
  });
});

// ─── Security ───────────────────────────────────────────────────────────────

describe('Security', () => {
  it('should include helmet security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('should enforce CSRF protection on state-changing routes', async () => {
    // POST to /api/cats without CSRF token should be rejected
    const admin = await loginAdmin();
    const res = await request(app)
      .post('/api/cats')
      .set('Cookie', admin.cookies)
      // No X-CSRF-Token header
      .send({
        nickname: 'CSRF Test Cat',
        locationName: 'UTM',
      });

    // Should be rejected (403) because CSRF token is missing
    expect([403, 400]).toContain(res.status);
  });

  it('should reject requests without authentication for protected routes', async () => {
    const res = await request(app)
      .post('/api/cats')
      .send({ nickname: 'Unauthorized Cat', locationName: 'UTM' });

    expect(res.status).toBe(401);
  });

  it('should set HttpOnly cookies on login', async () => {
    const csrfRes = await request(app).get('/api/csrf-token');
    const csrfToken = csrfRes.body.data.token;
    const csrfCookies = cookieString(csrfRes);

    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', csrfCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    const setCookieHeaders = extractCookies(res);
    const tokenCookie = setCookieHeaders.find((c: string) => c.startsWith('token='));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toContain('HttpOnly');
  });

  it('should reject short passwords on registration', async () => {
    const csrfRes = await request(app).get('/api/csrf-token');
    const csrfToken = csrfRes.body.data.token;
    const csrfCookies = cookieString(csrfRes);

    const res = await request(app)
      .post('/api/auth/register')
      .set('Cookie', csrfCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Weak Password User',
        email: uniqueEmail(),
        password: 'short', // Too short, no special char
      });

    expect(res.status).toBe(400);
  });

  it('should reject passwords without special characters on registration', async () => {
    const csrfRes = await request(app).get('/api/csrf-token');
    const csrfToken = csrfRes.body.data.token;
    const csrfCookies = cookieString(csrfRes);

    const res = await request(app)
      .post('/api/auth/register')
      .set('Cookie', csrfCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'No Special Char User',
        email: uniqueEmail(),
        password: 'longpassword123', // Long enough but no special char
      });

    expect(res.status).toBe(400);
  });
});

// ─── Map Endpoints ──────────────────────────────────────────────────────────

describe('Map Endpoints — Sad Path', () => {
  it('GET /api/map/geocode should require query parameter', async () => {
    const res = await request(app).get('/api/map/geocode');
    expect(res.status).toBe(400);
  });

  it('GET /api/map/geocode should reject short queries', async () => {
    const res = await request(app).get('/api/map/geocode?q=a');
    expect(res.status).toBe(400);
  });

  it('GET /api/map/places should require query parameter', async () => {
    const res = await request(app).get('/api/map/places');
    expect(res.status).toBe(400);
  });
});

// ─── Admin Routes ───────────────────────────────────────────────────────────

describe('Admin Routes', () => {
  let adminCookies: string;
  let adminCsrfToken: string;

  beforeAll(async () => {
    const admin = await loginAdmin();
    adminCookies = admin.cookies;
    adminCsrfToken = admin.csrfToken;
  });

  it('admin can list users', async () => {
    const res = await request(app)
      .get('/api/auth/users')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeDefined();
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
  });

  it('admin can create a user', async () => {
    const newUserEmail = uniqueEmail();
    const res = await request(app)
      .post('/api/auth/users')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrfToken)
      .send({
        fullName: 'Admin Created User',
        email: newUserEmail,
        password: 'CreatedP@ss1',
        role: 'student',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(newUserEmail);
    expect(res.body.data.role).toBe('student');
  });

  it('admin can create a user with volunteer role', async () => {
    const newUserEmail = uniqueEmail();
    const res = await request(app)
      .post('/api/auth/users')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrfToken)
      .send({
        fullName: 'Volunteer User',
        email: newUserEmail,
        password: 'VolunteerP@ss1',
        role: 'volunteer',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('volunteer');
  });

  it('admin can create a user with manager role', async () => {
    const newUserEmail = uniqueEmail();
    const res = await request(app)
      .post('/api/auth/users')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrfToken)
      .send({
        fullName: 'Manager User',
        email: newUserEmail,
        password: 'ManagerP@ss1',
        role: 'manager',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('manager');
  });

  it('admin can change user role to manager', async () => {
    // Create a student first
    const createRes = await request(app)
      .post('/api/auth/users')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrfToken)
      .send({
        fullName: 'Future Manager',
        email: uniqueEmail(),
        password: 'FutureP@ss1',
        role: 'student',
      });
    const userId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/auth/users/${userId}/role`)
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrfToken)
      .send({ role: 'manager' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('manager');
  });

  it('admin create user should reject weak passwords', async () => {
    const res = await request(app)
      .post('/api/auth/users')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrfToken)
      .send({
        fullName: 'Weak Pass User',
        email: uniqueEmail(),
        password: 'short', // Too short, no special char
        role: 'student',
      });

    expect(res.status).toBe(400);
  });

  it('admin create user should reject non-UTM email', async () => {
    const res = await request(app)
      .post('/api/auth/users')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', adminCsrfToken)
      .send({
        fullName: 'Gmail User',
        email: 'user@gmail.com',
        password: 'ValidP@ss123',
        role: 'student',
      });

    expect(res.status).toBe(400);
  });

  it('non-admin cannot access admin user list', async () => {
    // Register a regular student user
    const csrfRes = await request(app).get('/api/csrf-token');
    const csrfToken = csrfRes.body.data.token;
    const csrfCookies = cookieString(csrfRes);

    const studentEmail = uniqueEmail();
    const studentPassword = 'StudentP@ss1';

    await request(app)
      .post('/api/auth/register')
      .set('Cookie', csrfCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Student User',
        email: studentEmail,
        password: studentPassword,
      });

    // Login as student
    const studentAuth = await loginUser(studentEmail, studentPassword);

    // Try to access admin endpoint
    const res = await request(app)
      .get('/api/auth/users')
      .set('Cookie', studentAuth.cookies);

    expect(res.status).toBe(403);
  });

  it('non-admin cannot create users', async () => {
    const studentEmail = uniqueEmail();
    const studentPassword = 'StudentP@ss2';

    const csrfRes = await request(app).get('/api/csrf-token');
    const csrfToken = csrfRes.body.data.token;
    const csrfCookies = cookieString(csrfRes);

    await request(app)
      .post('/api/auth/register')
      .set('Cookie', csrfCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Student Two',
        email: studentEmail,
        password: studentPassword,
      });

    const studentAuth = await loginUser(studentEmail, studentPassword);

    const res = await request(app)
      .post('/api/auth/users')
      .set('Cookie', studentAuth.cookies)
      .set('X-CSRF-Token', studentAuth.csrfToken)
      .send({
        fullName: 'Unauthorized Create',
        email: uniqueEmail(),
        password: 'ValidP@ss123',
        role: 'student',
      });

    expect(res.status).toBe(403);
  });

  it('unauthenticated user cannot access admin routes', async () => {
    const res = await request(app).get('/api/auth/users');
    expect(res.status).toBe(401);
  });
});

// ─── Token Refresh ──────────────────────────────────────────────────────────

describe('Token Refresh', () => {
  it('should refresh token with valid refresh cookie', async () => {
    const csrfRes = await request(app).get('/api/csrf-token');
    const csrfToken = csrfRes.body.data.token;
    const csrfCookies = cookieString(csrfRes);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Cookie', csrfCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    const allCookies = [csrfCookies, cookieString(loginRes)].filter(Boolean).join('; ');

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', allCookies);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.message).toBeDefined();
  });

  it('should reject refresh without refresh token cookie', async () => {
    const res = await request(app)
      .post('/api/auth/refresh');

    expect(res.status).toBe(401);
  });
});
