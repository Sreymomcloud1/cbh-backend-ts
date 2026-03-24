// src/middlewares/rbac.ts
// Role-Based Access Control middleware.
// Always use AFTER authenticate() in the middleware chain.

import { Request, Response, NextFunction } from 'express';
import db          from '../config/db';
import { error }   from '../utils/response';
import { UserRole } from '../types';

/**
 * requireRole — allow only users with one of the given roles.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      error(res, 'Authentication required.', 401);
      return;
    }
    if (!roles.includes(req.user.role)) {
      error(res, `Access denied. This route requires role: ${roles.join(' or ')}.`, 403);
      return;
    }
    next();
  };
}

/**
 * ownStartupOnly — a startup user can only modify their OWN profile.
 * Reads :startupId from route params. Admins always pass through.
 */
export async function ownStartupOnly(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.user?.role === 'admin') { next(); return; }

  const { startupId } = req.params;
  if (!startupId) { error(res, 'Missing startupId parameter.', 400); return; }

  try {
    const { rows } = await db.query<{ user_id: string }>(
      'SELECT user_id FROM startup_profiles WHERE id = $1',
      [startupId]
    );

    if (rows.length === 0) { error(res, 'Startup profile not found.', 404); return; }
    if (rows[0].user_id !== req.user?.id) {
      error(res, 'You do not have permission to modify this startup.', 403); return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * ownRequestOnly — a customer can only update their OWN connection requests.
 */
export async function ownRequestOnly(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.user?.role === 'admin') { next(); return; }

  const { requestId } = req.params;
  if (!requestId) { error(res, 'Missing requestId parameter.', 400); return; }

  try {
    const { rows } = await db.query<{ sender_id: string }>(
      'SELECT sender_id FROM connection_requests WHERE id = $1',
      [requestId]
    );

    if (rows.length === 0) { error(res, 'Request not found.', 404); return; }
    if (rows[0].sender_id !== req.user?.id) { error(res, 'Access denied.', 403); return; }
    next();
  } catch (err) {
    next(err);
  }
}
