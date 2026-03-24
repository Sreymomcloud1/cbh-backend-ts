// src/routes/uploads.ts
import { Router } from 'express';
import * as ctrl  from '../controllers/uploadController';
import { authenticate }                   from '../middlewares/authenticate';
import { requireRole, ownStartupOnly }    from '../middlewares/rbac';
import { upload, handleUploadError }      from '../middlewares/upload';

const router = Router();

// POST /api/v1/uploads/documents/:startupId
// multipart/form-data, field name: "documents" (1–5 files)
router.post('/documents/:startupId',
  authenticate,
  requireRole('startup', 'admin'),
  ownStartupOnly,
  upload.array('documents', 5),
  handleUploadError,
  ctrl.uploadDocuments
);

// DELETE /api/v1/uploads/documents/:documentId
router.delete('/documents/:documentId',
  authenticate,
  requireRole('startup', 'admin'),
  ctrl.deleteDocument
);

export default router;
