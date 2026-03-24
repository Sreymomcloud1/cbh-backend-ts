// src/services/connectionService.ts
// All connection-request related database interactions.

import db from '../config/db';
import { UserRole, MessageTab } from '../types';

// ─── Send a request ───────────────────────────────────────────────────────────

export interface SendRequestPayload {
  senderId:      string;
  startupId:     string;
  senderFullName: string;
  senderCompany:  string;
  senderRole:     string;
  senderEmail:    string;
  senderPhone?:   string | null;
  budgetRange?:   string | null;
  purpose:        string;
  message:        string;
}

export async function sendRequest(payload: SendRequestPayload) {
  // Validate target startup exists and is approved
  const { rows: startupRows } = await db.query<{ id: string }>(
    `SELECT id FROM startup_profiles WHERE id = $1 AND verification_status = 'Approved'`,
    [payload.startupId]
  );
  if (startupRows.length === 0) {
    throw Object.assign(new Error('Startup not found or not yet verified.'), { statusCode: 404 });
  }

  // Prevent self-request
  const { rows: ownerRows } = await db.query<{ user_id: string }>(
    'SELECT user_id FROM startup_profiles WHERE id = $1',
    [payload.startupId]
  );
  if (ownerRows[0]?.user_id === payload.senderId) {
    throw Object.assign(new Error('You cannot send a connection request to your own startup.'), { statusCode: 400 });
  }

  const subjectMap: Record<string, string> = {
    Collaborate:      `Collaboration Opportunity — ${payload.senderCompany || payload.senderFullName}`,
    Invest:           `Investment Interest from ${payload.senderCompany || payload.senderFullName}`,
    'Become Customer': `Customer Inquiry — ${payload.senderCompany || payload.senderFullName}`,
  };
  const subject = subjectMap[payload.purpose] ?? `Connection Request from ${payload.senderFullName}`;

  const { rows } = await db.query(
    `INSERT INTO connection_requests
       (sender_id, startup_id, sender_full_name, sender_company, sender_role, sender_email,
        sender_phone, budget_range, purpose, message, subject)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, purpose::TEXT, status::TEXT, subject, created_at`,
    [
      payload.senderId, payload.startupId, payload.senderFullName,
      payload.senderCompany, payload.senderRole, payload.senderEmail,
      payload.senderPhone ?? null, payload.budgetRange ?? null,
      payload.purpose, payload.message, subject,
    ]
  );

  return rows[0];
}

// ─── Get inbox ────────────────────────────────────────────────────────────────

export interface GetInboxOptions {
  userId:   string;
  userName: string;
  role:     UserRole;
  tab:      MessageTab;
  page:     number;
  limit:    number;
}

export async function getInbox(opts: GetInboxOptions) {
  const { userId, userName, role, tab, page, limit } = opts;
  const offset = (page - 1) * limit;

  let requestRows: unknown[]  = [];
  let requestTotal             = 0;
  let platformRows: unknown[] = [];

  // ── Connection request messages ──────────────────────────────────────────
  if (tab !== 'updates') {
    let whereClause: string;
    let whereParams: unknown[];

    if (role === 'admin') {
      whereClause = 'TRUE';
      whereParams = [];
    } else if (role === 'startup') {
      whereClause = tab === 'sent' ? 'FALSE' : 'sp.user_id = $1';
      whereParams = tab === 'sent' ? [] : [userId];
    } else {
      // customer
      whereClause = tab === 'received' ? 'FALSE' : 'cr.sender_id = $1';
      whereParams = tab === 'received' ? [] : [userId];
    }

    if (whereClause !== 'FALSE') {
      const { rows: countRows } = await db.query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM connection_requests cr
         JOIN startup_profiles sp ON sp.id = cr.startup_id
         WHERE ${whereClause}`,
        whereParams
      );
      requestTotal = parseInt(countRows[0].total, 10);

      const allParams = [...whereParams, userId, limit, offset];
      const userIdx   = whereParams.length + 1;
      const limitIdx  = allParams.length - 1;
      const offsetIdx = allParams.length;

      const result = await db.query(
        `SELECT
           cr.id,
           CASE WHEN cr.sender_id = $${userIdx} THEN 'sent' ELSE 'received' END AS type,
           JSON_BUILD_OBJECT(
             'name',    cr.sender_full_name,
             'company', cr.sender_company,
             'avatar',  UPPER(LEFT(cr.sender_full_name,1)) || UPPER(LEFT(SPLIT_PART(cr.sender_full_name,' ',2),1))
           ) AS "from",
           JSON_BUILD_OBJECT(
             'name',    sp.business_name,
             'company', sp.business_name,
             'avatar',  sp.logo_initials
           ) AS "to",
           cr.purpose::TEXT AS purpose,
           cr.status::TEXT  AS status,
           cr.created_at::DATE::TEXT AS date,
           cr.subject, cr.message,
           cr.startup_reply  AS "startupReply",
           cr.replied_at     AS "repliedAt",
           cr.budget_range   AS "budgetRange",
           cr.sender_email   AS "senderEmail",
           cr.sender_phone   AS "senderPhone",
           cr.sender_role    AS "senderRole"
         FROM connection_requests cr
         JOIN startup_profiles sp ON sp.id = cr.startup_id
         WHERE ${whereClause}
         ORDER BY cr.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        allParams
      );
      requestRows = result.rows;
    }
  }

  // ── Platform messages ─────────────────────────────────────────────────────
  if (tab === 'all' || tab === 'updates') {
    const { rows } = await db.query(
      `SELECT
         pm.id, 'update' AS type,
         JSON_BUILD_OBJECT('name','CBH Platform','company','Cambodia Business Hub','avatar','CB') AS "from",
         JSON_BUILD_OBJECT('name',$1,'company','','avatar','US') AS "to",
         'Platform Update' AS purpose, 'New' AS status,
         pm.created_at::DATE::TEXT AS date,
         pm.title AS subject, pm.body AS message
       FROM platform_messages pm WHERE pm.is_active = TRUE
       ORDER BY pm.created_at DESC`,
      [userName]
    );
    platformRows = rows;
  }

  const allMessages = [...requestRows, ...platformRows].sort(
    (a: unknown, b: unknown) => {
      const aDate = new Date((a as { date: string }).date).getTime();
      const bDate = new Date((b as { date: string }).date).getTime();
      return bDate - aDate;
    }
  );

  const total = requestTotal + platformRows.length;
  return { rows: allMessages, total };
}

// ─── Get single request ────────────────────────────────────────────────────────

export async function getRequestById(requestId: string) {
  const { rows } = await db.query(
    `SELECT
       cr.id, cr.sender_full_name AS "senderFullName", cr.sender_company AS "senderCompany",
       cr.sender_role AS "senderRole", cr.sender_email AS "senderEmail", cr.sender_phone AS "senderPhone",
       cr.purpose::TEXT AS purpose, cr.message, cr.subject, cr.status::TEXT AS status,
       cr.budget_range AS "budgetRange", cr.startup_reply AS "startupReply", cr.replied_at AS "repliedAt",
       cr.created_at,
       sp.id AS "startupId", sp.slug AS "startupSlug", sp.business_name AS "startupName",
       sp.logo_initials AS "startupLogo", sp.user_id AS "startupOwnerId",
       u.id AS "senderId"
     FROM connection_requests cr
     JOIN startup_profiles sp ON sp.id = cr.startup_id
     JOIN users u ON u.id = cr.sender_id
     WHERE cr.id = $1`,
    [requestId]
  );
  return rows[0] ?? null;
}

// ─── Update status ─────────────────────────────────────────────────────────────

export async function updateRequestStatus(requestId: string, userId: string, userRole: UserRole, status: string) {
  const { rows: ownership } = await db.query<{ id: string }>(
    `SELECT cr.id FROM connection_requests cr
     JOIN startup_profiles sp ON sp.id = cr.startup_id
     WHERE cr.id = $1 AND (sp.user_id = $2 OR $3 = 'admin')`,
    [requestId, userId, userRole]
  );
  if (ownership.length === 0) {
    throw Object.assign(new Error('Request not found or access denied.'), { statusCode: 403 });
  }

  const { rows } = await db.query(
    `UPDATE connection_requests SET status = $1::request_status WHERE id = $2
     RETURNING id, status::TEXT AS status`,
    [status, requestId]
  );
  return rows[0];
}

// ─── Reply to request ─────────────────────────────────────────────────────────

export async function replyToRequest(requestId: string, userId: string, userRole: UserRole, message: string) {
  const { rows: ownership } = await db.query<{ id: string }>(
    `SELECT cr.id FROM connection_requests cr
     JOIN startup_profiles sp ON sp.id = cr.startup_id
     WHERE cr.id = $1 AND (sp.user_id = $2 OR $3 = 'admin')`,
    [requestId, userId, userRole]
  );
  if (ownership.length === 0) {
    throw Object.assign(new Error('Request not found or access denied.'), { statusCode: 403 });
  }

  const { rows } = await db.query(
    `UPDATE connection_requests
     SET startup_reply = $1, replied_at = NOW(), status = 'Responded'::request_status
     WHERE id = $2
     RETURNING id, startup_reply AS "startupReply", replied_at AS "repliedAt", status::TEXT`,
    [message.trim(), requestId]
  );
  return rows[0];
}

// ─── Withdraw request ─────────────────────────────────────────────────────────

export async function withdrawRequest(requestId: string, senderId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM connection_requests WHERE id = $1 AND sender_id = $2 AND status = 'New'`,
    [requestId, senderId]
  );
  return (rowCount ?? 0) > 0;
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export async function getStartupStats(userId: string) {
  const { rows: spRows } = await db.query<{ id: string }>(
    'SELECT id FROM startup_profiles WHERE user_id = $1',
    [userId]
  );
  if (spRows.length === 0) {
    return { profileViews: 0, newRequests: 0, thisMonth: 0, responseRate: 0 };
  }
  const startupId = spRows[0].id;

  const [newReqs, monthReqs, respondedReqs, totalReqs] = await Promise.all([
    db.query<{ c: number }>(`SELECT COUNT(*)::INT AS c FROM connection_requests WHERE startup_id=$1 AND status='New'`, [startupId]),
    db.query<{ c: number }>(`SELECT COUNT(*)::INT AS c FROM connection_requests WHERE startup_id=$1 AND created_at >= DATE_TRUNC('month',NOW())`, [startupId]),
    db.query<{ c: number }>(`SELECT COUNT(*)::INT AS c FROM connection_requests WHERE startup_id=$1 AND status='Responded'`, [startupId]),
    db.query<{ c: number }>(`SELECT COUNT(*)::INT AS c FROM connection_requests WHERE startup_id=$1`, [startupId]),
  ]);

  const total     = totalReqs.rows[0].c;
  const responded = respondedReqs.rows[0].c;

  return {
    profileViews: 0,
    newRequests:  newReqs.rows[0].c,
    thisMonth:    monthReqs.rows[0].c,
    responseRate: total > 0 ? Math.round((responded / total) * 100) : 0,
  };
}

export async function getCustomerStats(userId: string) {
  const [sent, responded, newMsgs] = await Promise.all([
    db.query<{ c: number }>(`SELECT COUNT(*)::INT AS c FROM connection_requests WHERE sender_id=$1`, [userId]),
    db.query<{ c: number }>(`SELECT COUNT(*)::INT AS c FROM connection_requests WHERE sender_id=$1 AND status='Responded'`, [userId]),
    db.query<{ c: number }>(`SELECT COUNT(*)::INT AS c FROM connection_requests WHERE sender_id=$1 AND status='New'`, [userId]),
  ]);
  return {
    requestsSent:      sent.rows[0].c,
    responsesReceived: responded.rows[0].c,
    newNotifications:  newMsgs.rows[0].c,
  };
}
