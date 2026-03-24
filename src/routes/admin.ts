// src/routes/admin.ts
import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/adminController';
import { authenticate } from '../middlewares/authenticate';
import { requireRole }  from '../middlewares/rbac';
import { validate }     from '../middlewares/validate';

const router = Router();

// All admin routes: authenticated + role = 'admin'
router.use(authenticate, requireRole('admin'));

// GET /api/v1/admin/stats
router.get('/stats', ctrl.getAdminStats);

// GET /api/v1/admin/submissions
router.get('/submissions', ctrl.listSubmissions);

// GET /api/v1/admin/submissions/:startupId
router.get('/submissions/:startupId', ctrl.getSubmission);

// PATCH /api/v1/admin/submissions/:startupId/approve
router.patch('/submissions/:startupId/approve', ctrl.approveSubmission);

// PATCH /api/v1/admin/submissions/:startupId/reject
router.patch('/submissions/:startupId/reject',
  [body('rejectionReason').trim().notEmpty().withMessage('Rejection reason is required.')],
  validate, ctrl.rejectSubmission
);

// PATCH /api/v1/admin/submissions/:startupId/reset
router.patch('/submissions/:startupId/reset', ctrl.resetSubmission);

// GET /api/v1/admin/users
router.get('/users', ctrl.listUsers);

// PATCH /api/v1/admin/users/:userId/active
router.patch('/users/:userId/active',
  [body('active').isBoolean().withMessage('active must be a boolean.')],
  validate, ctrl.toggleUserActive
);

// POST /api/v1/admin/platform-messages
router.post('/platform-messages',
  [
    body('title').trim().notEmpty().withMessage('Title is required.'),
    body('body').trim().notEmpty().withMessage('Body is required.'),
  ],
  validate, ctrl.broadcastMessage
);

export default router;
