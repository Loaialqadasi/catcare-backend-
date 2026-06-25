import { CursorPagination, Pagination } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/types.js';

export type EmergencyType = 'injury' | 'sickness' | 'missing' | 'feeding_urgent' | 'danger' | 'other';
export type EmergencyPriority = 'low' | 'medium' | 'high' | 'critical';
export type EmergencyStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled';

export interface CatSummary {
  id: number;
  nickname: string;
}

export interface EmergencyReport {
  id: number;
  catId: number | null;
  title: string;
  description: string;
  emergencyType: EmergencyType;
  priority: EmergencyPriority;
  status: EmergencyStatus;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  reportedByUserId: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface EmergencyReportWithCat extends EmergencyReport {
  cat: CatSummary | null;
}

export interface CreateEmergencyInput {
  catId?: number | null;
  title: string;
  description: string;
  emergencyType: EmergencyType;
  priority: EmergencyPriority;
  locationName: string;
  latitude?: number | null;
  longitude?: number | null;
  reportedByUserId: number | null;
}

export interface UpdateEmergencyStatusInput {
  status: EmergencyStatus;
}

export interface EmergencyListQuery {
  page?: number;
  pageSize?: number;
  status?: EmergencyStatus;
  priority?: EmergencyPriority;
  cursor?: string;
}

export interface EmergencyListResult {
  items: EmergencyReportWithCat[];
  pagination: Pagination;
}

export interface EmergencyCursorListResult {
  items: EmergencyReportWithCat[];
  cursorPagination: CursorPagination;
}
