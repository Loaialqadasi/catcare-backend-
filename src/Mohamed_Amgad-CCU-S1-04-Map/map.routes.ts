import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/validate.middleware.js';
import { mapController } from './map.controller.js';
import { z } from 'zod';

export const mapRoutes = Router();

// Rate limit map API calls — Nominatim policy requires max 1 req/sec,
// we allow 30/min per IP which is conservative and safe
const mapLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: {
    success: false,
    error: 'Too many map requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Zod schema for map query validation
const mapQuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters').max(200, 'Query must be at most 200 characters').trim(),
});

// Geocoding endpoint — converts address/place name to coordinates
// GET /api/map/geocode?q=Faculty+of+Computing+UTM
mapRoutes.get('/geocode', mapLimiter, validate({ query: mapQuerySchema }), mapController.geocode);

// Places search endpoint — searches for POIs near UTM campus
// GET /api/map/places?q=cafe
mapRoutes.get('/places', mapLimiter, validate({ query: mapQuerySchema }), mapController.searchPlaces);
