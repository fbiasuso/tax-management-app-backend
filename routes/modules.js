// routes/modules.js
import express from 'express';
import moduleController from '../controllers/moduleController.js';
import { validateModuleQuery } from '../middleware/validation.js';

const router = express.Router();

// ============================================
// MODULE ROUTES (PUBLIC - No Authentication)
// ============================================

// NOTE: Order matters! More specific routes must come before parameterized routes

// GET /api/modules - Get all modules with optional filters
// Public endpoint - no auth required
router.get('/', validateModuleQuery, moduleController.getAll);

// GET /api/modules/frequency/:frequency - Get modules by frequency
// Public endpoint - no auth required
router.get('/frequency/:frequency', moduleController.getByFrequency);

// GET /api/modules/:id/clients - Get clients assigned to a module
// MUST come before /:id route
// Public endpoint - no auth required
router.get('/:id/clients', moduleController.getAssignedClients);

// GET /api/modules/:id - Get module by ID with client count
// Public endpoint - no auth required
router.get('/:id', moduleController.getById);

export default router;
