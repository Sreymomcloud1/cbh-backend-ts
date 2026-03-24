// src/app.ts
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet    from 'helmet';
import cors      from 'cors';
import morgan    from 'morgan';
import rateLimit from 'express-rate-limit';

import logger           from './utils/logger';
import { error as apiError } from './utils/response';

import authRoutes       from './routes/auth';
import startupRoutes    from './routes/startups';
import connectionRoutes from './routes/connections';
import adminRoutes      from './routes/admin';
import uploadRoutes     from './routes/uploads';
import userRoutes       from './routes/users';
import contactRoutes    from './routes/contact';

const app = express();
const API = process.env.API_PREFIX ?? '/api/v1';

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
    if (!origin) return cb(null, true); // server-to-server / curl
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} is not allowed.`));
  },
  credentials:     true,
  methods:         ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:  ['Content-Type', 'Authorization'],
  exposedHeaders:  ['X-Total-Count'],
}));

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── HTTP logging ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg: string) => logger.http(msg.trim()) },
  }));
}

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs:       parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10),
  max:            parseInt(process.env.RATE_LIMIT_MAX       ?? '200',    10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
}));

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '20', 10),
  message: { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) =>
  res.json({
    status:  'ok',
    service: 'cbh-api',
    env:     process.env.NODE_ENV,
    ts:      new Date().toISOString(),
  })
);

// ── Route registration ────────────────────────────────────────────────────────
app.use(`${API}/auth`,        authLimiter, authRoutes);
app.use(`${API}/startups`,    startupRoutes);
app.use(`${API}/connections`, connectionRoutes);
app.use(`${API}/admin`,       adminRoutes);
app.use(`${API}/uploads`,     uploadRoutes);
app.use(`${API}/users`,       userRoutes);
app.use(`${API}/contact`,     contactRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) =>
  apiError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404)
);

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err.message?.startsWith('CORS:')) {
    apiError(res, err.message, 403);
    return;
  }
  logger.error('Unhandled error', {
    message: err.message,
    stack:   err.stack,
    path:    req.originalUrl,
  });
  const code = (err as { statusCode?: number; status?: number }).statusCode
             || (err as { statusCode?: number; status?: number }).status
             || 500;
  const msg = process.env.NODE_ENV === 'production'
    ? 'Internal server error.'
    : err.message;
  apiError(res, msg, code);
});

export default app;
