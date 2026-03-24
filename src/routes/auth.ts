// src/routes/auth.ts
import { Router } from 'express';
import { body }   from 'express-validator';
import * as ctrl  from '../controllers/authController';
import { authenticate } from '../middlewares/authenticate';
import { validate }     from '../middlewares/validate';

const router = Router();

// Reusable Cambodian phone validator
const cambodianPhone = body('phone')
  .optional({ nullable: true, checkFalsy: true })
  .custom((val: unknown) => {
    if (!val) return true;
    const cleaned = String(val).replace(/[\s\-().]/g, '');
    if (!/^(\+855|855)[1-9]\d{7,8}$/.test(cleaned) && !/^0[1-9]\d{7,8}$/.test(cleaned)) {
      throw new Error('Phone must be a valid Cambodian number e.g. +855 12 345 678');
    }
    return true;
  });

// POST /api/v1/auth/register/startup
router.post('/register/startup', [
  body('businessName').trim().notEmpty().withMessage('Business name is required.'),
  body('industry').notEmpty().withMessage('Industry is required.'),
  body('fundingStage').notEmpty().withMessage('Funding stage is required.'),
  body('accountEmail').isEmail().normalizeEmail().withMessage('Valid account email is required.'),
  body('founderEmail').optional({ checkFalsy: true }).isEmail().withMessage('Founder email must be valid.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  body('website').optional({ checkFalsy: true })
    .isURL({ require_protocol: true }).withMessage('Website must start with http:// or https://'),
  body('founderPhone').optional({ nullable: true, checkFalsy: true }).custom((val: unknown) => {
    if (!val) return true;
    const cleaned = String(val).replace(/[\s\-().]/g, '');
    if (!/^(\+855|855)[1-9]\d{7,8}$/.test(cleaned) && !/^0[1-9]\d{7,8}$/.test(cleaned)) {
      throw new Error('Phone must be a valid Cambodian number');
    }
    return true;
  }),
], validate, ctrl.registerStartup);

// POST /api/v1/auth/register/customer
router.post('/register/customer', [
  body('name').trim().notEmpty().withMessage('Full name is required.'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  cambodianPhone,
], validate, ctrl.registerCustomer);

// POST /api/v1/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
], validate, ctrl.login);

// POST /api/v1/auth/refresh
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required.'),
], validate, ctrl.refreshToken);

// POST /api/v1/auth/logout
router.post('/logout', ctrl.logout);

// GET /api/v1/auth/me
router.get('/me', authenticate, ctrl.me);

// POST /api/v1/auth/change-password
router.post('/change-password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
], validate, ctrl.changePassword);

export default router;
