// src/routes/connections.ts
import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/connectionController';
import { authenticate }  from '../middlewares/authenticate';
import { requireRole }   from '../middlewares/rbac';
import { validate }      from '../middlewares/validate';

const router = Router();

// All connection routes require authentication
router.use(authenticate);

// GET /api/v1/connections/stats
router.get('/stats', ctrl.getDashboardStats);

// GET /api/v1/connections/inbox?tab=all|sent|received|updates&page=1&limit=20
router.get('/inbox', ctrl.getInbox);

// POST /api/v1/connections
router.post('/',
  // Any authenticated user can send a connection request
  // (startups, customers, and admins)
  [
    body('startupId')
      .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .withMessage('Valid startupId (UUID) is required.'),
    body('fullName').trim().notEmpty().withMessage('Full name is required.'),
    body('email').isEmail().withMessage('Valid email is required.'),
    body('purpose')
      .isIn(['Collaborate', 'Invest', 'Become Customer'])
      .withMessage('Purpose must be Collaborate, Invest, or Become Customer.'),
    body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters.'),
  ],
  validate, ctrl.sendRequest
);

// GET /api/v1/connections/:requestId
router.get('/:requestId', ctrl.getRequest);

// PATCH /api/v1/connections/:requestId/status
router.patch('/:requestId/status',
  requireRole('startup', 'admin'),
  [
    body('status')
      .isIn(['Reviewed', 'Responded', 'Declined'])
      .withMessage('Status must be Reviewed, Responded, or Declined.'),
  ],
  validate, ctrl.updateStatus
);

// PATCH /api/v1/connections/:requestId/reply
router.patch('/:requestId/reply',
  requireRole('startup', 'admin'),
  [body('message').trim().notEmpty().withMessage('Reply message is required.')],
  validate, ctrl.replyToRequest
);

// DELETE /api/v1/connections/:requestId
router.delete('/:requestId',
  requireRole('customer'),
  ctrl.withdrawRequest
);

export default router;
