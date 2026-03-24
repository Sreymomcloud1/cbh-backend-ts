// src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import * as jwtUtils    from '../utils/jwt';
import { success, error } from '../utils/response';

export async function registerStartup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tokens, user } = await authService.registerStartup(req.body);
    success(res, { ...tokens, user }, 'Startup registered successfully.', 201);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message: string };
    if (e.statusCode) { error(res, e.message, e.statusCode); return; }
    next(err);
  }
}

export async function registerCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tokens, user } = await authService.registerCustomer(req.body);
    success(res, { ...tokens, user }, 'Customer account created successfully.', 201);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message: string };
    if (e.statusCode) { error(res, e.message, e.statusCode); return; }
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const { tokens, user } = await authService.loginUser(email, password);
    success(res, { ...tokens, user }, 'Login successful.');
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message: string };
    if (e.statusCode) { error(res, e.message, e.statusCode); return; }
    next(err);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken: token } = req.body as { refreshToken: string };
    const tokens = await authService.rotateRefreshToken(token);
    success(res, tokens, 'Token refreshed.');
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message: string };
    if (e.statusCode) { error(res, e.message, e.statusCode); return; }
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken: token } = req.body as { refreshToken?: string };
    if (token) await jwtUtils.revokeRefreshToken(token);
    success(res, null, 'Logged out successfully.');
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getCurrentUser(req.user!.id);
    if (!user) { error(res, 'User not found.', 404); return; }
    success(res, user);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    success(res, null, 'Password changed successfully.');
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message: string };
    if (e.statusCode) { error(res, e.message, e.statusCode); return; }
    next(err);
  }
}
