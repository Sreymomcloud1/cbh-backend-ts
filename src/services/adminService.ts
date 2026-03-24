// src/services/adminService.ts
// Admin-only database operations.

import db from '../config/db';

// ─── Submissions ──────────────────────────────────────────────────────────────

export interface ListSubmissionsOptions {
  search?: string;
  status?: string;
  page:    number;
  limit:   number;
}

export async function listSubmissions(opts: ListSubmissionsOptions) {
  const { search = '', status, page, limit } = opts;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[]    = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(sp.business_name) LIKE $${params.length} OR LOWER(u.name) LIKE $${params.length})`);
  }
  if (status && status !== 'All') {
    params.push(status);
    conditions.push(`sp.verification_status = $${params.length}::verification_status`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: countRows } = await db.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM startup_profiles sp JOIN users u ON u.id = sp.user_id ${where}`,
    params
  );
  const total = parseInt(countRows[0].total, 10);

  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT
       sp.id, sp.slug,
       sp.business_name                     AS "businessName",
       u.name                               AS "ownerName",
       u.email                              AS "ownerEmail",
       u.phone,
       sp.industry::TEXT                    AS industry,
       sp.funding_stage::TEXT               AS "fundingStage",
       sp.location, sp.tagline, sp.description, sp.website,
       sp.logo_initials                     AS logo,
       sp.verification_status::TEXT         AS "verificationStatus",
       sp.verified_at                       AS "verifiedAt",
       sp.rejection_reason                  AS "rejectionReason",
       sp.created_at                        AS "registeredAt",
       COALESCE(
         (SELECT JSON_AGG(vd.original_name ORDER BY vd.uploaded_at)
          FROM verification_documents vd WHERE vd.startup_id = sp.id),
         '[]'::JSON
       ) AS documents
     FROM startup_profiles sp
     JOIN users u ON u.id = sp.user_id
     ${where}
     ORDER BY
       CASE sp.verification_status WHEN 'Pending' THEN 1 WHEN 'Approved' THEN 2 WHEN 'Rejected' THEN 3 END,
       sp.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { rows, total };
}

export async function getSubmissionById(startupId: string) {
  const { rows } = await db.query(
    `SELECT
       sp.id, sp.slug,
       sp.business_name                     AS "businessName",
       u.name                               AS "ownerName",
       u.email                              AS "ownerEmail",
       u.phone,
       sp.industry::TEXT                    AS industry,
       sp.funding_stage::TEXT               AS "fundingStage",
       sp.location, sp.tagline, sp.description, sp.website,
       sp.logo_initials                     AS logo,
       sp.plan,
       sp.verification_status::TEXT         AS "verificationStatus",
       sp.verified_at                       AS "verifiedAt",
       sp.rejection_reason                  AS "rejectionReason",
       sp.created_at                        AS "registeredAt",
       sp.founder_name                      AS "founderName",
       sp.founder_email                     AS "founderEmail",
       sp.marketing_name                    AS "marketingName",
       sp.marketing_email                   AS "marketingEmail",
       sp.sales_name                        AS "salesName",
       sp.sales_email                       AS "salesEmail",
       COALESCE(
         (SELECT JSON_AGG(
           JSON_BUILD_OBJECT(
             'id', vd.id, 'originalName', vd.original_name, 'documentType', vd.document_type,
             'publicUrl', vd.public_url, 'storagePath', vd.storage_path,
             'mimeType', vd.mime_type, 'uploadedAt', vd.uploaded_at
           ) ORDER BY vd.uploaded_at
         ) FROM verification_documents vd WHERE vd.startup_id = sp.id),
         '[]'::JSON
       ) AS documents
     FROM startup_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.id = $1`,
    [startupId]
  );
  return rows[0] ?? null;
}

export async function approveSubmission(startupId: string, adminId: string) {
  const { rows } = await db.query(
    `UPDATE startup_profiles
     SET verification_status = 'Approved',
         verified_at         = NOW(),
         verified_by         = $1,
         rejection_reason    = NULL
     WHERE id = $2
     RETURNING id, business_name AS "businessName",
               verification_status::TEXT AS "verificationStatus",
               verified_at AS "verifiedAt"`,
    [adminId, startupId]
  );
  return rows[0] ?? null;
}

export async function rejectSubmission(startupId: string, adminId: string, reason: string) {
  const { rows } = await db.query(
    `UPDATE startup_profiles
     SET verification_status = 'Rejected',
         rejection_reason    = $1,
         verified_by         = $2,
         verified_at         = NULL
     WHERE id = $3
     RETURNING id, business_name AS "businessName",
               verification_status::TEXT AS "verificationStatus",
               rejection_reason AS "rejectionReason"`,
    [reason.trim(), adminId, startupId]
  );
  return rows[0] ?? null;
}

export async function resetSubmission(startupId: string) {
  const { rows } = await db.query(
    `UPDATE startup_profiles
     SET verification_status = 'Pending',
         rejection_reason    = NULL,
         verified_at         = NULL,
         verified_by         = NULL
     WHERE id = $1
     RETURNING id, business_name AS "businessName",
               verification_status::TEXT AS "verificationStatus"`,
    [startupId]
  );
  return rows[0] ?? null;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface ListUsersOptions {
  role?:   string;
  search?: string;
  page:    number;
  limit:   number;
}

export async function listUsers(opts: ListUsersOptions) {
  const { role, search = '', page, limit } = opts;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[]    = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`);
  }
  if (role) {
    params.push(role);
    conditions.push(`u.role = $${params.length}::user_role`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: countRows } = await db.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM users u ${where}`,
    params
  );
  const total = parseInt(countRows[0].total, 10);

  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT
       u.id, u.email, u.role, u.name, u.avatar_initials AS avatar,
       u.is_active AS "isActive", u.last_login_at AS "lastLoginAt",
       u.created_at AS "createdAt",
       sp.business_name AS "startupName",
       sp.verification_status::TEXT AS "verificationStatus"
     FROM users u
     LEFT JOIN startup_profiles sp ON sp.user_id = u.id
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { rows, total };
}

export async function toggleUserActive(userId: string, active: boolean) {
  const { rows } = await db.query(
    `UPDATE users SET is_active = $1 WHERE id = $2
     RETURNING id, name, email, is_active AS "isActive"`,
    [active, userId]
  );
  return rows[0] ?? null;
}

// ─── Platform messages ────────────────────────────────────────────────────────

export async function broadcastMessage(title: string, body: string, sentBy: string) {
  const { rows } = await db.query(
    `INSERT INTO platform_messages (title, body, sent_by)
     VALUES ($1, $2, $3)
     RETURNING id, title, body, created_at`,
    [title.trim(), body.trim(), sentBy]
  );
  return rows[0];
}

// ─── Admin stats ──────────────────────────────────────────────────────────────

export async function getAdminStats() {
  const [total, pending, approved, rejected, users, requests] = await Promise.all([
    db.query<{ c: string }>(`SELECT COUNT(*) AS c FROM startup_profiles`),
    db.query<{ c: string }>(`SELECT COUNT(*) AS c FROM startup_profiles WHERE verification_status = 'Pending'`),
    db.query<{ c: string }>(`SELECT COUNT(*) AS c FROM startup_profiles WHERE verification_status = 'Approved'`),
    db.query<{ c: string }>(`SELECT COUNT(*) AS c FROM startup_profiles WHERE verification_status = 'Rejected'`),
    db.query<{ c: string }>(`SELECT COUNT(*) AS c FROM users WHERE role != 'admin'`),
    db.query<{ c: string }>(`SELECT COUNT(*) AS c FROM connection_requests`),
  ]);

  return {
    totalSubmissions: parseInt(total.rows[0].c, 10),
    pending:          parseInt(pending.rows[0].c, 10),
    approved:         parseInt(approved.rows[0].c, 10),
    rejected:         parseInt(rejected.rows[0].c, 10),
    totalUsers:       parseInt(users.rows[0].c, 10),
    totalRequests:    parseInt(requests.rows[0].c, 10),
  };
}
