import { NotFoundError } from './errors.js';
import { buildPagination, parsePagination } from './utils.js';
import { volunteersRepository } from './volunteers.repository.js';
import { CreateVolunteerInput, VolunteerListQuery } from './volunteers.types.js';
import { authRepository } from '../Layth_Amgad-CCU-S1-01-Auth/auth.repository.js';
import { UserRole } from './types.js';

export const volunteersService = {
  async create(input: CreateVolunteerInput, userId: number) {
    return volunteersRepository.create(input, userId);
  },

  async list(query: VolunteerListQuery) {
    const { page, pageSize } = parsePagination(query.page, query.pageSize);
    const [items, totalItems] = await volunteersRepository.list(page, pageSize, query.status);
    return {
      items,
      pagination: buildPagination(page, pageSize, totalItems),
    };
  },

  async getMyVolunteerings(userId: number) {
    return volunteersRepository.findByUserId(userId);
  },

  async updateStatus(id: number, status: 'approved' | 'rejected') {
    const updated = await volunteersRepository.updateStatus(id, status);
    if (!updated) throw new NotFoundError('Volunteer application not found');

    // ─── Auto role upgrade on approval ───
    // When a volunteer application is approved, automatically promote the linked
    // user from `student` to `volunteer`. We intentionally only upgrade users
    // whose current role is `student` so that we never accidentally downgrade a
    // manager or admin who happened to submit a volunteer application.
    if (status === 'approved' && updated.userId !== null) {
      const user = await authRepository.findById(updated.userId);
      if (user && user.role === 'student') {
        await authRepository.updateRole(user.id, 'volunteer' as UserRole);
      }
      // If the user is already volunteer / manager / admin, leave the role as-is.
    }

    return updated;
  },
};
