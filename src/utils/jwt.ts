import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../config/db';
import { JwtPayload, RefreshTokenPayload, UserRow } from '../types';

// Ensure these are never undefined to avoid type errors
const ACCESS_SECRET: Secret = process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET is missing'); })();
const REFRESH_SECRET: Secret = process.env.JWT_REFRESH_SECRET || (() => { throw new Error('JWT_REFRESH_SECRET is missing'); })();

// Use 'as any' or a specific type to prevent the TS2769 overload error
const ACCESS_EXP = (process.env.JWT_EXPIRES_IN ?? '15m') as any;
const REFRESH_EXP = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as any;

/** Sign a short-lived access token. */
export function signAccessToken(user: Pick<UserRow, 'id' | 'email' | 'role' | 'name' | 'avatar_initials'>): string {
  const payload = {
    sub:    user.id,
    email:  user.email,
    role:   user.role,
    name:   user.name,
    avatar: user.avatar_initials,
  };

  // Explicitly cast the options to SignOptions
  const options: SignOptions = { expiresIn: ACCESS_EXP };

  return jwt.sign(payload, ACCESS_SECRET, options);
}

/** Sign a long-lived refresh token and persist its hash in the DB. */
export async function signRefreshToken(userId: string): Promise<string> {
  const payload = { sub: userId };
  const options: SignOptions = { expiresIn: REFRESH_EXP };

  const token = jwt.sign(payload, REFRESH_SECRET, options);

  const hash      = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hash, expiresAt]
  );

  return token;
}

/** Verify an access token. Throws if invalid or expired. */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

/** Verify a refresh token against the DB. Returns the DB record or null. */
export async function verifyRefreshToken(token: string): Promise<{ user_id: string } | null> {
  try {
    jwt.verify(token, REFRESH_SECRET);
  } catch {
    return null;
  }

  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await db.query<{ user_id: string }>(
    `SELECT user_id FROM refresh_tokens
     WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW()`,
    [hash]
  );
  return rows[0] ?? null;
}

/** Revoke a specific refresh token. */
export async function revokeRefreshToken(token: string): Promise<void> {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await db.query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`,
    [hash]
  );
}

/** Revoke all refresh tokens for a user (e.g. on password change). */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await db.query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`,
    [userId]
  );
}
