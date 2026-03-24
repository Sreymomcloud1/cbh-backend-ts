// src/types/index.ts
// Centralised type definitions for the entire backend.

import { Request } from 'express';

// ─── Enums (mirror PostgreSQL ENUM types) ─────────────────────────────────────

export type UserRole         = 'startup' | 'customer' | 'admin';
export type VerificationStatus = 'Pending' | 'Approved' | 'Rejected';
export type FundingStage     = 'Pre-Seed' | 'Seed' | 'Series A' | 'Series B' | 'Growth' | 'Bootstrapped';
export type IndustryType     = 'Technology' | 'Food & Beverage' | 'Education' | 'Finance' | 'Retail' | 'Healthcare' | 'Agriculture' | 'Real Estate';
export type ConnectionPurpose = 'Collaborate' | 'Invest' | 'Become Customer';
export type RequestStatus    = 'New' | 'Reviewed' | 'Responded' | 'Declined';
export type PlanType         = 'free' | 'pro';
export type DocumentType     = 'business_registration' | 'id_document' | 'food_license' | 'health_license' | 'construction_license' | 'energy_cert' | 'tourism_license' | 'nbc_license' | 'other';
export type MessageTab       = 'all' | 'sent' | 'received' | 'updates';

// ─── Authenticated request payload ────────────────────────────────────────────

export interface AuthUser {
  id:     string;
  email:  string;
  role:   UserRole;
  name:   string;
  avatar: string;
}

/** Express Request extended with authenticated user */
export interface AuthRequest extends Request {
  user: AuthUser;
}

// ─── Database row shapes ───────────────────────────────────────────────────────

export interface UserRow {
  id:               string;
  email:            string;
  password_hash:    string;
  role:             UserRole;
  name:             string;
  phone:            string | null;
  avatar_initials:  string;
  is_active:        boolean;
  last_login_at:    Date | null;
  created_at:       Date;
  updated_at:       Date;
}

export interface StartupProfileRow {
  id:                 string;
  user_id:            string;
  slug:               string;
  business_name:      string;
  tagline:            string;
  description:        string;
  logo_initials:      string;
  industry:           IndustryType;
  funding_stage:      FundingStage;
  plan:               PlanType;
  location:           string;
  website:            string;
  founded_year:       string | null;
  employee_range:     string | null;
  verification_status: VerificationStatus;
  verified_at:        Date | null;
  rejection_reason:   string | null;
  verified_by:        string | null;
  founder_name:       string | null;
  founder_email:      string | null;
  marketing_name:     string | null;
  marketing_email:    string | null;
  sales_name:         string | null;
  sales_email:        string | null;
  created_at:         Date;
  updated_at:         Date;
}

export interface ConnectionRequestRow {
  id:               string;
  sender_id:        string;
  startup_id:       string;
  sender_full_name: string;
  sender_company:   string;
  sender_role:      string;
  sender_email:     string;
  sender_phone:     string | null;
  budget_range:     string | null;
  purpose:          ConnectionPurpose;
  message:          string;
  subject:          string;
  status:           RequestStatus;
  startup_reply:    string | null;
  replied_at:       Date | null;
  created_at:       Date;
}

export interface RefreshTokenRow {
  id:          number;
  user_id:     string;
  token_hash:  string;
  revoked:     boolean;
  expires_at:  Date;
  created_at:  Date;
}

// ─── Service interfaces ────────────────────────────────────────────────────────

export interface UploadResult {
  storagePath:  string;
  publicUrl:    string;
  originalName: string;
  mimetype:     string;
}

export interface PaginationMeta {
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

// ─── API response envelope ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success:    boolean;
  message:    string;
  data:       T | null;
  errors?:    string[];
  pagination?: PaginationMeta;
}

// ─── JWT payload ──────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub:    string;
  email:  string;
  role:   UserRole;
  name:   string;
  avatar: string;
  iat?:   number;
  exp?:   number;
}

export interface RefreshTokenPayload {
  sub: string;
  iat?: number;
  exp?: number;
}
