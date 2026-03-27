// routes/jurisdictions.js
import express from 'express';
import moduleController from '../controllers/moduleController.js';

const router = express.Router();

// ============================================
// JURISDICTION ROUTES (PUBLIC - No Authentication)
// ============================================

// GET /api/jurisdictions - Get all jurisdictions
// Public endpoint - no auth required
router.get('/', moduleController.getJurisdictions);

// GET /api/jurisdictions/:id - Get jurisdiction by ID with stats
// Public endpoint - no auth required
router.get('/:id', moduleController.getJurisdictionById);

// GET /api/jurisdictions/:id/modules - Get modules for a jurisdiction
// Public endpoint - no auth required
router.get('/:id/modules', moduleController.getByJurisdiction);

export default router;
