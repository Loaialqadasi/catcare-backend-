// Map controller — handles geocoding and places search requests

import { Request, Response, NextFunction } from 'express';
import { mapService } from './map.service.js';
import { success } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/response.js';
import { ValidationError } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/errors.js';

export const mapController = {
  async geocode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length < 2) {
        return next(new ValidationError('Query parameter "q" is required (min 2 characters)', { field: 'q' }));
      }
      if (query.length > 200) {
        return next(new ValidationError('Query parameter "q" must be at most 200 characters', { field: 'q' }));
      }
      const results = await mapService.geocode(query);
      success(res, results);
    } catch (error) {
      next(error);
    }
  },

  async searchPlaces(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length < 2) {
        return next(new ValidationError('Query parameter "q" is required (min 2 characters)', { field: 'q' }));
      }
      if (query.length > 200) {
        return next(new ValidationError('Query parameter "q" must be at most 200 characters', { field: 'q' }));
      }
      const results = await mapService.searchPlaces(query);
      success(res, results);
    } catch (error) {
      next(error);
    }
  },
};
