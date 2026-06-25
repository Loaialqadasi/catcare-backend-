export interface Volunteer {
  id: number;
  studentName: string;
  studentId: string;
  age: number;
  faculty: string;
  interests: string;
  userId: number | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface CreateVolunteerInput {
  studentName: string;
  studentId: string;
  age: number;
  faculty: string;
  interests: string;
}

export interface VolunteerListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
}
