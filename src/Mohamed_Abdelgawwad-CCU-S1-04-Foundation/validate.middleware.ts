import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { ValidationError } from './errors.js';

type ValidationSchema = {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
};

// validates req.body, req.params, req.query against zod schemas
export const validate = (schema: ValidationSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body) as Request['body'];
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params) as Request['params'];
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query) as Request['query'];
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(new ValidationError('Validation failed', { issues: error.flatten() }));
      }
      next(error);
    }
  };
};
