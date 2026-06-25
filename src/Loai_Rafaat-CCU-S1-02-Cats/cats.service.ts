import { NotFoundError } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/errors.js';
import { buildPagination, parsePagination } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/utils.js';
import { catsRepository } from './cats.repository.js';
import { Cat, CatListQuery, CatListResult, CatCursorListResult, CreateCatInput, UpdateCatInput, CareHistoryEntry } from './cats.types.js';

export const catsService = {
  async createCat(input: CreateCatInput): Promise<Cat> {
    return catsRepository.create(input);
  },

  async listCats(query: CatListQuery): Promise<CatListResult> {
    const { page, pageSize, offset } = parsePagination(query.page, query.pageSize);
    const [items, totalItems] = await Promise.all([
      catsRepository.list(query.search, query.healthStatus, pageSize, offset),
      catsRepository.count(query.search, query.healthStatus)
    ]);
    return {
      items,
      pagination: buildPagination(page, pageSize, totalItems)
    };
  },

  async listCatsCursor(query: CatListQuery): Promise<CatCursorListResult> {
    const { pageSize } = parsePagination(undefined, query.pageSize);
    const cursor = query.cursor ? Number(query.cursor) : undefined;
    const { items, nextCursor, hasMore } = await catsRepository.listCursor(
      cursor,
      pageSize,
      query.search,
      query.healthStatus
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

  async getCatById(id: number): Promise<Cat> {
    const cat = await catsRepository.findById(id);
    if (!cat) {
      throw new NotFoundError('Cat not found');
    }
    return cat;
  },

  async getCareHistory(catId: number): Promise<CareHistoryEntry[]> {
    const cat = await catsRepository.findById(catId);
    if (!cat) {
      throw new NotFoundError('Cat not found');
    }
    return catsRepository.getCareHistory(catId);
  },

  async softDeleteCat(id: number): Promise<void> {
    const deleted = await catsRepository.softDelete(id);
    if (!deleted) {
      throw new NotFoundError('Cat not found');
    }
  },

  async restoreCat(id: number): Promise<Cat> {
    const cat = await catsRepository.restore(id);
    if (!cat) {
      throw new NotFoundError('Cat not found or not deleted');
    }
    return cat;
  },

  async updateCat(id: number, data: UpdateCatInput): Promise<Cat> {
    const cat = await catsRepository.update(id, data);
    if (!cat) {
      throw new NotFoundError('Cat not found');
    }
    return cat;
  }
};
