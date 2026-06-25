import { db } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/database.js';
import { DatabaseError } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/errors.js';
import { escapeLike } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/utils.js';
import { Cat, CatHealthStatus, CreateCatInput, UpdateCatInput, CareHistoryEntry } from './cats.types.js';

interface CatRow {
  id: number;
  nickname: string;
  description: string | null;
  photo_url: string | null;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  health_status: CatHealthStatus;
  ownership_tag: string;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const mapCat = (row: CatRow): Cat => ({
  id: row.id,
  nickname: row.nickname,
  description: row.description,
  photoUrl: row.photo_url,
  locationName: row.location_name,
  latitude: row.latitude,
  longitude: row.longitude,
  healthStatus: row.health_status,
  ownershipTag: row.ownership_tag as Cat['ownershipTag'],
  createdByUserId: row.created_by_user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// build WHERE clause with $1, $2, ... PostgreSQL parameter placeholders
const buildWhereClause = (
  search: string | undefined,
  healthStatus: CatHealthStatus | undefined,
  params: Array<string | number>,
  includeSoftDeleteFilter = true
): string => {
  const conditions: string[] = [];
  if (includeSoftDeleteFilter) {
    conditions.push('deleted_at IS NULL');
  }
  if (healthStatus) {
    conditions.push(`health_status = $${params.length + 1}`);
    params.push(healthStatus);
  }
  if (search) {
    const like = `%${escapeLike(search)}%`;
    conditions.push(`(nickname ILIKE $${params.length + 1} OR location_name ILIKE $${params.length + 2})`);
    params.push(like, like);
  }
  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
};

export const catsRepository = {
  async create(input: CreateCatInput): Promise<Cat> {
    const { rows } = await db.query<CatRow>(
      `INSERT INTO cats (nickname, description, photo_url, location_name, latitude, longitude, health_status, ownership_tag, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, nickname, description, photo_url, location_name, latitude, longitude, health_status, ownership_tag, created_by_user_id, created_at, updated_at, deleted_at`,
      [
        input.nickname,
        input.description ?? null,
        input.photoUrl ?? null,
        input.locationName,
        input.latitude ?? null,
        input.longitude ?? null,
        input.healthStatus,
        input.ownershipTag,
        input.createdByUserId
      ]
    );
    return mapCat(rows[0]);
  },

  async findById(id: number): Promise<Cat | null> {
    const { rows } = await db.query<CatRow>(
      'SELECT id, nickname, description, photo_url, location_name, latitude, longitude, health_status, ownership_tag, created_by_user_id, created_at, updated_at, deleted_at FROM cats WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
      [id]
    );
    if (rows.length === 0) {
      return null;
    }
    return mapCat(rows[0]);
  },

  // used by emergencies module to check if a cat exists before linking
  async existsById(id: number): Promise<boolean> {
    const { rows } = await db.query('SELECT id FROM cats WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [id]);
    return rows.length > 0;
  },

  async list(search?: string, healthStatus?: CatHealthStatus, limit = 10, offset = 0): Promise<Cat[]> {
    const params: Array<string | number> = [];
    const whereClause = buildWhereClause(search, healthStatus, params);
    const query = `SELECT id, nickname, description, photo_url, location_name, latitude, longitude, health_status, ownership_tag, created_by_user_id, created_at, updated_at, deleted_at FROM cats ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const { rows } = await db.query<CatRow>(query, [...params, limit, offset]);
    return rows.map(mapCat);
  },

  async listCursor(
    cursor: number | undefined,
    limit = 10,
    search?: string,
    healthStatus?: CatHealthStatus
  ): Promise<{ items: Cat[]; nextCursor: number | null; hasMore: boolean }> {
    const params: Array<string | number> = [];
    const conditions: string[] = ['deleted_at IS NULL'];

    // cursor condition: id < $cursor for descending order pagination
    if (cursor !== undefined) {
      conditions.push(`id < $${params.length + 1}`);
      params.push(cursor);
    }
    if (healthStatus) {
      conditions.push(`health_status = $${params.length + 1}`);
      params.push(healthStatus);
    }
    if (search) {
      const like = `%${escapeLike(search)}%`;
      conditions.push(`(nickname ILIKE $${params.length + 1} OR location_name ILIKE $${params.length + 2})`);
      params.push(like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    // fetch limit + 1 to determine if there are more items
    const query = `SELECT id, nickname, description, photo_url, location_name, latitude, longitude, health_status, ownership_tag, created_by_user_id, created_at, updated_at, deleted_at FROM cats ${whereClause} ORDER BY id DESC LIMIT $${params.length + 1}`;
    const { rows } = await db.query<CatRow>(query, [...params, limit + 1]);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit).map(mapCat) : rows.map(mapCat);
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    return { items, nextCursor, hasMore };
  },

  async count(search?: string, healthStatus?: CatHealthStatus): Promise<number> {
    const params: Array<string | number> = [];
    const whereClause = buildWhereClause(search, healthStatus, params);
    const { rows } = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM cats ${whereClause}`,
      params
    );
    return Number(rows[0]?.count ?? 0);
  },

  async getCareHistory(catId: number): Promise<CareHistoryEntry[]> {
    const { rows } = await db.query<{
      id: number;
      cat_id: number;
      care_type: string;
      description: string;
      performed_by: string;
      performed_by_user_id: number | null;
      created_at: string;
    }>(
      `SELECT id, cat_id, care_type, description, performed_by, performed_by_user_id, created_at
       FROM care_history
       WHERE cat_id = $1
       ORDER BY created_at DESC`,
      [catId]
    );
    return rows.map((row) => ({
      id: row.id,
      catId: row.cat_id,
      careType: row.care_type as CareHistoryEntry['careType'],
      description: row.description,
      performedBy: row.performed_by,
      performedByUserId: row.performed_by_user_id,
      createdAt: row.created_at
    }));
  },

  // Soft delete — sets deleted_at to NOW()
  async softDelete(id: number): Promise<boolean> {
    const { rowCount } = await db.query(
      'UPDATE cats SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return (rowCount ?? 0) > 0;
  },

  // Restore a soft-deleted record
  async restore(id: number): Promise<Cat | null> {
    await db.query(
      'UPDATE cats SET deleted_at = NULL, updated_at = NOW() WHERE id = $1',
      [id]
    );
    return this.findById(id);
  },

  // Update a cat's details
  async update(id: number, data: UpdateCatInput): Promise<Cat | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.nickname !== undefined) {
      updates.push(`nickname = $${paramIndex++}`);
      values.push(data.nickname);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description ?? null);
    }
    if (data.photoUrl !== undefined) {
      updates.push(`photo_url = $${paramIndex++}`);
      values.push(data.photoUrl ?? null);
    }
    if (data.locationName !== undefined) {
      updates.push(`location_name = $${paramIndex++}`);
      values.push(data.locationName);
    }
    if (data.latitude !== undefined) {
      updates.push(`latitude = $${paramIndex++}`);
      values.push(data.latitude ?? null);
    }
    if (data.longitude !== undefined) {
      updates.push(`longitude = $${paramIndex++}`);
      values.push(data.longitude ?? null);
    }
    if (data.healthStatus !== undefined) {
      updates.push(`health_status = $${paramIndex++}`);
      values.push(data.healthStatus);
    }
    if (data.ownershipTag !== undefined) {
      updates.push(`ownership_tag = $${paramIndex++}`);
      values.push(data.ownershipTag);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await db.query<CatRow>(
      `UPDATE cats SET ${updates.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING id, nickname, description, photo_url, location_name, latitude, longitude, health_status, ownership_tag, created_by_user_id, created_at, updated_at, deleted_at`,
      values
    );
    if (rows.length === 0) return null;
    return mapCat(rows[0]);
  }
};
