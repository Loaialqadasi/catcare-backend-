import { z } from 'zod';

export const healthStatusEnum = z.enum(['healthy', 'needs_attention', 'injured', 'unknown']);
export const ownershipTagEnum = z.enum(['stray', 'adopted', 'campus_managed', 'unknown']);

export const createCatSchema = z.object({
  nickname: z.string().min(2).max(100).trim(),
  description: z.string().max(2000).optional().nullable(),
  photoUrl: z
    .string()
    .max(500)
    .refine(
      (val) => val === null || val === undefined || val.startsWith('/uploads/') || z.string().url().safeParse(val).success,
      { message: 'photoUrl must be a valid URL or an /uploads/ path' }
    )
    .optional()
    .nullable(),
  locationName: z.string().min(2).max(180).trim(),
  latitude: z.coerce.number().min(-90).max(90).optional().default(1.5595),
  longitude: z.coerce.number().min(-180).max(180).optional().default(103.6388),
  healthStatus: healthStatusEnum.default('unknown'),
  ownershipTag: ownershipTagEnum.default('unknown'),
  // The 'photo' key may appear in req.body from FormData — file handled by multer
  photo: z.any().optional(),
});

export const updateCatSchema = z.object({
  nickname: z.string().min(2).max(100).trim().optional(),
  description: z.string().max(2000).optional().nullable(),
  photoUrl: z
    .string()
    .max(500)
    .refine(
      (val) => val === null || val === undefined || val.startsWith('/uploads/') || z.string().url().safeParse(val).success,
      { message: 'photoUrl must be a valid URL or an /uploads/ path' }
    )
    .optional()
    .nullable(),
  locationName: z.string().min(2).max(180).trim().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  healthStatus: healthStatusEnum.optional(),
  ownershipTag: ownershipTagEnum.optional(),
  photo: z.any().optional(),
});

export const listCatsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().min(1).max(100).optional(),
  healthStatus: healthStatusEnum.optional(),
  cursor: z.string().min(1).max(100).optional()
});

export const catIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});
