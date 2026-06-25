import { CursorPagination, Pagination } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/types.js';

export type DonationStatus = 'pending' | 'reviewed' | 'approved' | 'rejected';

export interface Donation {
  id: number;
  donorName: string;
  donorEmail: string;
  amount: number;
  receiptUrl: string | null;
  note: string | null;
  status: DonationStatus;
  rejectionReason: string | null;
  donorUserId: number | null;
  reviewedByUserId: number | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDonationInput {
  donorName: string;
  donorEmail: string;
  amount: number;
  receiptUrl?: string | null;
  note?: string | null;
  donorUserId?: number | null;
}

export interface UpdateDonationStatusInput {
  status: 'reviewed' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  reviewedByUserId: number;
}

export interface DonationListQuery {
  page?: number;
  pageSize?: number;
  status?: DonationStatus | '';
  donorUserId?: number;
  cursor?: string;
}

export interface DonationListResult {
  items: Donation[];
  pagination: Pagination;
}

export interface DonationCursorListResult {
  items: Donation[];
  cursorPagination: CursorPagination;
}

export interface DonationSummary {
  total: number;
  pending: number;
  reviewed: number;
  approved: number;
  rejected: number;
  totalAmount: number;
  approvedAmount: number;
}
