import { NotFoundError } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/errors.js';
import { buildPagination, parsePagination } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/utils.js';
import { donationsRepository } from './donations.repository.js';
import {
  Donation,
  CreateDonationInput,
  UpdateDonationStatusInput,
  DonationListQuery,
  DonationListResult,
  DonationCursorListResult,
  DonationSummary
} from './donations.types.js';

export const donationsService = {
  async createDonation(input: CreateDonationInput): Promise<Donation> {
    return donationsRepository.create(input);
  },

  async listDonations(query: DonationListQuery): Promise<DonationListResult> {
    const { page, pageSize, offset } = parsePagination(query.page, query.pageSize);
    const status = query.status || undefined;
    const [items, totalItems] = await Promise.all([
      donationsRepository.list(status, pageSize, offset),
      donationsRepository.count(status)
    ]);
    return {
      items,
      pagination: buildPagination(page, pageSize, totalItems)
    };
  },

  async listDonationsCursor(query: DonationListQuery): Promise<DonationCursorListResult> {
    const { pageSize } = parsePagination(undefined, query.pageSize);
    const cursor = query.cursor ? Number(query.cursor) : undefined;
    const status = query.status || undefined;
    const { items, nextCursor, hasMore } = await donationsRepository.listCursor(
      cursor,
      pageSize,
      status
    );
    return {
      items,
      cursorPagination: {
        nextCursor,
        hasMore,
        pageSize
      }
    };
  },

  async getDonationById(id: number): Promise<Donation> {
    const donation = await donationsRepository.findById(id);
    if (!donation) {
      throw new NotFoundError('Donation not found');
    }
    return donation;
  },

  async getMyDonations(donorUserId: number, page?: number, pageSize?: number): Promise<DonationListResult> {
    const { page: safePage, pageSize: safePageSize, offset } = parsePagination(page, pageSize);
    const [items, totalItems] = await Promise.all([
      donationsRepository.findByDonorUserId(donorUserId, safePageSize, offset),
      donationsRepository.countByDonorUserId(donorUserId)
    ]);
    return {
      items,
      pagination: buildPagination(safePage, safePageSize, totalItems)
    };
  },

  async updateDonationStatus(id: number, input: UpdateDonationStatusInput): Promise<Donation> {
    const donation = await donationsRepository.updateStatus(id, input);
    if (!donation) {
      throw new NotFoundError('Donation not found or already reviewed');
    }
    return donation;
  },

  async getDonationSummary(): Promise<DonationSummary> {
    return donationsRepository.getSummary();
  }
};
