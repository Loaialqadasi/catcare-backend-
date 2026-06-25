import { NotFoundError, ValidationError } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/errors.js';
import { buildPagination, parsePagination } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/utils.js';
import { catsRepository } from '../Loai_Rafaat-CCU-S1-02-Cats/cats.repository.js';
import { emergenciesRepository } from './emergencies.repository.js';
import {
  CreateEmergencyInput,
  EmergencyListQuery,
  EmergencyListResult,
  EmergencyCursorListResult,
  EmergencyReportWithCat,
  EmergencyStatus
} from './emergencies.types.js';

// only certain transitions are allowed — prevents jumping from open straight to cancelled for example
const statusTransitions: Record<EmergencyStatus, EmergencyStatus[]> = {
  open: ['in_progress', 'resolved', 'cancelled'],
  in_progress: ['open', 'resolved', 'cancelled'],
  resolved: ['open', 'in_progress', 'cancelled'],
  cancelled: []
};

// exported for testability — checks if a status transition is allowed
export const isValidStatusTransition = (from: EmergencyStatus, to: EmergencyStatus): boolean => {
  if (from === to) return true; // same status is ok (no-op)
  return statusTransitions[from]?.includes(to) ?? false;
};

export const emergenciesService = {
  async createEmergency(input: CreateEmergencyInput): Promise<EmergencyReportWithCat> {
    // if they linked a cat, make sure it actually exists
    if (input.catId) {
      const exists = await catsRepository.existsById(input.catId);
      if (!exists) {
        throw new NotFoundError('Cat not found');
      }
    }
    return emergenciesRepository.create(input);
  },

  async listEmergencies(query: EmergencyListQuery): Promise<EmergencyListResult> {
    const { page, pageSize, offset } = parsePagination(query.page, query.pageSize);
    const [items, totalItems] = await Promise.all([
      emergenciesRepository.list(query.status, query.priority, pageSize, offset),
      emergenciesRepository.count(query.status, query.priority)
    ]);
    return {
      items,
      pagination: buildPagination(page, pageSize, totalItems)
    };
  },

  async listEmergenciesCursor(query: EmergencyListQuery): Promise<EmergencyCursorListResult> {
    const { pageSize } = parsePagination(undefined, query.pageSize);
    const cursor = query.cursor ? Number(query.cursor) : undefined;
    const { items, nextCursor, hasMore } = await emergenciesRepository.listCursor(
      cursor,
      pageSize,
      query.status,
      query.priority
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

  async getEmergencyById(id: number): Promise<EmergencyReportWithCat> {
    const report = await emergenciesRepository.findById(id);
    if (!report) {
      throw new NotFoundError('Emergency report not found');
    }
    return report;
  },

  async listPriorityFeed(): Promise<EmergencyReportWithCat[]> {
    return emergenciesRepository.listPriorityFeed();
  },

  async updateStatus(id: number, status: EmergencyStatus): Promise<EmergencyReportWithCat> {
    const report = await emergenciesRepository.findById(id);
    if (!report) {
      throw new NotFoundError('Emergency report not found');
    }

    // check if this transition is actually allowed
    if (!isValidStatusTransition(report.status, status)) {
      throw new ValidationError('Invalid status transition', { from: report.status, to: status });
    }

    const updated = await emergenciesRepository.updateStatus(id, status);
    if (!updated) {
      throw new NotFoundError('Emergency report not found');
    }
    return updated;
  },

  async softDeleteEmergency(id: number): Promise<void> {
    const deleted = await emergenciesRepository.softDelete(id);
    if (!deleted) {
      throw new NotFoundError('Emergency report not found');
    }
  },

  async restoreEmergency(id: number): Promise<EmergencyReportWithCat> {
    const report = await emergenciesRepository.restore(id);
    if (!report) {
      throw new NotFoundError('Emergency report not found or not deleted');
    }
    return report;
  }
};
