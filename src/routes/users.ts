// src/routes/users.ts
import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/userController';
import { authenticate } from '../middlewares/authenticate';
import { validate }     from '../middlewares/validate';

const router = Router();

router.use(authenticate);

// GET  /api/v1/users/me/notifications
router.get('/me/notifications', ctrl.getNotificationPreferences);

// PUT  /api/v1/users/me/notifications
router.put('/me/notifications',
  [
    body('newRequests').optional().isBoolean(),
    body('messages').optional().isBoolean(),
    body('platformUpdates').optional().isBoolean(),
    body('newsletter').optional().isBoolean(),
  ],
  validate, ctrl.updateNotificationPreferences
);

// PUT /api/v1/users/me
router.put('/me',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty.'),
    body('phone').optional().trim(),
    body('company').optional().trim(),
    body('title').optional().trim(),
  ],
  validate, ctrl.updateMe
);

// DELETE /api/v1/users/me
router.delete('/me', ctrl.deactivateMe);

export default router;
