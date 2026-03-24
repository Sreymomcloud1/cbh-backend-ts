// src/controllers/adminController.ts
import { Request, Response, NextFunction } from 'express';
import * as adminService from '../services/adminService';
import { success, error, paginated } from '../utils/response';

export async function getAdminStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.getAdminStats();
    success(res, data);
  } catch (err) { next(err); }
}

export async function listSubmissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page  = Math.max(1, parseInt(req.query['page']  as string || '1',  10));
    const limit = Math.min(100, parseInt(req.query['limit'] as string || '20', 10));
    const { rows, total } = await adminService.listSubmissions({
      search: req.query['search'] as string | undefined,
      status: req.query['status'] as string | undefined,
      page, limit,
    });
    paginated(res, rows, total, page, limit);
  } catch (err) { next(err); }
}

export async function getSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await adminService.getSubmissionById(req.params['startupId']!);
    if (!row) { error(res, 'Submission not found.', 404); return; }
    success(res, row);
  } catch (err) { next(err); }
}

export async function approveSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await adminService.approveSubmission(req.params['startupId']!, req.user!.id);
    if (!row) { error(res, 'Submission not found or not in Pending state.', 404); return; }
    success(res, row, `${row.businessName} has been approved and is now live.`);
  } catch (err) { next(err); }
}

export async function rejectSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rejectionReason } = req.body as { rejectionReason: string };
    const row = await adminService.rejectSubmission(req.params['startupId']!, req.user!.id, rejectionReason);
    if (!row) { error(res, 'Submission not found or not in Pending state.', 404); return; }
    success(res, row, `${row.businessName} has been rejected.`);
  } catch (err) { next(err); }
}

export async function resetSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await adminService.resetSubmission(req.params['startupId']!);
    if (!row) { error(res, 'Submission not found.', 404); return; }
    success(res, row, 'Submission reset to Pending.');
  } catch (err) { next(err); }
}

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page  = Math.max(1, parseInt(req.query['page']  as string || '1',  10));
    const limit = Math.min(100, parseInt(req.query['limit'] as string || '20', 10));
    const { rows, total } = await adminService.listUsers({
      role:   req.query['role']   as string | undefined,
      search: req.query['search'] as string | undefined,
      page, limit,
    });
    paginated(res, rows, total, page, limit);
  } catch (err) { next(err); }
}

export async function toggleUserActive(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;
    if (userId === req.user!.id) { error(res, 'You cannot deactivate your own account.', 400); return; }

    const { active } = req.body as { active: boolean };
    const row = await adminService.toggleUserActive(userId!, active === true);
    if (!row) { error(res, 'User not found.', 404); return; }
    success(res, row, `User ${row.isActive ? 'activated' : 'deactivated'}.`);
  } catch (err) { next(err); }
}

export async function broadcastMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, body } = req.body as { title: string; body: string };
    const row = await adminService.broadcastMessage(title, body, req.user!.id);
    success(res, row, 'Platform message broadcast.', 201);
  } catch (err) { next(err); }
}
