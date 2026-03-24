// src/utils/jwt.ts
import jwt         from 'jsonwebtoken';
import crypto      from 'crypto';
import db          from '../config/db';
import { JwtPayload, RefreshTokenPayload, UserRow } from '../types';

const ACCESS_SECRET  = process.env.JWT_SECRET         as string;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
const ACCESS_EXP     = process.env.JWT_EXPIRES_IN          ?? '15m';
const REFRESH_EXP    = process.env.JWT_REFRESH_EXPIRES_IN  ?? '7d';

/** Sign a short-lived access token. */
export function signAccessToken(user: Pick<UserRow, 'id' | 'email' | 'role' | 'name' | 'avatar_initials'>): string {
  return jwt.sign(
    {
      sub:    user.id,
      email:  user.email,
      role:   user.role,
      name:   user.name,
      avatar: user.avatar_initials,
    } satisfies Omit<JwtPayload, 'iat' | 'exp'>,
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXP }
  );
}

/** Sign a long-lived refresh token and persist its hash in the DB. */
export async function signRefreshToken(userId: string): Promise<string> {
  const token = jwt.sign({ sub: userId } satisfies Omit<RefreshTokenPayload, 'iat' | 'exp'>, REFRESH_SECRET, {
    expiresIn: REFRESH_EXP,
  });

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
