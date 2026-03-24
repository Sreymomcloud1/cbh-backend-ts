// src/services/startupService.ts
// All startup-related database interactions.

import db from '../config/db';
import { makeInitials } from '../utils/slug';

// ─── List (public directory) ───────────────────────────────────────────────────

export interface ListStartupsOptions {
  search?:       string;
  industry?:     string;
  fundingStage?: string;
  page:          number;
  limit:         number;
}

export async function listStartups(opts: ListStartupsOptions) {
  const { search = '', industry, fundingStage, page, limit } = opts;
  const offset = (page - 1) * limit;

  // By default show both Approved and Pending (exclude Rejected)
  // When verifiedOnly=true only show Approved
  const verifiedOnly = (opts as any).verifiedOnly === true || (opts as any).verifiedOnly === 'true';
  const conditions: string[] = [
    verifiedOnly
      ? `sp.verification_status = 'Approved'`
      : `sp.verification_status IN ('Approved', 'Pending')`,
  ];
  const params: unknown[]    = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    const p = params.length;
    conditions.push(
      `(LOWER(sp.business_name) LIKE $${p} OR LOWER(sp.tagline) LIKE $${p} OR LOWER(sp.description) LIKE $${p} OR LOWER(sp.industry::TEXT) LIKE $${p})`
    );
  }
  if (industry) {
    params.push(industry);
    conditions.push(`sp.industry = $${params.length}::industry_type`);
  }
  if (fundingStage) {
    params.push(fundingStage);
    conditions.push(`sp.funding_stage = $${params.length}::funding_stage`);
  }

  const where = conditions.join(' AND ');

  const { rows: countRows } = await db.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM startup_profiles sp WHERE ${where}`,
    params
  );
  const total = parseInt(countRows[0].total, 10);

  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT
       sp.id, sp.slug,
       sp.business_name       AS name,
       sp.tagline, sp.description,
       sp.industry::TEXT      AS industry,
       sp.funding_stage::TEXT AS "fundingStage",
       sp.location,
       CASE WHEN sp.verification_status = 'Approved' THEN TRUE ELSE FALSE END AS verified,
       sp.verification_status::TEXT AS "verificationStatus",
       sp.logo_initials       AS logo,
       sp.founded_year        AS founded,
       sp.employee_range      AS employees,
       sp.website,
       COALESCE((SELECT JSON_AGG(ss.name ORDER BY ss.sort_order) FROM startup_services ss WHERE ss.startup_id = sp.id),'[]'::JSON) AS services,
       COALESCE((SELECT JSON_AGG(JSON_BUILD_OBJECT('name',stm.name,'role',stm.role,'image',stm.avatar_initials) ORDER BY stm.sort_order) FROM startup_team_members stm WHERE stm.startup_id = sp.id),'[]'::JSON) AS team
     FROM startup_profiles sp
     WHERE ${where}
     ORDER BY sp.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { rows, total };
}

// ─── Get single startup (public) ──────────────────────────────────────────────

export async function getStartupBySlugOrId(slugOrId: string) {
  const isUuid    = /^[0-9a-f-]{36}$/i.test(slugOrId);
  const condition = isUuid ? 'sp.id = $1' : 'sp.slug = $1';

  const { rows } = await db.query(
    `SELECT
       sp.id, sp.slug,
       sp.business_name       AS name,
       sp.tagline, sp.description,
       sp.industry::TEXT      AS industry,
       sp.funding_stage::TEXT AS "fundingStage",
       sp.location,
       CASE WHEN sp.verification_status = 'Approved' THEN TRUE ELSE FALSE END AS verified,
       sp.logo_initials       AS logo,
       sp.founded_year        AS founded,
       sp.employee_range      AS employees,
       sp.website,
       sp.verification_status::TEXT AS "verificationStatus",
       COALESCE((SELECT JSON_AGG(ss.name ORDER BY ss.sort_order) FROM startup_services ss WHERE ss.startup_id = sp.id),'[]'::JSON) AS services,
       COALESCE((SELECT JSON_AGG(JSON_BUILD_OBJECT('name',stm.name,'role',stm.role,'image',stm.avatar_initials) ORDER BY stm.sort_order) FROM startup_team_members stm WHERE stm.startup_id = sp.id),'[]'::JSON) AS team
     FROM startup_profiles sp JOIN users u ON u.id = sp.user_id
     WHERE ${condition} AND u.is_active = TRUE`,
    [slugOrId]
  );

  return rows[0] ?? null;
}

// ─── Get own profile (authenticated startup owner) ────────────────────────────

export async function getMyProfile(userId: string) {
  const { rows } = await db.query(
    `SELECT
       sp.id, sp.slug,
       sp.business_name          AS name,
       sp.tagline, sp.description,
       sp.industry::TEXT         AS industry,
       sp.funding_stage::TEXT    AS "fundingStage",
       sp.location, sp.website,
       sp.founded_year           AS founded,
       sp.employee_range         AS employees,
       sp.logo_initials          AS logo,
       sp.plan,
       sp.verification_status::TEXT AS "verificationStatus",
       sp.verified_at            AS "verifiedAt",
       sp.rejection_reason       AS "rejectionReason",
       sp.founder_name           AS "founderName",
       sp.founder_email          AS "founderEmail",
       sp.marketing_name         AS "marketingName",
       sp.marketing_email        AS "marketingEmail",
       sp.sales_name             AS "salesName",
       sp.sales_email            AS "salesEmail",
       CASE WHEN sp.verification_status = 'Approved' THEN TRUE ELSE FALSE END AS verified,
       COALESCE(
         (SELECT JSON_AGG(JSON_BUILD_OBJECT('id',ss.id::TEXT,'name',ss.name) ORDER BY ss.sort_order)
          FROM startup_services ss WHERE ss.startup_id = sp.id),
         '[]'::JSON
       ) AS services,
       COALESCE(
         (SELECT JSON_AGG(JSON_BUILD_OBJECT('id',stm.id::TEXT,'name',stm.name,'role',stm.role,'image',stm.avatar_initials) ORDER BY stm.sort_order)
          FROM startup_team_members stm WHERE stm.startup_id = sp.id),
         '[]'::JSON
       ) AS team,
       COALESCE(
         (SELECT JSON_AGG(JSON_BUILD_OBJECT('id',vd.id::TEXT,'originalName',vd.original_name,'documentType',vd.document_type,'publicUrl',vd.public_url,'uploadedAt',vd.uploaded_at) ORDER BY vd.uploaded_at)
          FROM verification_documents vd WHERE vd.startup_id = sp.id),
         '[]'::JSON
       ) AS documents
     FROM startup_profiles sp WHERE sp.user_id = $1`,
    [userId]
  );

  return rows[0] ?? null;
}

// ─── Update profile ────────────────────────────────────────────────────────────

export interface UpdateProfilePayload {
  tagline?:       string;
  description?:   string;
  location?:      string;
  website?:       string;
  industry?:      string;
  fundingStage?:  string;
  foundedYear?:   string;
  employeeRange?: string;
}

export async function updateProfile(startupId: string, payload: UpdateProfilePayload) {
  const { rows } = await db.query(
    `UPDATE startup_profiles SET
       tagline        = COALESCE($1, tagline),
       description    = COALESCE($2, description),
       location       = COALESCE($3, location),
       website        = COALESCE($4, website),
       industry       = COALESCE($5::industry_type, industry),
       funding_stage  = COALESCE($6::funding_stage, funding_stage),
       founded_year   = COALESCE($7, founded_year),
       employee_range = COALESCE($8, employee_range)
     WHERE id = $9
     RETURNING id, slug, business_name AS name, tagline, description,
               industry::TEXT AS industry, funding_stage::TEXT AS "fundingStage",
               location, website`,
    [
      payload.tagline       ?? null,
      payload.description   ?? null,
      payload.location      ?? null,
      payload.website       ?? null,
      payload.industry      ?? null,
      payload.fundingStage  ?? null,
      payload.foundedYear   ?? null,
      payload.employeeRange ?? null,
      startupId,
    ]
  );
  return rows[0] ?? null;
}

// ─── Services ──────────────────────────────────────────────────────────────────

export async function addService(startupId: string, name: string) {
  const { rows } = await db.query(
    `INSERT INTO startup_services (startup_id, name, sort_order)
     VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order),0)+1 FROM startup_services WHERE startup_id=$1))
     RETURNING id::TEXT, name, sort_order`,
    [startupId, name.trim()]
  );
  return rows[0];
}

export async function removeService(startupId: string, serviceId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    'DELETE FROM startup_services WHERE id = $1 AND startup_id = $2',
    [serviceId, startupId]
  );
  return (rowCount ?? 0) > 0;
}

// ─── Team Members ──────────────────────────────────────────────────────────────

export async function addTeamMember(startupId: string, name: string, role: string) {
  const { rows } = await db.query(
    `INSERT INTO startup_team_members (startup_id, name, role, avatar_initials, sort_order)
     VALUES ($1,$2,$3,$4,(SELECT COALESCE(MAX(sort_order),0)+1 FROM startup_team_members WHERE startup_id=$1))
     RETURNING id::TEXT, name, role, avatar_initials AS image`,
    [startupId, name.trim(), role.trim(), makeInitials(name)]
  );
  return rows[0];
}

export async function removeTeamMember(startupId: string, memberId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    'DELETE FROM startup_team_members WHERE id = $1 AND startup_id = $2',
    [memberId, startupId]
  );
  return (rowCount ?? 0) > 0;
}

// ─── Analytics ─────────────────────────────────────────────────────────────────

export async function getAnalytics(startupId: string) {
  const [purposeRows, statusRows, monthRows, totalRows] = await Promise.all([
    db.query<{ purpose: string; count: number }>(
      `SELECT purpose::TEXT, COUNT(*)::INT AS count FROM connection_requests WHERE startup_id=$1 GROUP BY purpose`,
      [startupId]
    ),
    db.query<{ status: string; count: number }>(
      `SELECT status::TEXT, COUNT(*)::INT AS count FROM connection_requests WHERE startup_id=$1 GROUP BY status`,
      [startupId]
    ),
    db.query<{ c: number }>(
      `SELECT COUNT(*)::INT AS c FROM connection_requests WHERE startup_id=$1 AND created_at >= DATE_TRUNC('month',NOW())`,
      [startupId]
    ),
    db.query<{ c: number }>(
      `SELECT COUNT(*)::INT AS c FROM connection_requests WHERE startup_id=$1`,
      [startupId]
    ),
  ]);

  const purposeMap: Record<string, number> = { Collaborate: 0, Invest: 0, 'Become Customer': 0 };
  purposeRows.rows.forEach(({ purpose, count }) => { purposeMap[purpose] = count; });

  const statusMap: Record<string, number> = { New: 0, Reviewed: 0, Responded: 0, Declined: 0 };
  statusRows.rows.forEach(({ status, count }) => { statusMap[status] = count; });

  const total     = totalRows.rows[0].c;
  const responded = statusMap['Responded'] ?? 0;

  return {
    requestsByPurpose: purposeMap,
    requestsByStatus:  statusMap,
    thisMonth:         monthRows.rows[0].c,
    responseRate:      total > 0 ? Math.round((responded / total) * 100) : 0,
    totalRequests:     total,
  };
}
