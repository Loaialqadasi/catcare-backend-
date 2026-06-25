import { Router } from 'express';
import { authMiddleware } from '../Layth_Amgad-CCU-S1-01-Auth/auth.middleware.js';
import { managerMiddleware, adminMiddleware } from '../Layth_Amgad-CCU-S1-28-Donations/admin.middleware.js';
import { csrfProtection } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/csrf.js';
import { validate } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/validate.middleware.js';
import { emergenciesController } from './emergencies.controller.js';
import {
  createEmergencySchema,
  emergencyIdParamSchema,
  listEmergenciesQuerySchema,
  updateEmergencyStatusSchema
} from './emergencies.schemas.js';

export const emergenciesRoutes = Router();

// report a new emergency — needs to be logged in (CSRF already applied globally on /api/emergencies)
emergenciesRoutes.post('/', authMiddleware, validate({ body: createEmergencySchema }), emergenciesController.create);

// browse all emergencies with filters
emergenciesRoutes.get('/', validate({ query: listEmergenciesQuerySchema }), emergenciesController.list);

// priority feed — public, no auth needed
emergenciesRoutes.get('/priority-feed', emergenciesController.priorityFeed);

// MED-08 Fix: Change emergency status — manager or admin
// (Manager can triage emergencies; admin retains full control.)
emergenciesRoutes.patch(
  '/:id/status',
  authMiddleware,
  managerMiddleware,
  validate({ params: emergencyIdParamSchema, body: updateEmergencyStatusSchema }),
  emergenciesController.updateStatus
);

// view a single emergency
emergenciesRoutes.get('/:id', validate({ params: emergencyIdParamSchema }), emergenciesController.getById);

// soft delete an emergency — manager or admin (CSRF protected)
emergenciesRoutes.delete(
  '/:id',
  authMiddleware,
  managerMiddleware,
  csrfProtection,
  validate({ params: emergencyIdParamSchema }),
  emergenciesController.softDelete
);

// restore a soft-deleted emergency — manager or admin (CSRF protected)
emergenciesRoutes.patch(
  '/:id/restore',
  authMiddleware,
  managerMiddleware,
  csrfProtection,
  validate({ params: emergencyIdParamSchema }),
  emergenciesController.restore
);
