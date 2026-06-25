import { z } from 'zod';

export const donationStatusEnum = z.enum(['pending', 'reviewed', 'approved', 'rejected']);
export const updateableDonationStatusEnum = z.enum(['reviewed', 'approved', 'rejected']);

export const createDonationSchema = z.object({
  donorName: z.string().min(2).max(120).trim(),
  donorEmail: z.string().email().max(160).trim(),
  // MED-7 Fix: Stricter amount validation — coerce handles FormData string values
  amount: z.coerce.number()
    .positive('Amount must be greater than 0')
    .max(1_000_000, 'Amount cannot exceed RM 1,000,000'),
  note: z.string().max(500).optional().nullable(),
  // Receipt URL from Cloudinary upload or manual entry
  receiptUrl: z.string().max(500).optional().nullable(),
  // The 'receipt' key may appear in req.body from FormData — strip it (file handled by multer)
  receipt: z.any().optional(),
});

export const updateDonationStatusSchema = z
  .object({
    status: updateableDonationStatusEnum,
    rejectionReason: z.string().min(3).max(500).optional().nullable()
  })
  .refine(
    (data) => {
      if (data.status === 'rejected') {
        return typeof data.rejectionReason === 'string' && data.rejectionReason.trim().length > 0;
      }
      return true;
    },
    {
      message: 'rejectionReason is required when status is rejected',
      path: ['rejectionReason']
    }
  );

export const listDonationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: donationStatusEnum.optional(),
  cursor: z.string().min(1).max(100).optional()
});

export const donationIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});
