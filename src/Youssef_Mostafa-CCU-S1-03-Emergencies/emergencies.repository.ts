import { db } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/database.js';
import { DatabaseError } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/errors.js';
import {
  EmergencyReport,
  EmergencyReportWithCat,
  EmergencyPriority,
  EmergencyStatus,
  EmergencyType,
  CreateEmergencyInput
} from './emergencies.types.js';

interface EmergencyRow {
  id: number;
  cat_id: number | null;
  title: string;
  description: string;
  emergency_type: EmergencyType;
  priority: EmergencyPriority;
  status: EmergencyStatus;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  reported_by_user_id: number | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  cat_nickname?: string | null;
  deleted_at: string | null;
}

const mapEmergency = (row: EmergencyRow): EmergencyReport => ({
  id: row.id,
  catId: row.cat_id,
  title: row.title,
  description: row.description,
  emergencyType: row.emergency_type,
  priority: row.priority,
  status: row.status,
  locationName: row.location_name,
  latitude: row.latitude,
  longitude: row.longitude,
  reportedByUserId: row.reported_by_user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  resolvedAt: row.resolved_at
});

// when we join with cats, attach the cat nickname if it exists
const mapEmergencyWithCat = (row: EmergencyRow): EmergencyReportWithCat => ({
  ...mapEmergency(row),
  cat: row.cat_id && row.cat_nickname ? { id: row.cat_id, nickname: row.cat_nickname } : null
});

// base query with LEFT JOIN so we always get the cat name if there is one
const baseSelect =
  'SELECT er.id, er.cat_id, er.title, er.description, er.emergency_type, er.priority, er.status, er.location_name, er.latitude, er.longitude, er.reported_by_user_id, er.created_at, er.updated_at, er.resolved_at, er.deleted_at, c.nickname as cat_nickname FROM emergency_reports er LEFT JOIN cats c ON er.cat_id = c.id';

export const emergenciesRepository = {
  async create(input: CreateEmergencyInput): Promise<EmergencyReportWithCat> {
    const { rows } = await db.query<EmergencyRow>(
      `INSERT INTO emergency_reports (cat_id, title, description, emergency_type, priority, status, location_name, latitude, longitude, reported_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, cat_id, title, description, emergency_type, priority, status, location_name, latitude, longitude, reported_by_user_id, created_at, updated_at, resolved_at, deleted_at`,
      [
        input.catId ?? null,
        input.title,
        input.description,
        input.emergencyType,
        input.priority,
        'open',
        input.locationName,
        input.latitude ?? null,
        input.longitude ?? null,
        input.reportedByUserId
      ]
    );
    const created = await this.findById(rows[0].id);
    if (!created) {
      throw new DatabaseError('Failed to load created emergency report');
    }
    return created;
  },

  async findById(id: number): Promise<EmergencyReportWithCat | null> {
    const { rows } = await db.query<EmergencyRow>(`${baseSelect} WHERE er.id = $1 AND er.deleted_at IS NULL LIMIT 1`, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapEmergencyWithCat(rows[0]);
  },

  async list(
    status?: EmergencyStatus,
    priority?: EmergencyPriority,
    limit = 10,
    offset = 0
  ): Promise<EmergencyReportWithCat[]> {
    const params: Array<string | number> = [];
    const conditions: string[] = ['er.deleted_at IS NULL'];
    if (status) {
      conditions.push(`er.status = $${params.length + 1}`);
      params.push(status);
    }
    if (priority) {
      conditions.push(`er.priority = $${params.length + 1}`);
      params.push(priority);
    }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const query = `${baseSelect} ${whereClause} ORDER BY er.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const { rows } = await db.query<EmergencyRow>(query, [...params, limit, offset]);
    return rows.map(mapEmergencyWithCat);
  },

  async listCursor(
    cursor: number | undefined,
    limit = 10,
    status?: EmergencyStatus,
    priority?: EmergencyPriority
  ): Promise<{ items: EmergencyReportWithCat[]; nextCursor: number | null; hasMore: boolean }> {
    const params: Array<string | number> = [];
    const conditions: string[] = ['er.deleted_at IS NULL'];

    // cursor condition: er.id < $cursor for descending order pagination
    if (cursor !== undefined) {
      conditions.push(`er.id < $${params.length + 1}`);
      params.push(cursor);
    }
    if (status) {
      conditions.push(`er.status = $${params.length + 1}`);
      params.push(status);
    }
    if (priority) {
      conditions.push(`er.priority = $${params.length + 1}`);
      params.push(priority);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    // fetch limit + 1 to determine if there are more items
    const query = `${baseSelect} ${whereClause} ORDER BY er.id DESC LIMIT $${params.length + 1}`;
    const { rows } = await db.query<EmergencyRow>(query, [...params, limit + 1]);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit).map(mapEmergencyWithCat) : rows.map(mapEmergencyWithCat);
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    return { items, nextCursor, hasMore };
  },

  async count(status?: EmergencyStatus, priority?: EmergencyPriority): Promise<number> {
    const params: Array<string | number> = [];
    const conditions: string[] = ['deleted_at IS NULL'];
    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }
    if (priority) {
      conditions.push(`priority = $${params.length + 1}`);
      params.push(priority);
    }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const { rows } = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM emergency_reports ${whereClause}`,
      params
    );
    return Number(rows[0]?.count ?? 0);
  },

  // show only active emergencies, sorted critical -> high -> medium -> low
  // PostgreSQL uses CASE WHEN instead of MySQL FIELD()
  async listPriorityFeed(): Promise<EmergencyReportWithCat[]> {
    const query = `${baseSelect} WHERE er.status IN ('open', 'in_progress') AND er.deleted_at IS NULL
      ORDER BY CASE er.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END, er.created_at DESC, er.id DESC`;
    const { rows } = await db.query<EmergencyRow>(query);
    return rows.map(mapEmergencyWithCat);
  },

  // let the DB handle resolved_at timestamp to avoid timezone issues
  async updateStatus(id: number, status: EmergencyStatus): Promise<EmergencyReportWithCat | null> {
    await db.query(
      `UPDATE emergency_reports
       SET status = $1,
           resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL`,
      [status, status, id]
    );
    return this.findById(id);
  },

  // Soft delete — sets deleted_at to NOW()
  async softDelete(id: number): Promise<boolean> {
    const { rowCount } = await db.query(
      'UPDATE emergency_reports SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return (rowCount ?? 0) > 0;
  },

  // Restore a soft-deleted record
  async restore(id: number): Promise<EmergencyReportWithCat | null> {
    await db.query(
      'UPDATE emergency_reports SET deleted_at = NULL, updated_at = NOW() WHERE id = $1',
      [id]
    );
    return this.findById(id);
  }
};
