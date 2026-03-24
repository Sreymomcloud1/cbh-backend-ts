// src/middlewares/authenticate.ts
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { error }             from '../utils/response';
import { AuthUser }          from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers['authorization'];
  const raw    = Array.isArray(header) ? header[0] : header;
  if (!raw || !raw.startsWith('Bearer ')) return null;
  return raw.slice(7);
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);

  if (!token) {
    error(res, 'Authentication required. Please provide a Bearer token.', 401);
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id:     payload.sub,
      email:  payload.email,
      role:   payload.role,
      name:   payload.name,
      avatar: payload.avatar,
    };
    next();
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === 'TokenExpiredError') {
      error(res, 'Access token expired. Please refresh your session.', 401);
    } else {
      error(res, 'Invalid access token.', 401);
    }
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = {
        id:     payload.sub,
        email:  payload.email,
        role:   payload.role,
        name:   payload.name,
        avatar: payload.avatar,
      };
    } catch {
      // Silently ignore invalid/expired tokens on optional routes
    }
  }
  next();
}
