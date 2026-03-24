// src/middlewares/validate.ts
// Run express-validator result check after a chain of validators.
// Usage: router.post('/path', [...validators], validate, controller)

import { Request, Response, NextFunction } from 'express';
import { validationResult }               from 'express-validator';
import { error }                           from '../utils/response';

export function validate(req: Request, res: Response, next: NextFunction): void {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = result.array().map((e) => `${e.type === 'field' ? (e as { path: string }).path : 'field'}: ${e.msg}`);
    error(res, 'Validation failed.', 422, errors);
    return;
  }
  next();
}
