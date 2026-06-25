import { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/errors.js';
import { success } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/response.js';
import { uploadImage } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/upload.js';
import { donationsService } from './donations.service.js';
import { CreateDonationInput, DonationListQuery } from './donations.types.js';

export const donationsController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Missing or invalid token');
      }
      const { donorName, donorEmail, amount, note, receiptUrl: bodyReceiptUrl } = req.body as CreateDonationInput;
      let receiptUrl: string | null = bodyReceiptUrl ?? null;

      // If a receipt file was uploaded, send it to Cloudinary and get the URL
      if (req.file) {
        const result = await uploadImage(req.file.buffer, 'catcare-utm/receipts');
        receiptUrl = result.url;
      }

      const donation = await donationsService.createDonation({
        donorName,
        donorEmail,
        amount,
        note,
        receiptUrl,
        donorUserId: req.user.id
      });
      success(res, donation, 201);
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as DonationListQuery;
      if (query.cursor) {
        const result = await donationsService.listDonationsCursor(query);
        success(res, result);
      } else {
        const result = await donationsService.listDonations(query);
        success(res, result);
      }
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Missing or invalid token');
      }
      const id = Number(req.params.id);
      const donation = await donationsService.getDonationById(id);
      // Authorization: only the donor or admin can view a donation
      const isAdmin = req.user.role === 'admin';
      if (!isAdmin && donation.donorUserId !== req.user.id) {
        throw new AuthorizationError('You can only view your own donations');
      }
      success(res, donation);
    } catch (error) {
      next(error);
    }
  },

  async getMyDonations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Missing or invalid token');
      }
      const page = req.query.page ? Number(req.query.page) : undefined;
      const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;
      const result = await donationsService.getMyDonations(req.user.id, page, pageSize);
      success(res, result);
    } catch (error) {
      next(error);
    }
  },

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Missing or invalid token');
      }
      if (req.user.role !== 'admin') {
        throw new AuthorizationError('Admin access required');
      }
      const id = Number(req.params.id);
      const donation = await donationsService.updateDonationStatus(id, {
        status: 'approved',
        reviewedByUserId: req.user.id
      });
      success(res, donation);
    } catch (error) {
      next(error);
    }
  },

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Missing or invalid token');
      }
      if (req.user.role !== 'admin') {
        throw new AuthorizationError('Admin access required');
      }
      const id = Number(req.params.id);
      const { rejectionReason } = req.body as { rejectionReason?: string | null };
      const donation = await donationsService.updateDonationStatus(id, {
        status: 'rejected',
        rejectionReason: rejectionReason ?? null,
        reviewedByUserId: req.user.id
      });
      success(res, donation);
    } catch (error) {
      next(error);
    }
  },

  async review(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Missing or invalid token');
      }
      if (req.user.role !== 'admin') {
        throw new AuthorizationError('Admin access required');
      }
      const id = Number(req.params.id);
      const donation = await donationsService.updateDonationStatus(id, {
        status: 'reviewed',
        reviewedByUserId: req.user.id
      });
      success(res, donation);
    } catch (error) {
      next(error);
    }
  },

  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await donationsService.getDonationSummary();
      success(res, summary);
    } catch (error) {
      next(error);
    }
  }
};
