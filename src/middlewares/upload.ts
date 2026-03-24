// src/middlewares/upload.ts
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { error } from '../utils/response';

const MAX_SIZE_MB    = parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10);
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const storage = multer.memoryStorage();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const upload: any = multer({
  storage,
  fileFilter: (_req: any, file: any, cb: any) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new multer.MulterError(
        'LIMIT_UNEXPECTED_FILE',
        `Invalid file type: ${file.mimetype}. Allowed: PDF, JPEG, PNG, WEBP.`
      ));
    }
  },
  limits: { fileSize: MAX_SIZE_BYTES, files: 5 },
});

export function handleUploadError(err: any, _req: Request, res: Response, next: NextFunction): void {
  if (err && err.constructor && err.constructor.name === 'MulterError') {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE:       `File too large. Max size is ${MAX_SIZE_MB} MB.`,
      LIMIT_FILE_COUNT:      'Too many files. Maximum 5 files per upload.',
      LIMIT_UNEXPECTED_FILE: err.message || 'Unexpected file field.',
    };
    error(res, messages[err.code as string] ?? (err.message as string), 400);
    return;
  }
  next(err);
}
