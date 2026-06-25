import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/errors.js';
import { success } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/response.js';
import { volunteersService } from './volunteers.service.js';
import { CreateVolunteerInput } from './volunteers.types.js';

export const volunteersController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Missing or invalid token');
      const input = req.body as CreateVolunteerInput;
      const result = await volunteersService.create(input, req.user.id);
      success(res, result, 201);
    } catch (error) { next(error); }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as any;
      const result = await volunteersService.list({
        page: query.page ? Number(query.page) : undefined,
        pageSize: query.pageSize ? Number(query.pageSize) : undefined,
        status: query.status || undefined,
      });
      success(res, result);
    } catch (error) { next(error); }
  },

  async getMyVolunteerings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Missing or invalid token');
      const result = await volunteersService.getMyVolunteerings(req.user.id);
      success(res, result);
    } catch (error) { next(error); }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body as { status: 'approved' | 'rejected' };
      const id = Number(req.params.id);
      const result = await volunteersService.updateStatus(id, status);
      success(res, result);
    } catch (error) { next(error); }
  },
};
