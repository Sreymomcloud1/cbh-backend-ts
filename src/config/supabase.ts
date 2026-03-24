// src/config/supabase.ts
// Supabase client initialised with the SERVICE ROLE key so the backend
// can bypass Row Level Security for all operations.
//
// Note: We use Supabase's postgres client via the JS SDK for DB queries
// AND its storage SDK for file uploads — single source of truth.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL              = process.env.SUPABASE_URL              ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'cbh-kyc-documents';

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/** True when Supabase credentials are real (not placeholder values) */
export const isSupabaseConfigured: boolean =
  Boolean(SUPABASE_URL) &&
  SUPABASE_URL !== 'https://placeholder.supabase.co' &&
  Boolean(SUPABASE_SERVICE_ROLE_KEY) &&
  SUPABASE_SERVICE_ROLE_KEY !== 'placeholder';
