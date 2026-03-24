// src/controllers/startupController.ts
import { Request, Response, NextFunction } from 'express';
import * as startupService from '../services/startupService';
import { success, error, paginated } from '../utils/response';

export async function listStartups(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page  = Math.max(1, parseInt(req.query['page']  as string || '1',  10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string || '20', 10)));

    const { rows, total } = await startupService.listStartups({
      search:       (req.query['search']       as string) || '',
      industry:      req.query['industry']      as string | undefined,
      fundingStage:  req.query['fundingStage']  as string | undefined,
      verifiedOnly:  req.query['verified'] === 'true',
      page,
      limit,
    } as any);
    paginated(res, rows, total, page, limit);
  } catch (err) { next(err); }
}

export async function getStartup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await startupService.getStartupBySlugOrId(req.params['slugOrId']!);
    if (!row) { error(res, 'Startup not found.', 404); return; }
    success(res, row);
  } catch (err) { next(err); }
}

export async function getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await startupService.getMyProfile(req.user!.id);
    if (!row) { error(res, 'Startup profile not found.', 404); return; }
    success(res, row);
  } catch (err) { next(err); }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await startupService.updateProfile(req.params['startupId']!, req.body);
    if (!row) { error(res, 'Startup not found.', 404); return; }
    success(res, row, 'Profile updated.');
  } catch (err) { next(err); }
}

export async function addService(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name } = req.body as { name: string };
    const row = await startupService.addService(req.params['startupId']!, name);
    success(res, row, 'Service added.', 201);
  } catch (err) { next(err); }
}

export async function removeService(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const found = await startupService.removeService(req.params['startupId']!, req.params['serviceId']!);
    if (!found) { error(res, 'Service not found.', 404); return; }
    success(res, null, 'Service removed.');
  } catch (err) { next(err); }
}

export async function addTeamMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, role } = req.body as { name: string; role: string };
    const row = await startupService.addTeamMember(req.params['startupId']!, name, role);
    success(res, row, 'Team member added.', 201);
  } catch (err) { next(err); }
}

export async function removeTeamMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const found = await startupService.removeTeamMember(req.params['startupId']!, req.params['memberId']!);
    if (!found) { error(res, 'Team member not found.', 404); return; }
    success(res, null, 'Team member removed.');
  } catch (err) { next(err); }
}

export async function getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await startupService.getAnalytics(req.params['startupId']!);
    success(res, data);
  } catch (err) { next(err); }
}
