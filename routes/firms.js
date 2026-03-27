// routes/firms.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize, checkFirmAccess } from '../middleware/roleCheck.js';
import {
  validateFirmCreate,
  validateFirmUpdate,
  validateFirmMemberAdd,
  validateFirmQuery
} from '../middleware/validation.js';
import firmController from '../controllers/firmController.js';

const router = express.Router();

// ============================================
// FIRMS ROUTES
// ============================================

/**
 * POST /api/firms
 * Create a new firm
 * 
 * Auth: Required
 * Body: { name, address?, phone?, email?, cuit? }
 * Response: 201 { firm }
 * 
 * Note: This is a special case - users without a firm can create one
 */
router.post(
  '/',
  authenticate,
  validateFirmCreate,
  firmController.create
);

/**
 * GET /api/firms
 * Get user's firm(s)
 * 
 * Auth: Required
 * Response: 200 { firms[], total, page, limit }
 */
router.get(
  '/',
  authenticate,
  validateFirmQuery,
  firmController.findAll
);

/**
 * GET /api/firms/:id
 * Get firm details by ID
 * 
 * Auth: Required
 * Response: 200 { firm with members, clients, stats }
 */
router.get(
  '/:id',
  authenticate,
  checkFirmAccess,
  firmController.findById
);

/**
 * PUT /api/firms/:id
 * Update firm details
 * 
 * Auth: Required (owner or associated)
 * Body: { name?, address?, phone?, email?, cuit? }
 * Response: 200 { updated firm }
 */
router.put(
  '/:id',
  authenticate,
  checkFirmAccess,
  authorize('owner', 'associated'),
  validateFirmUpdate,
  firmController.update
);

/**
 * DELETE /api/firms/:id
 * Soft-delete a firm
 * 
 * Auth: Required (owner only)
 * Response: 200 { message }
 */
router.delete(
  '/:id',
  authenticate,
  checkFirmAccess,
  authorize('owner'),
  firmController.remove
);

// ============================================
// FIRM MEMBERS ROUTES
// ============================================

/**
 * GET /api/firms/:id/members
 * Get all members of a firm
 * 
 * Auth: Required (firm member)
 * Response: 200 { members[], total }
 */
router.get(
  '/:id/members',
  authenticate,
  checkFirmAccess,
  firmController.getMembers
);

/**
 * POST /api/firms/:id/members
 * Add a new member to the firm
 * 
 * Auth: Required (owner or associated)
 * Body: { userId, role }
 * Response: 201 { member }
 */
router.post(
  '/:id/members',
  authenticate,
  checkFirmAccess,
  authorize('owner', 'associated'),
  validateFirmMemberAdd,
  firmController.addMember
);

/**
 * DELETE /api/firms/:id/members/:memberId
 * Remove a member from the firm
 * 
 * Auth: Required (owner only)
 * Response: 200 { message }
 */
router.delete(
  '/:id/members/:memberId',
  authenticate,
  checkFirmAccess,
  authorize('owner'),
  firmController.removeMember
);

// ============================================
// FIRM CLIENTS ROUTES
// ============================================

/**
 * GET /api/firms/:id/clients
 * Get all clients of a firm
 * 
 * Auth: Required (firm member)
 * Query: { search?, category_id?, page?, limit? }
 * Response: 200 { clients[], total, page, limit }
 */
router.get(
  '/:id/clients',
  authenticate,
  checkFirmAccess,
  firmController.getClients
);

// ============================================
// FIRM STATS ROUTES
// ============================================

/**
 * GET /api/firms/:id/stats
 * Get firm statistics
 * 
 * Auth: Required (firm member)
 * Response: 200 { total_clients, total_members, pending_tasks, overdue_tasks }
 */
router.get(
  '/:id/stats',
  authenticate,
  checkFirmAccess,
  firmController.getStats
);

export default router;
