import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/validate.middleware.js';
import { authMiddleware } from '../Layth_Amgad-CCU-S1-01-Auth/auth.middleware.js';
import { managerMiddleware } from '../Layth_Amgad-CCU-S1-28-Donations/admin.middleware.js';
import { ValidationError } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/errors.js';
import { upload } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/upload.js';
import { catsController } from './cats.controller.js';
import { catIdParamSchema, createCatSchema, updateCatSchema, listCatsQuerySchema } from './cats.schemas.js';

export const catsRoutes = Router();

// ── Magic-bytes validation ──────────────────────────────────────────────
// Checks the actual file bytes in memory — prevents MIME spoofing (CRIT-3)
async function validateImageBuffer(req: Request, _res: Response, next: NextFunction) {
  const file = req.file;
  if (!file) return next(); // photo is optional

  const buffer = file.buffer;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return next();
  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) return next();
  // WebP: RIFF....WEBP
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) return next();

  return next(
    new ValidationError('Invalid image file. Only real JPG, PNG, or WebP images are allowed.', {
      field: 'photo',
    })
  );
}

// ── Rate limiter for upload endpoint ───────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many upload attempts. Please try again later.',
  },
});

// ── Routes ─────────────────────────────────────────────────────────────
// NOTE: CSRF protection is applied globally in app.ts via:
//   app.use('/api/cats', csrfProtection);
// Do NOT add per-route csrfProtection here — it would run AFTER authMiddleware,
// causing a session identifier mismatch (token generated with session-cookie ID
// but validated with user-ID), resulting in 403 CSRF_INVALID errors.

// create a cat — auth required, photo optional
catsRoutes.post(
  '/',
  authMiddleware,
  uploadLimiter,
  upload.single('photo'),
  validateImageBuffer,
  validate({ body: createCatSchema }),
  catsController.create
);

// browse cats with search and filters
catsRoutes.get(
  '/',
  validate({ query: listCatsQuerySchema }),
  catsController.list
);

// view a single cat
catsRoutes.get(
  '/:id',
  validate({ params: catIdParamSchema }),
  catsController.getById
);

// view care history for a cat
catsRoutes.get(
  '/:id/care-history',
  validate({ params: catIdParamSchema }),
  catsController.getCareHistory
);

// update a cat — manager or admin, with optional photo upload
catsRoutes.patch(
  '/:id',
  authMiddleware,
  managerMiddleware,
  upload.single('photo'),
  validateImageBuffer,
  validate({ params: catIdParamSchema, body: updateCatSchema }),
  catsController.update
);

// soft delete a cat — manager or admin
catsRoutes.delete(
  '/:id',
  authMiddleware,
  managerMiddleware,
  validate({ params: catIdParamSchema }),
  catsController.softDelete
);

// restore a soft-deleted cat — manager or admin
catsRoutes.patch(
  '/:id/restore',
  authMiddleware,
  managerMiddleware,
  validate({ params: catIdParamSchema }),
  catsController.restore
);
