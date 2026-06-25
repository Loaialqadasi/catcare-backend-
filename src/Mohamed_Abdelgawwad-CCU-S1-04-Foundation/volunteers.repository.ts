import { db } from './database.js';
import { Volunteer, CreateVolunteerInput } from './volunteers.types.js';

interface VolunteerRow {
  id: number;
  student_name: string;
  student_id: string;
  age: number;
  faculty: string;
  interests: string;
  user_id: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const mapVolunteer = (row: VolunteerRow): Volunteer => ({
  id: row.id,
  studentName: row.student_name,
  studentId: row.student_id,
  age: row.age,
  faculty: row.faculty,
  interests: row.interests,
  userId: row.user_id,
  status: row.status as Volunteer['status'],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const volunteersRepository = {
  async create(input: CreateVolunteerInput, userId: number): Promise<Volunteer> {
    const { rows } = await db.query<VolunteerRow>(
      `INSERT INTO volunteers (student_name, student_id, age, faculty, interests, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, student_name, student_id, age, faculty, interests, user_id, status, created_at, updated_at`,
      [input.studentName, input.studentId, input.age, input.faculty, input.interests, userId]
    );
    return mapVolunteer(rows[0]);
  },

  async list(page: number, pageSize: number, status?: string): Promise<[Volunteer[], number]> {
    let where = '';
    const params: (string | number)[] = [];
    if (status) {
      where = 'WHERE status = $1';
      params.push(status);
    }
    const offset = (page - 1) * pageSize;
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM volunteers ${where}`,
      params
    );
    const totalItems = parseInt(countResult.rows[0].count, 10);
    const { rows } = await db.query<VolunteerRow>(
      `SELECT id, student_name, student_id, age, faculty, interests, user_id, status, created_at, updated_at
       FROM volunteers ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );
    return [rows.map(mapVolunteer), totalItems];
  },

  async findByUserId(userId: number): Promise<Volunteer[]> {
    const { rows } = await db.query<VolunteerRow>(
      `SELECT id, student_name, student_id, age, faculty, interests, user_id, status, created_at, updated_at
       FROM volunteers WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map(mapVolunteer);
  },

  async updateStatus(id: number, status: 'approved' | 'rejected'): Promise<Volunteer | null> {
    const { rows } = await db.query<VolunteerRow>(
      `UPDATE volunteers SET status = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, student_name, student_id, age, faculty, interests, user_id, status, created_at, updated_at`,
      [status, id]
    );
    return rows.length > 0 ? mapVolunteer(rows[0]) : null;
  },
};
