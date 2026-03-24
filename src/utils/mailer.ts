// src/utils/mailer.ts
import nodemailer from 'nodemailer';
import logger from './logger';

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === '465', // true for 465, false for others
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Run this in your server.ts to check if your SMTP settings are correct
export const verifyMailConnection = async () => {
  try {
    await transporter.verify();
    logger.info('SMTP Server is ready');
  } catch (error) {
    logger.error('SMTP Connection failed:', error);
  }
};