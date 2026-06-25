import { db } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/database.js';
import { DonationStatus, CreateDonationInput, UpdateDonationStatusInput, Donation, DonationSummary } from './donations.types.js';

interface DonationRow {
  id: number;
  donor_name: string;
  donor_email: string;
  amount: string; // DECIMAL comes back as string from pg
  receipt_url: string | null;
  note: string | null;
  status: DonationStatus;
  rejection_reason: string | null;
  donor_user_id: number | null;
  reviewed_by_user_id: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

const mapDonation = (row: DonationRow): Donation => ({
  id: row.id,
  donorName: row.donor_name,
  donorEmail: row.donor_email,
  amount: Number(row.amount),
  receiptUrl: row.receipt_url,
  note: row.note,
  status: row.status,
  rejectionReason: row.rejection_reason,
  donorUserId: row.donor_user_id,
  reviewedByUserId: row.reviewed_by_user_id,
  reviewedAt: row.reviewed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const selectColumns = 'id, donor_name, donor_email, amount, receipt_url, note, status, rejection_reason, donor_user_id, reviewed_by_user_id, reviewed_at, created_at, updated_at';

export const donationsRepository = {
  async create(input: CreateDonationInput): Promise<Donation> {
    const { rows } = await db.query<DonationRow>(
      `INSERT INTO donations (donor_name, donor_email, amount, receipt_url, note, status, donor_user_id)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING ${selectColumns}`,
      [
        input.donorName,
        input.donorEmail,
        input.amount,
        input.receiptUrl ?? null,
        input.note ?? null,
        input.donorUserId ?? null
      ]
    );
    return mapDonation(rows[0]);
  },

  async findById(id: number): Promise<Donation | null> {
    const { rows } = await db.query<DonationRow>(
      `SELECT ${selectColumns} FROM donations WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (rows.length === 0) {
      return null;
    }
    return mapDonation(rows[0]);
  },

  async findByDonorUserId(donorUserId: number, limit: number, offset: number): Promise<Donation[]> {
    const { rows } = await db.query<DonationRow>(
      `SELECT ${selectColumns} FROM donations WHERE donor_user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [donorUserId, limit, offset]
    );
    return rows.map(mapDonation);
  },

  async countByDonorUserId(donorUserId: number): Promise<number> {
    const { rows } = await db.query<{ count: string }>(
      'SELECT COUNT(*)::text as count FROM donations WHERE donor_user_id = $1',
      [donorUserId]
    );
    return Number(rows[0]?.count ?? 0);
  },

  async list(status?: DonationStatus, limit = 10, offset = 0): Promise<Donation[]> {
    const params: Array<string | number> = [];
    const conditions: string[] = [];
    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT ${selectColumns} FROM donations ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const { rows } = await db.query<DonationRow>(query, [...params, limit, offset]);
    return rows.map(mapDonation);
  },

  async listCursor(
    cursor: number | undefined,
    limit = 10,
    status?: DonationStatus
  ): Promise<{ items: Donation[]; nextCursor: number | null; hasMore: boolean }> {
    const params: Array<string | number> = [];
    const conditions: string[] = [];

    // cursor condition: id < $cursor for descending order pagination
    if (cursor !== undefined) {
      conditions.push(`id < $${params.length + 1}`);
      params.push(cursor);
    }
    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    // fetch limit + 1 to determine if there are more items
    const query = `SELECT ${selectColumns} FROM donations ${whereClause} ORDER BY id DESC LIMIT $${params.length + 1}`;
    const { rows } = await db.query<DonationRow>(query, [...params, limit + 1]);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit).map(mapDonation) : rows.map(mapDonation);
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    return { items, nextCursor, hasMore };
  },

  async count(status?: DonationStatus): Promise<number> {
    const params: Array<string | number> = [];
    const conditions: string[] = [];
    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM donations ${whereClause}`,
      params
    );
    return Number(rows[0]?.count ?? 0);
  },

  async updateStatus(id: number, input: UpdateDonationStatusInput): Promise<Donation | null> {
    const { rows } = await db.query<DonationRow>(
      `UPDATE donations
       SET status = $1,
           rejection_reason = $2,
           reviewed_by_user_id = $3,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4 AND status IN ('pending', 'reviewed')
       RETURNING ${selectColumns}`,
      [input.status, input.status === 'rejected' ? input.rejectionReason ?? null : null, input.reviewedByUserId, id]
    );
    if (rows.length === 0) {
      return null;
    }
    return mapDonation(rows[0]);
  },

  async getSummary(): Promise<DonationSummary> {
    const { rows } = await db.query<{
      total: string;
      pending: string;
      reviewed: string;
      approved: string;
      rejected: string;
      total_amount: string;
      approved_amount: string;
    }>(
      `SELECT
         COUNT(*)::text as total,
         COUNT(CASE WHEN status = 'pending' THEN 1 END)::text as pending,
         COUNT(CASE WHEN status = 'reviewed' THEN 1 END)::text as reviewed,
         COUNT(CASE WHEN status = 'approved' THEN 1 END)::text as approved,
         COUNT(CASE WHEN status = 'rejected' THEN 1 END)::text as rejected,
         COALESCE(SUM(amount), 0)::text as total_amount,
         COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0)::text as approved_amount
       FROM donations`
    );
    const row = rows[0];
    return {
      total: Number(row.total),
      pending: Number(row.pending),
      reviewed: Number(row.reviewed),
      approved: Number(row.approved),
      rejected: Number(row.rejected),
      totalAmount: Number(row.total_amount),
      approvedAmount: Number(row.approved_amount)
    };
  }
};
