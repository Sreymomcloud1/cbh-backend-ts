// src/routes/contact.ts
import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { body } from 'express-validator';
import nodemailer from 'nodemailer';
import { validate } from '../middlewares/validate';
import { success, error as errorResponse } from '../utils/response'; // Renamed error to avoid conflict
import logger from '../utils/logger';

const router = Router();

// Create the transporter once
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT ?? '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // If using Gmail, this MUST be an "App Password"
  },
});

// Explicitly type the handler as RequestHandler to solve the TS error
const handleContactForm: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      name,
      email,
      topic = 'General Inquiry',
      subject = 'Contact Form',
      message,
      rating = 0,
    } = req.body;

    const toAddress = process.env.CONTACT_EMAIL ?? process.env.SMTP_USER;
    const fromAddress = process.env.SMTP_FROM ?? process.env.SMTP_USER;

    // Verify SMTP connection before sending (Optional but helpful for debugging)
    // await transporter.verify();

    await transporter.sendMail({
      from: `"CBH Contact Form" <${fromAddress}>`,
      to: toAddress,
      replyTo: email,
      subject: `[CBH] ${topic} — ${subject}`,
      text: [
        `New contact form submission from CBH`,
        ``,
        `Name:    ${name}`,
        `Email:   ${email}`,
        `Topic:   ${topic}`,
        `Rating:  ${rating}/5`,
        ``,
        `Message:`,
        message,
      ].join('\n'),
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#c84b00">New Contact Form Submission</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;font-weight:bold;width:100px">Name</td><td style="padding:8px">${name}</td></tr>
            <tr style="background:#f5f5f5"><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:8px;font-weight:bold">Topic</td><td style="padding:8px">${topic}</td></tr>
            <tr style="background:#f5f5f5"><td style="padding:8px;font-weight:bold">Rating</td><td style="padding:8px">${rating}/5 ⭐</td></tr>
          </table>
          <div style="margin-top:20px;padding:16px;background:#f9f9f9;border-left:4px solid #c84b00">
            <strong>Message:</strong>
            <p style="white-space:pre-wrap">${message}</p>
          </div>
          <p style="color:#999;font-size:12px;margin-top:20px">
            This email was sent from the CBH Contact Us form.<br>
            Reply directly to this email to respond to ${name}.
          </p>
        </div>
      `,
    });

    logger.info('Contact form email sent', { from: email, topic, rating });
    success(res, null, "Message received. We'll reply within 1–2 business days.");
  } catch (err) {
    logger.error('Contact form email failed', { error: (err as Error).message });
    // In Express, always call next(err) if you want the global error handler to catch it,
    // otherwise, return the response directly as you are doing here.
    errorResponse(res, 'Failed to send message. Please try again.', 500);
  }
};

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('subject').trim().notEmpty().withMessage('Subject is required.'),
    body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters.'),
  ],
  validate,
  handleContactForm
);

export default router;