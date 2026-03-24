// src/controllers/connectionController.ts
import { Request, Response, NextFunction } from 'express';
import * as connectionService from '../services/connectionService';
import { success, error, paginated } from '../utils/response';
import { MessageTab } from '../types';

export async function sendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as {
      startupId: string; fullName: string; companyName?: string; role?: string;
      email: string; phone?: string; budget?: string; purpose: string; message: string;
    };
    const row = await connectionService.sendRequest({
      senderId:       req.user!.id,
      startupId:      body.startupId,
      senderFullName: body.fullName,
      senderCompany:  body.companyName ?? '',
      senderRole:     body.role        ?? '',
      senderEmail:    body.email,
      senderPhone:    body.phone   ?? null,
      budgetRange:    body.budget  ?? null,
      purpose:        body.purpose,
      message:        body.message,
    });
    success(res, row, 'Connection request sent.', 201);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message: string };
    if (e.statusCode) { error(res, e.message, e.statusCode); return; }
    next(err);
  }
}

export async function getInbox(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tab   = (req.query['tab'] as MessageTab) || 'all';
    const page  = Math.max(1, parseInt(req.query['page']  as string || '1',  10));
    const limit = Math.min(100, parseInt(req.query['limit'] as string || '20', 10));

    const { rows, total } = await connectionService.getInbox({
      userId:   req.user!.id,
      userName: req.user!.name,
      role:     req.user!.role,
      tab, page, limit,
    });
    paginated(res, rows, total, page, limit);
  } catch (err) { next(err); }
}

export async function getRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await connectionService.getRequestById(req.params['requestId']!);
    if (!row) { error(res, 'Request not found.', 404); return; }

    const isSender       = row.senderId       === req.user!.id;
    const isStartupOwner = row.startupOwnerId === req.user!.id;
    if (req.user!.role !== 'admin' && !isSender && !isStartupOwner) {
      error(res, 'Access denied.', 403); return;
    }

    success(res, row);
  } catch (err) { next(err); }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.body as { status: string };
    const row = await connectionService.updateRequestStatus(
      req.params['requestId']!, req.user!.id, req.user!.role, status
    );
    success(res, row, 'Status updated.');
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message: string };
    if (e.statusCode) { error(res, e.message, e.statusCode); return; }
    next(err);
  }
}

export async function replyToRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { message } = req.body as { message: string };
    const row = await connectionService.replyToRequest(
      req.params['requestId']!, req.user!.id, req.user!.role, message
    );
    success(res, row, 'Reply sent.');
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message: string };
    if (e.statusCode) { error(res, e.message, e.statusCode); return; }
    next(err);
  }
}

export async function withdrawRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const found = await connectionService.withdrawRequest(req.params['requestId']!, req.user!.id);
    if (!found) { error(res, 'Request not found, already actioned, or not owned by you.', 404); return; }
    success(res, null, 'Request withdrawn.');
  } catch (err) { next(err); }
}

export async function getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role   = req.user!.role;
    const userId = req.user!.id;

    if (role === 'startup') {
      const data = await connectionService.getStartupStats(userId);
      success(res, data); return;
    }
    if (role === 'customer') {
      const data = await connectionService.getCustomerStats(userId);
      success(res, data); return;
    }
    success(res, {});
  } catch (err) { next(err); }
}
