// src/services/storageService.ts
// Supabase Storage interactions — with graceful fallback for unconfigured buckets.

import path          from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabase, BUCKET, isSupabaseConfigured } from '../config/supabase';
import logger        from '../utils/logger';
import { UploadResult } from '../types';

/**
 * Upload a single document buffer to Supabase Storage.
 * Falls back to a placeholder URL if Supabase is not configured or bucket missing.
 */
export async function uploadDocument(opts: {
  startupId:    string;
  buffer:       Buffer;
  originalName: string;
  mimetype:     string;
}): Promise<UploadResult> {
  const { startupId, buffer, originalName, mimetype } = opts;
  const ext         = path.extname(originalName).toLowerCase() || '.pdf';
  const storagePath = `kyc/${startupId}/${uuidv4()}${ext}`;

  // Graceful fallback when Supabase is not configured
  if (!isSupabaseConfigured) {
    logger.warn('Supabase not configured — returning placeholder URL for upload', { originalName });
    return {
      storagePath,
      publicUrl:    `https://placeholder.storage/${storagePath}`,
      originalName,
      mimetype,
    };
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType:  mimetype,
      cacheControl: '3600',
      upsert:       false,
    });

  if (error) {
    logger.error('Supabase upload failed', { storagePath, error: error.message });

    // Provide a specific message for the most common errors
    if (error.message.toLowerCase().includes('bucket not found') ||
        error.message.toLowerCase().includes('not found')) {
      throw new Error(
        `Storage bucket "${BUCKET}" not found. ` +
        `Create it in Supabase → Storage → New bucket → name: "${BUCKET}" → public.`
      );
    }
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  logger.info('Document uploaded to Supabase', { storagePath, originalName });
  return { storagePath, publicUrl: data.publicUrl, originalName, mimetype };
}

/**
 * Delete a document from Supabase Storage. Non-fatal on failure.
 */
export async function deleteDocument(storagePath: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    logger.warn('Supabase delete failed (non-fatal)', { storagePath, error: error.message });
  }
}

/**
 * Generate a signed URL for a private document.
 */
export async function getSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  if (!isSupabaseConfigured) return `https://placeholder.storage/${storagePath}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}
