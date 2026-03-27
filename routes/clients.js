// routes/clients.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize, checkFirmAccess } from '../middleware/roleCheck.js';
import {
  validateClientCreate,
  validateClientUpdate,
  validateClientQuery,
  validateModuleAssign
} from '../middleware/validation.js';
import clientController from '../controllers/clientController.js';

const router = express.Router();

// ============================================
// CLIENTS ROUTES
// ============================================

/**
 * POST /api/clients
 * Create a new client
 * 
 * Auth: Required
 * Body: { name, CUIT, address?, phone?, email?, category_id?, observations? }
 * Response: 201 { client }
 */
router.post(
  '/',
  authenticate,
  validateClientCreate,
  clientController.create
);

/**
 * GET /api/clients
 * Get all clients of the user's firm
 * 
 * Auth: Required
 * Query: { search?, category_id?, page?, limit? }
 * Response: 200 { clients[], total, page, limit }
 */
router.get(
  '/',
  authenticate,
  validateClientQuery,
  clientController.findByFirm
);

/**
 * GET /api/clients/:id
 * Get client details by ID
 * 
 * Auth: Required
 * Response: 200 { client with assignedModules, stats }
 */
router.get(
  '/:id',
  authenticate,
  clientController.findById
);

/**
 * PUT /api/clients/:id
 * Update client details
 * 
 * Auth: Required (owner, associated, member)
 * Body: { name?, address?, phone?, email?, category_id?, observations? }
 * Response: 200 { updated client }
 */
router.put(
  '/:id',
  authenticate,
  validateClientUpdate,
  clientController.update
);

/**
 * POST /api/clients/:id/deactivate
 * Deactivate a client (soft delete)
 * 
 * Auth: Required (owner or associated)
 * Response: 200 { message, clientId }
 */
router.post(
  '/:id/deactivate',
  authenticate,
  authorize('owner', 'associated'),
  clientController.deactivate
);

// ============================================
// CLIENT MODULES ROUTES
// ============================================

/**
 * GET /api/clients/:id/modules
 * Get all modules assigned to a client
 * 
 * Auth: Required
 * Response: 200 { clientId, clientName, modules[], total }
 */
router.get(
  '/:id/modules',
  authenticate,
  clientController.getModules
);

/**
 * PUT /api/clients/:id/modules
 * Assign a tax module to a client
 * 
 * Auth: Required (owner or associated)
 * Body: { moduleId, expirationDate? }
 * Response: 200 { message, client }
 */
router.put(
  '/:id/modules',
  authenticate,
  authorize('owner', 'associated'),
  validateModuleAssign,
  clientController.assignModule
);

/**
 * DELETE /api/clients/:id/modules/:moduleId
 * Unassign a tax module from a client
 * 
 * Auth: Required (owner or associated)
 * Response: 200 { message, client }
 */
router.delete(
  '/:id/modules/:moduleId',
  authenticate,
  authorize('owner', 'associated'),
  clientController.unassignModule
);

export default router;
