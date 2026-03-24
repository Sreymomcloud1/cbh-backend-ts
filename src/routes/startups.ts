// src/routes/startups.ts
import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/startupController';
import { authenticate, optionalAuth } from '../middlewares/authenticate';
import { requireRole, ownStartupOnly }  from '../middlewares/rbac';
import { validate }                     from '../middlewares/validate';

const router = Router();

// GET /api/v1/startups
router.get('/', optionalAuth, ctrl.listStartups);

// GET /api/v1/startups/me  — must be BEFORE /:slugOrId to avoid shadowing
router.get('/me', authenticate, requireRole('startup'), ctrl.getMyProfile);

// GET /api/v1/startups/:slugOrId
router.get('/:slugOrId', optionalAuth, ctrl.getStartup);

// PUT /api/v1/startups/:startupId
router.put('/:startupId',
  authenticate, requireRole('startup', 'admin'), ownStartupOnly,
  [
    body('tagline').optional().isLength({ max: 300 }),
    body('description').optional().isLength({ max: 5000 }),
    body('website').optional().isURL().withMessage('Invalid website URL.'),
  ],
  validate, ctrl.updateProfile
);

// POST /api/v1/startups/:startupId/services
router.post('/:startupId/services',
  authenticate, requireRole('startup', 'admin'), ownStartupOnly,
  [body('name').trim().notEmpty().withMessage('Service name is required.')],
  validate, ctrl.addService
);

// DELETE /api/v1/startups/:startupId/services/:serviceId
router.delete('/:startupId/services/:serviceId',
  authenticate, requireRole('startup', 'admin'), ownStartupOnly,
  ctrl.removeService
);

// POST /api/v1/startups/:startupId/team
router.post('/:startupId/team',
  authenticate, requireRole('startup', 'admin'), ownStartupOnly,
  [
    body('name').trim().notEmpty().withMessage('Member name is required.'),
    body('role').trim().notEmpty().withMessage('Member role is required.'),
  ],
  validate, ctrl.addTeamMember
);

// DELETE /api/v1/startups/:startupId/team/:memberId
router.delete('/:startupId/team/:memberId',
  authenticate, requireRole('startup', 'admin'), ownStartupOnly,
  ctrl.removeTeamMember
);

// GET /api/v1/startups/:startupId/analytics
router.get('/:startupId/analytics',
  authenticate, requireRole('startup', 'admin'), ownStartupOnly,
  ctrl.getAnalytics
);

export default router;
