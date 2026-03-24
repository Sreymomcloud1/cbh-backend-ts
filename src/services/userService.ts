// src/services/userService.ts
// User profile and notification preference operations.

import db from '../config/db';
import { revokeAllUserTokens } from '../utils/jwt';

// ─── Notification Preferences ─────────────────────────────────────────────────

export interface NotificationPreferences {
  newRequests:     boolean;
  messages:        boolean;
  platformUpdates: boolean;
  newsletter:      boolean;
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { rows } = await db.query<NotificationPreferences & { new_requests?: boolean; platform_updates?: boolean }>(
    `SELECT new_requests AS "newRequests",
            messages,
            platform_updates AS "platformUpdates",
            newsletter
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    await db.query(
      `INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [userId]
    );
    return { newRequests: true, messages: true, platformUpdates: false, newsletter: false };
  }

  return rows[0];
}

export async function updateNotificationPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const { rows } = await db.query<NotificationPreferences>(
    `INSERT INTO notification_preferences (user_id, new_requests, messages, platform_updates, newsletter)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       new_requests     = COALESCE($2, notification_preferences.new_requests),
       messages         = COALESCE($3, notification_preferences.messages),
       platform_updates = COALESCE($4, notification_preferences.platform_updates),
       newsletter       = COALESCE($5, notification_preferences.newsletter),
       updated_at       = NOW()
     RETURNING
       new_requests AS "newRequests",
       messages,
       platform_updates AS "platformUpdates",
       newsletter`,
    [
      userId,
      prefs.newRequests     ?? null,
      prefs.messages        ?? null,
      prefs.platformUpdates ?? null,
      prefs.newsletter      ?? null,
    ]
  );
  return rows[0];
}

// ─── Update user info ──────────────────────────────────────────────────────────

export interface UpdateMePayload {
  name?:    string;
  phone?:   string;
  company?: string;
  title?:   string;
}

export async function updateMe(userId: string, role: string, payload: UpdateMePayload) {
  const { rows } = await db.query(
    `UPDATE users SET
       name  = COALESCE($1, name),
       phone = COALESCE($2, phone)
     WHERE id = $3
     RETURNING id, name, email, phone, role, avatar_initials AS avatar`,
    [payload.name ?? null, payload.phone ?? null, userId]
  );

  if (role === 'customer' && (payload.company !== undefined || payload.title !== undefined)) {
    await db.query(
      `UPDATE customer_profiles SET
         company = COALESCE($1, company),
         title   = COALESCE($2, title)
       WHERE user_id = $3`,
      [payload.company ?? null, payload.title ?? null, userId]
    );
  }

  return rows[0];
}

// ─── Self-deactivate ──────────────────────────────────────────────────────────

export async function deactivateUser(userId: string): Promise<void> {
  await db.query(`UPDATE users SET is_active = FALSE WHERE id = $1`, [userId]);
  await revokeAllUserTokens(userId);
}
