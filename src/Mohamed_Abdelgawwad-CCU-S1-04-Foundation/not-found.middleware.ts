import { NextFunction, Request, Response } from 'express';
import { NotFoundError } from './errors.js';

// anything that doesn't match a route ends up here
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
};
