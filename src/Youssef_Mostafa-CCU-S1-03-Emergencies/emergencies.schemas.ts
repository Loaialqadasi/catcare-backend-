import { z } from 'zod';

export const emergencyTypeEnum = z.enum(['injury', 'sickness', 'missing', 'feeding_urgent', 'danger', 'other']);
export const emergencyPriorityEnum = z.enum(['low', 'medium', 'high', 'critical']);
export const emergencyStatusEnum = z.enum(['open', 'in_progress', 'resolved', 'cancelled']);

export const createEmergencySchema = z.object({
  catId: z.coerce.number().int().positive().optional(),
  title: z.string().min(4).max(160).trim(),
  description: z.string().min(10).max(3000).trim(),
  emergencyType: emergencyTypeEnum,
  priority: emergencyPriorityEnum.default('high'),
  locationName: z.string().min(2).max(180).trim(),
  latitude: z.coerce.number().min(-90).max(90).optional().default(1.5595),
  longitude: z.coerce.number().min(-180).max(180).optional().default(103.6388)
});

export const listEmergenciesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: emergencyStatusEnum.optional(),
  priority: emergencyPriorityEnum.optional(),
  cursor: z.string().min(1).max(100).optional()
});

export const emergencyIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const updateEmergencyStatusSchema = z.object({
  status: emergencyStatusEnum
});
