// Layth Amgad — CCU-S1-01 | Auth Module
// Activity service — aggregates a user's activity across all CatCare modules
// into a single timeline + summary, used by the profile page.
//
// Activity sources:
//   • Cats registered            (cats.created_by_user_id)
//   • Care history entries       (care_history.performed_by_user_id)
//   • Emergency reports          (emergency_reports.reported_by_user_id)
//   • Donations                  (donations.donor_user_id)
//   • Volunteer applications     (volunteers.user_id)
//
// Each activity is normalized to a common UserActivity shape so the frontend
// can render a single timeline regardless of the source domain.

import { db } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/database.js';
import { DatabaseError } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/errors.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public types — serialized verbatim into the JSON response
// ─────────────────────────────────────────────────────────────────────────────

export type ActivityType =
  | 'cat_created'
  | 'care_logged'
  | 'emergency_reported'
  | 'donation_made'
  | 'volunteer_applied'
  | 'volunteer_status_changed';

export type ActivityResourceType =
  | 'cat'
  | 'care_history'
  | 'emergency'
  | 'donation'
  | 'volunteer';

export interface UserActivity {
  /** Composite ID: `${type}-${resourceId}` — unique per activity entry */
  id: string;
  type: ActivityType;
  /** Human-readable title, ready to display in the timeline */
  title: string;
  /** Short context line shown under the title */
  description: string;
  /** Current status of the underlying resource (e.g. 'approved', 'open', 'healthy') */
  status: string | null;
  /** Numeric ID of the underlying resource */
  resourceId: number;
  resourceType: ActivityResourceType;
  /** Frontend route to view the resource detail page, or null if N/A */
  href: string | null;
  /** ISO timestamp of when the activity occurred */
  createdAt: string;
}

export interface ActivitySummary {
  totalCats: number;
  totalCareActions: number;
  totalEmergencies: number;
  totalDonations: number;
  /** Sum of all donations the user made, regardless of status */
  totalDonationAmount: number;
  /** Sum of only approved donations — reflects actual contributed amount */
  approvedDonationAmount: number;
  /** Latest volunteer application status, or null if user never applied */
  volunteerStatus: string | null;
  /** Total number of activity entries returned for this user */
  totalActivities: number;
}

export interface UserActivityResponse {
  activities: UserActivity[];
  summary: ActivitySummary;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal row shapes — match what each SQL query returns
// ─────────────────────────────────────────────────────────────────────────────

interface CatActivityRow {
  id: number;
  nickname: string;
  health_status: string;
  location_name: string;
  created_at: string;
}

interface CareHistoryActivityRow {
  id: number;
  cat_id: number;
  cat_nickname: string | null;
  care_type: string;
  description: string;
  created_at: string;
}

interface EmergencyActivityRow {
  id: number;
  title: string;
  emergency_type: string;
  priority: string;
  status: string;
  location_name: string;
  cat_nickname: string | null;
  created_at: string;
}

interface DonationActivityRow {
  id: number;
  amount: string; // DECIMAL comes back as string from pg
  status: string;
  note: string | null;
  created_at: string;
}

interface VolunteerActivityRow {
  id: number;
  student_name: string;
  faculty: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/** Format an emergency priority as a readable label. */
function priorityLabel(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/** Convert snake_case to Title Case for display. */
function titleCase(s: string): string {
  return s
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-source fetchers — each returns UserActivity[] plus a count for the summary
// ─────────────────────────────────────────────────────────────────────────────

async function fetchCatActivities(userId: number): Promise<UserActivity[]> {
  try {
    const { rows } = await db.query<CatActivityRow>(
      `SELECT id, nickname, health_status, location_name, created_at
       FROM cats
       WHERE created_by_user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map((r) => ({
      id: `cat_created-${r.id}`,
      type: 'cat_created' as const,
      title: `Registered a cat: ${r.nickname}`,
      description: `Spotted near ${r.location_name} · ${titleCase(r.health_status)}`,
      status: r.health_status,
      resourceId: r.id,
      resourceType: 'cat' as const,
      href: `/cats/${r.id}`,
      createdAt: r.created_at,
    }));
  } catch (err) {
    throw new DatabaseError(`Failed to load cat activity: ${(err as Error).message}`);
  }
}

async function fetchCareHistoryActivities(userId: number): Promise<UserActivity[]> {
  try {
    const { rows } = await db.query<CareHistoryActivityRow>(
      `SELECT ch.id, ch.cat_id, ch.care_type, ch.description, ch.created_at,
              c.nickname AS cat_nickname
       FROM care_history ch
       LEFT JOIN cats c ON ch.cat_id = c.id
       WHERE ch.performed_by_user_id = $1
       ORDER BY ch.created_at DESC`,
      [userId]
    );
    return rows.map((r) => ({
      id: `care_logged-${r.id}`,
      type: 'care_logged' as const,
      title: `Logged ${titleCase(r.care_type)} care`,
      description: r.cat_nickname
        ? `For ${r.cat_nickname}${r.description ? ` — ${r.description}` : ''}`
        : r.description || 'Care entry recorded',
      status: r.care_type,
      resourceId: r.id,
      resourceType: 'care_history' as const,
      href: r.cat_id ? `/cats/${r.cat_id}` : null,
      createdAt: r.created_at,
    }));
  } catch (err) {
    throw new DatabaseError(`Failed to load care history activity: ${(err as Error).message}`);
  }
}

async function fetchEmergencyActivities(userId: number): Promise<UserActivity[]> {
  try {
    const { rows } = await db.query<EmergencyActivityRow>(
      `SELECT er.id, er.title, er.emergency_type, er.priority, er.status,
              er.location_name, er.created_at, c.nickname AS cat_nickname
       FROM emergency_reports er
       LEFT JOIN cats c ON er.cat_id = c.id
       WHERE er.reported_by_user_id = $1 AND er.deleted_at IS NULL
       ORDER BY er.created_at DESC`,
      [userId]
    );
    return rows.map((r) => ({
      id: `emergency_reported-${r.id}`,
      type: 'emergency_reported' as const,
      title: `Reported emergency: ${r.title}`,
      description: `${titleCase(r.emergency_type)} · ${priorityLabel(r.priority)} priority · ${titleCase(r.status)}${
        r.cat_nickname ? ` · Linked to ${r.cat_nickname}` : ''
      }`,
      status: r.status,
      resourceId: r.id,
      resourceType: 'emergency' as const,
      href: `/emergencies/${r.id}`,
      createdAt: r.created_at,
    }));
  } catch (err) {
    throw new DatabaseError(`Failed to load emergency activity: ${(err as Error).message}`);
  }
}

async function fetchDonationActivities(userId: number): Promise<UserActivity[]> {
  try {
    const { rows } = await db.query<DonationActivityRow>(
      `SELECT id, amount, status, note, created_at
       FROM donations
       WHERE donor_user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map((r) => ({
      id: `donation_made-${r.id}`,
      type: 'donation_made' as const,
      title: `Donated RM ${Number(r.amount).toFixed(2)}`,
      description: r.note
        ? `Status: ${titleCase(r.status)} — "${r.note}"`
        : `Status: ${titleCase(r.status)}`,
      status: r.status,
      resourceId: r.id,
      resourceType: 'donation' as const,
      href: `/donations/${r.id}`,
      createdAt: r.created_at,
    }));
  } catch (err) {
    throw new DatabaseError(`Failed to load donation activity: ${(err as Error).message}`);
  }
}

/**
 * Volunteer activities: each application emits one `volunteer_applied` entry
 * when submitted, plus an additional `volunteer_status_changed` entry when its
 * status was updated (i.e. approved or rejected) — detected by comparing
 * created_at to updated_at. Pending applications only emit the first entry.
 */
async function fetchVolunteerActivities(
  userId: number
): Promise<{ activities: UserActivity[]; latestStatus: string | null }> {
  try {
    const { rows } = await db.query<VolunteerActivityRow>(
      `SELECT id, student_name, faculty, status, created_at, updated_at
       FROM volunteers
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    if (rows.length === 0) {
      return { activities: [], latestStatus: null };
    }

    const activities: UserActivity[] = [];
    for (const r of rows) {
      // Submission event — always emitted
      activities.push({
        id: `volunteer_applied-${r.id}`,
        type: 'volunteer_applied',
        title: 'Submitted volunteer application',
        description: `Faculty: ${r.faculty}`,
        status: r.status,
        resourceId: r.id,
        resourceType: 'volunteer',
        href: '/volunteers',
        createdAt: r.created_at,
      });

      // Status change event — only if updated_at is later than created_at
      // (PostgreSQL timestamps may be equal on a fast insert; treat a strictly
      // greater updated_at as evidence of a manual status update).
      if (new Date(r.updated_at).getTime() > new Date(r.created_at).getTime()) {
        const label = r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Rejected' : titleCase(r.status);
        activities.push({
          id: `volunteer_status_changed-${r.id}`,
          type: 'volunteer_status_changed',
          title: `Volunteer application ${label.toLowerCase()}`,
          description: `Your application was ${label.toLowerCase()}.`,
          status: r.status,
          resourceId: r.id,
          resourceType: 'volunteer',
          href: '/volunteers',
          createdAt: r.updated_at,
        });
      }
    }

    return {
      activities,
      latestStatus: rows[0].status,
    };
  } catch (err) {
    throw new DatabaseError(`Failed to load volunteer activity: ${(err as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregator — runs all fetchers, merges & sorts the timeline, builds summary
// ─────────────────────────────────────────────────────────────────────────────

export const activityService = {
  async getUserActivity(userId: number): Promise<UserActivityResponse> {
    // Run all five queries in parallel — they touch independent tables.
    const [cats, care, emergencies, donations, volunteerResult] = await Promise.all([
      fetchCatActivities(userId),
      fetchCareHistoryActivities(userId),
      fetchEmergencyActivities(userId),
      fetchDonationActivities(userId),
      fetchVolunteerActivities(userId),
    ]);

    const all = [...cats, ...care, ...emergencies, ...donations, ...volunteerResult.activities];

    // Sort newest first. Stable sort preserves the per-source ordering above
    // for entries with identical timestamps.
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Summary stats — compute from the source arrays (more reliable than
    // filtering the merged timeline, because some sources emit 0..n entries
    // per underlying record, e.g. volunteer status changes).
    //
    // For donation totals we run a single SUM query because the activity
    // titles above contain formatted strings ("RM 12.50") that we'd otherwise
    // have to regex-parse — a SQL SUM is cheaper and more reliable.
    let totalDonationAmount = 0;
    let approvedDonationAmount = 0;
    try {
      const { rows } = await db.query<{ total: string; approved: string }>(
        `SELECT
           COALESCE(SUM(amount), 0)::text AS total,
           COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0)::text AS approved
         FROM donations WHERE donor_user_id = $1`,
        [userId]
      );
      totalDonationAmount = Number(rows[0]?.total ?? 0);
      approvedDonationAmount = Number(rows[0]?.approved ?? 0);
    } catch {
      // Best-effort fallback — sum the numeric amount parsed from each activity title.
      const parseAmount = (title: string): number => Number(title.match(/RM ([\d.]+)/)?.[1] ?? 0);
      totalDonationAmount = donations.reduce((sum, d) => sum + parseAmount(d.title), 0);
      approvedDonationAmount = donations
        .filter((d) => d.status === 'approved')
        .reduce((sum, d) => sum + parseAmount(d.title), 0);
    }

    const summary: ActivitySummary = {
      totalCats: cats.length,
      totalCareActions: care.length,
      totalEmergencies: emergencies.length,
      totalDonations: donations.length,
      totalDonationAmount,
      approvedDonationAmount,
      volunteerStatus: volunteerResult.latestStatus,
      totalActivities: all.length,
    };

    return { activities: all, summary };
  },
};

// PRIORITY_RANK is exported for potential future use by emergency feeds.
// Keep the reference so the constant is not tree-shaken out of the module shape.
void PRIORITY_RANK;
