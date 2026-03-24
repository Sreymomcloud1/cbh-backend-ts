// src/controllers/uploadController.ts
// eKYC document upload. Gracefully degrades when Supabase is not configured.

import { Request, Response, NextFunction } from 'express';
import db from '../config/db';
import { isSupabaseConfigured } from '../config/supabase';
import * as storageService from '../services/storageService';
import { success, error } from '../utils/response';

function inferDocumentType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('registration') || lower.includes('cert')) return 'business_registration';
  if (lower.includes('passport') || lower.includes('id_doc') || lower.includes('nid')) return 'id_document';
  if (lower.includes('food') || lower.includes('fda'))    return 'food_license';
  if (lower.includes('health'))                           return 'health_license';
  if (lower.includes('construct'))                        return 'construction_license';
  if (lower.includes('energy') || lower.includes('solar')) return 'energy_cert';
  if (lower.includes('tourism'))                          return 'tourism_license';
  if (lower.includes('nbc') || lower.includes('bank'))    return 'nbc_license';
  return 'other';
}

export async function uploadDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startupId } = req.params;
    const files = req.files as any[] | undefined;

    if (!files || files.length === 0) {
      error(res, 'No files received. Send files in the "documents" field.', 400); return;
    }

    const { rows: profileRows } = await db.query<{ id: string }>(
      'SELECT id FROM startup_profiles WHERE id = $1',
      [startupId]
    );
    if (profileRows.length === 0) { error(res, 'Startup profile not found.', 404); return; }

    const inserted: unknown[] = [];

    if (!isSupabaseConfigured) {
      // Placeholder mode — record metadata without real storage
      for (const file of files) {
        const docType        = inferDocumentType(file.originalname);
        const placeholderUrl = `/uploads/placeholder/${startupId}/${file.originalname}`;
        const { rows } = await db.query(
          `INSERT INTO verification_documents
             (startup_id, document_type, original_name, storage_path, public_url, mime_type, file_size_bytes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING id, original_name AS "originalName", document_type AS "documentType",
                     public_url AS "publicUrl", uploaded_at AS "uploadedAt"`,
          [startupId, docType, file.originalname, placeholderUrl, placeholderUrl, file.mimetype, file.size]
        );
        inserted.push(rows[0]);
      }

      await db.query(
        `UPDATE startup_profiles SET verification_status = 'Pending', verified_at = NULL, rejection_reason = NULL
         WHERE id = $1 AND verification_status = 'Rejected'`,
        [startupId]
      );

      success(res, {
        uploaded: inserted,
        count: inserted.length,
        note: 'Stored as placeholder — configure Supabase for real storage.',
      }, `${inserted.length} document(s) recorded.`, 201);
      return;
    }

    // Real Supabase upload
    const uploadResults = await Promise.all(
      files.map((file) =>
        storageService.uploadDocument({
          startupId: startupId!,
          buffer:       file.buffer,
          originalName: file.originalname,
          mimetype:     file.mimetype,
        })
      )
    );

    for (const result of uploadResults) {
      const docType  = inferDocumentType(result.originalName);
      const fileSize = files.find((f) => f.originalname === result.originalName)?.size ?? 0;
      const { rows } = await db.query(
        `INSERT INTO verification_documents
           (startup_id, document_type, original_name, storage_path, public_url, mime_type, file_size_bytes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, original_name AS "originalName", document_type AS "documentType",
                   public_url AS "publicUrl", uploaded_at AS "uploadedAt"`,
        [startupId, docType, result.originalName, result.storagePath, result.publicUrl, result.mimetype, fileSize]
      );
      inserted.push(rows[0]);
    }

    await db.query(
      `UPDATE startup_profiles SET verification_status = 'Pending', verified_at = NULL, rejection_reason = NULL
       WHERE id = $1 AND verification_status = 'Rejected'`,
      [startupId]
    );

    success(res, { uploaded: inserted, count: inserted.length }, `${inserted.length} document(s) uploaded.`, 201);
  } catch (err) { next(err); }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { documentId } = req.params;
    const { rows } = await db.query<{ id: string; storage_path: string; user_id: string }>(
      `SELECT vd.id, vd.storage_path, sp.user_id
       FROM verification_documents vd
       JOIN startup_profiles sp ON sp.id = vd.startup_id
       WHERE vd.id = $1`,
      [documentId]
    );

    if (rows.length === 0) { error(res, 'Document not found.', 404); return; }
    const doc = rows[0];

    if (req.user!.role !== 'admin' && doc.user_id !== req.user!.id) {
      error(res, 'Access denied.', 403); return;
    }

    if (isSupabaseConfigured && !doc.storage_path.startsWith('/uploads/placeholder/')) {
      await storageService.deleteDocument(doc.storage_path); // non-fatal
    }

    await db.query('DELETE FROM verification_documents WHERE id = $1', [documentId]);
    success(res, null, 'Document deleted.');
  } catch (err) { next(err); }
}
