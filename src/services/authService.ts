// src/services/authService.ts
// All authentication business logic: registration, login, token management.

import bcrypt    from 'bcrypt';
import db        from '../config/db';
import * as jwtUtils from '../utils/jwt';
import { generateUniqueSlug, makeInitials } from '../utils/slug';
import { UserRole } from '../types';

const SALT_ROUNDS = 10;

// ─── Types returned by service functions ──────────────────────────────────────

export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
}

export interface RegisteredUser {
  id:          string;
  email:       string;
  role:        UserRole;
  name:        string;
  avatar:      string;
  phone?:      string | null;
  company?:    string | null;
  title?:      string | null;
  startupId?:  string;
  startupSlug?: string;
  verificationStatus?: string;
}

export interface StartupRegistrationPayload {
  businessName:   string;
  tagline?:       string;
  industry:       string;
  fundingStage:   string;
  description?:   string;
  location?:      string;
  website?:       string;
  founderName?:   string;
  founderEmail?:  string;
  marketingName?: string;
  marketingEmail?: string;
  salesName?:     string;
  salesEmail?:    string;
  accountEmail:   string;
  password:       string;
  plan?:          string;
  foundedYear?:   string | null;
  employeeRange?: string | null;
}

export interface CustomerRegistrationPayload {
  name:     string;
  email:    string;
  password: string;
  phone?:   string | null;
  company?: string | null;
  title?:   string | null;
}

// ─── Startup Registration ─────────────────────────────────────────────────────

export async function registerStartup(payload: StartupRegistrationPayload): Promise<{
  tokens: AuthTokens;
  user:   RegisteredUser;
}> {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const emailLower = payload.accountEmail.toLowerCase();

    const { rows: existing } = await client.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [emailLower]
    );
    if (existing.length > 0) {
      throw Object.assign(new Error('An account with this email already exists.'), { statusCode: 409 });
    }

    const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS);
    const slug         = await generateUniqueSlug(payload.businessName);
    const logoInitials = makeInitials(payload.businessName);

    const { rows: userRows } = await client.query<{
      id: string; email: string; role: UserRole; name: string; avatar_initials: string;
    }>(
      `INSERT INTO users (email, password_hash, role, name, phone)
       VALUES ($1, $2, 'startup', $3, $4)
       RETURNING id, email, role, name, avatar_initials`,
      [emailLower, passwordHash, payload.founderName || payload.businessName, null]
    );
    const user = userRows[0];

    const { rows: profileRows } = await client.query<{ id: string; slug: string }>(
      `INSERT INTO startup_profiles (
         user_id, slug, business_name, tagline, description,
         logo_initials, industry, funding_stage, plan,
         location, website, founded_year, employee_range,
         founder_name, founder_email,
         marketing_name, marketing_email,
         sales_name, sales_email
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING id, slug`,
      [
        user.id, slug, payload.businessName,
        payload.tagline     ?? '',
        payload.description ?? '',
        logoInitials,
        payload.industry, payload.fundingStage,
        payload.plan        ?? 'free',
        payload.location    ?? '',
        payload.website     ?? '',
        payload.foundedYear   ?? null,
        payload.employeeRange ?? null,
        payload.founderName   ?? null,
        payload.founderEmail  ?? null,
        payload.marketingName  ?? null,
        payload.marketingEmail ?? null,
        payload.salesName      ?? null,
        payload.salesEmail     ?? null,
      ]
    );
    const profile = profileRows[0];

    await client.query(
      `INSERT INTO notification_preferences (user_id) VALUES ($1)`,
      [user.id]
    );

    await client.query('COMMIT');

    const accessToken  = jwtUtils.signAccessToken(user);
    const refreshToken = await jwtUtils.signRefreshToken(user.id);

    return {
      tokens: { accessToken, refreshToken },
      user: {
        id:          user.id,
        email:       user.email,
        role:        user.role,
        name:        user.name,
        avatar:      user.avatar_initials,
        startupId:   profile.id,
        startupSlug: profile.slug,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Customer Registration ─────────────────────────────────────────────────────

export async function registerCustomer(payload: CustomerRegistrationPayload): Promise<{
  tokens: AuthTokens;
  user:   RegisteredUser;
}> {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const emailLower = payload.email.toLowerCase();

    const { rows: existing } = await client.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [emailLower]
    );
    if (existing.length > 0) {
      throw Object.assign(new Error('An account with this email already exists.'), { statusCode: 409 });
    }

    const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS);

    const { rows: userRows } = await client.query<{
      id: string; email: string; role: UserRole; name: string; avatar_initials: string;
    }>(
      `INSERT INTO users (email, password_hash, role, name, phone)
       VALUES ($1, $2, 'customer', $3, $4)
       RETURNING id, email, role, name, avatar_initials`,
      [emailLower, passwordHash, payload.name, payload.phone ?? null]
    );
    const user = userRows[0];

    await client.query(
      `INSERT INTO customer_profiles (user_id, company, title)
       VALUES ($1, $2, $3)`,
      [user.id, payload.company ?? null, payload.title ?? null]
    );

    await client.query(
      `INSERT INTO notification_preferences (user_id) VALUES ($1)`,
      [user.id]
    );

    await client.query('COMMIT');

    const accessToken  = jwtUtils.signAccessToken(user);
    const refreshToken = await jwtUtils.signRefreshToken(user.id);

    return {
      tokens: { accessToken, refreshToken },
      user: {
        id:      user.id,
        email:   user.email,
        role:    user.role,
        name:    user.name,
        avatar:  user.avatar_initials,
        phone:   payload.phone   ?? null,
        company: payload.company ?? null,
        title:   payload.title   ?? null,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Login ─────────────────────────────────────────────────────────────────────

interface LoginRow {
  id: string; email: string; role: UserRole; name: string; avatar_initials: string;
  password_hash: string; is_active: boolean; phone: string | null;
  company: string | null; title: string | null;
  startup_profile_id: string | null; startup_slug: string | null;
  business_name: string | null; verification_status: string | null;
}

export async function loginUser(email: string, password: string): Promise<{
  tokens: AuthTokens;
  user:   RegisteredUser;
}> {
  const { rows } = await db.query<LoginRow>(
    `SELECT u.id, u.email, u.role, u.name, u.avatar_initials, u.password_hash,
            u.is_active, u.phone,
            cp.company, cp.title,
            sp.id         AS startup_profile_id,
            sp.slug       AS startup_slug,
            sp.business_name,
            sp.verification_status
     FROM   users u
     LEFT JOIN customer_profiles cp ON cp.user_id = u.id
     LEFT JOIN startup_profiles  sp ON sp.user_id = u.id
     WHERE  u.email = $1`,
    [email.toLowerCase()]
  );

  const INVALID_MSG = 'Invalid email or password.';
  if (rows.length === 0 || !rows[0].password_hash) {
    throw Object.assign(new Error(INVALID_MSG), { statusCode: 401 });
  }

  const user = rows[0];
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    throw Object.assign(new Error(INVALID_MSG), { statusCode: 401 });
  }

  if (!user.is_active) {
    throw Object.assign(new Error('This account has been deactivated. Contact support.'), { statusCode: 403 });
  }

  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const accessToken  = jwtUtils.signAccessToken(user);
  const refreshToken = await jwtUtils.signRefreshToken(user.id);

  const userPayload: RegisteredUser = {
    id:     user.id,
    email:  user.email,
    role:   user.role,
    name:   user.name,
    avatar: user.avatar_initials,
    phone:  user.phone,
    ...(user.role === 'customer' && { company: user.company, title: user.title }),
    ...(user.role === 'startup'  && {
      company:             user.business_name,
      startupId:           user.startup_profile_id ?? undefined,
      startupSlug:         user.startup_slug       ?? undefined,
      verificationStatus:  user.verification_status ?? undefined,
    }),
  };

  return { tokens: { accessToken, refreshToken }, user: userPayload };
}

// ─── Token Refresh ─────────────────────────────────────────────────────────────

export async function rotateRefreshToken(oldToken: string): Promise<AuthTokens> {
  const stored = await jwtUtils.verifyRefreshToken(oldToken);
  if (!stored) {
    throw Object.assign(new Error('Invalid or expired refresh token. Please log in again.'), { statusCode: 401 });
  }

  await jwtUtils.revokeRefreshToken(oldToken);

  const { rows } = await db.query<{
    id: string; email: string; role: UserRole; name: string; avatar_initials: string;
  }>(
    `SELECT id, email, role, name, avatar_initials FROM users WHERE id = $1 AND is_active = TRUE`,
    [stored.user_id]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('User not found or deactivated.'), { statusCode: 401 });
  }

  const user         = rows[0];
  const accessToken  = jwtUtils.signAccessToken(user);
  const refreshToken = await jwtUtils.signRefreshToken(user.id);

  return { accessToken, refreshToken };
}

// ─── Change Password ──────────────────────────────────────────────────────────

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const { rows } = await db.query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );

  const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!match) {
    throw Object.assign(new Error('Current password is incorrect.'), { statusCode: 400 });
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
  // NOTE: intentionally NOT revoking tokens — user stays logged in after password change
}

// ─── Get Current User ──────────────────────────────────────────────────────────

export async function getCurrentUser(userId: string): Promise<RegisteredUser | null> {
  const { rows } = await db.query<{
    id: string; email: string; role: UserRole; name: string; avatar_initials: string; phone: string | null;
    customer_company: string | null; customer_title: string | null;
    startup_profile_id: string | null; startup_slug: string | null;
    business_name: string | null; verification_status: string | null;
  }>(
    `SELECT u.id, u.email, u.role, u.name, u.avatar_initials, u.phone,
            cp.company  AS customer_company,
            cp.title    AS customer_title,
            sp.id       AS startup_profile_id,
            sp.slug     AS startup_slug,
            sp.business_name,
            sp.verification_status
     FROM   users u
     LEFT JOIN customer_profiles cp ON cp.user_id = u.id
     LEFT JOIN startup_profiles  sp ON sp.user_id = u.id
     WHERE  u.id = $1 AND u.is_active = TRUE`,
    [userId]
  );

  if (rows.length === 0) return null;
  const u = rows[0];

  return {
    id:     u.id,
    email:  u.email,
    role:   u.role,
    name:   u.name,
    avatar: u.avatar_initials,
    phone:  u.phone,
    ...(u.role === 'customer' && { company: u.customer_company, title: u.customer_title }),
    ...(u.role === 'startup'  && {
      company:            u.business_name,
      startupId:          u.startup_profile_id  ?? undefined,
      startupSlug:        u.startup_slug         ?? undefined,
      verificationStatus: u.verification_status  ?? undefined,
    }),
  };
}
