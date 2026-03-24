// src/controllers/userController.ts
import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';
import { success } from '../utils/response';

export async function getNotificationPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const prefs = await userService.getNotificationPreferences(req.user!.id);
    success(res, prefs);
  } catch (err) { next(err); }
}

export async function updateNotificationPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const prefs = await userService.updateNotificationPreferences(req.user!.id, req.body);
    success(res, prefs, 'Notification preferences updated.');
  } catch (err) { next(err); }
}

export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await userService.updateMe(req.user!.id, req.user!.role, req.body);
    success(res, row, 'Profile updated.');
  } catch (err) { next(err); }
}

export async function deactivateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await userService.deactivateUser(req.user!.id);
    success(res, null, 'Account deactivated. Contact support to reactivate.');
  } catch (err) { next(err); }
}
