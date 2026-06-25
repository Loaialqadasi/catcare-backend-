import { Pagination } from './types.js';

// escape SQL LIKE wildcards so users can't inject patterns (PostgreSQL: escape % and _)
export const escapeLike = (value: string): string => value.replace(/[%_]/g, '\\$&');

// clamp page/pageSize to safe ranges and compute offset
export const parsePagination = (page?: number, pageSize?: number): { page: number; pageSize: number; offset: number } => {
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page as number)) : 1;
  const safePageSize = Number.isFinite(pageSize)
    ? Math.max(1, Math.min(100, Math.floor(pageSize as number)))
    : 10;
  const offset = (safePage - 1) * safePageSize;
  return { page: safePage, pageSize: safePageSize, offset };
};

// build the pagination metadata object
export const buildPagination = (page: number, pageSize: number, totalItems: number): Pagination => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return { page, pageSize, totalItems, totalPages };
};
