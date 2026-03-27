// routes/tasks.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize, checkFirmAccess } from '../middleware/roleCheck.js';
import {
  validateTaskCreate,
  validateTaskUpdate,
  validateTaskStatusUpdate,
  validateTaskAssign,
  validateTaskQuery
} from '../middleware/validation.js';
import taskController from '../controllers/taskController.js';

const router = express.Router();

// ============================================
// TASKS ROUTES
// ============================================

/**
 * POST /api/tasks
 * Create a new task
 * 
 * Auth: Required
 * Body: { title, description?, client_id, module_id?, due_date, priority?, is_recurring?, recurrence_config? }
 * Response: 201 { task }
 */
router.post(
  '/',
  authenticate,
  validateTaskCreate,
  taskController.create
);

/**
 * GET /api/tasks
 * Get tasks with filters
 * 
 * Auth: Required
 * Query: { status?, priority?, client_id?, page?, limit?, sort_by?, sort_order?, search?, overdue? }
 * Response: 200 { tasks[], total, page, limit }
 */
router.get(
  '/',
  authenticate,
  validateTaskQuery,
  taskController.findByFilters
);

/**
 * GET /api/tasks/upcoming
 * Get upcoming tasks (due within specified days)
 * 
 * Auth: Required
 * Query: { days? }
 * Response: 200 { tasks[], total }
 */
router.get(
  '/upcoming',
  authenticate,
  taskController.getUpcoming
);

/**
 * GET /api/tasks/stats
 * Get task statistics for user's firm
 * 
 * Auth: Required
 * Response: 200 { total_tasks, pending_tasks, in_progress_tasks, completed_tasks, overdue_tasks, urgent_tasks, high_priority_tasks }
 */
router.get(
  '/stats',
  authenticate,
  taskController.getStats
);

/**
 * GET /api/tasks/:id
 * Get task by ID
 * 
 * Auth: Required
 * Response: 200 { task }
 */
router.get(
  '/:id',
  authenticate,
  taskController.findById
);

/**
 * PUT /api/tasks/:id
 * Update task details
 * 
 * Auth: Required
 * Body: { title?, description?, due_date?, priority?, is_recurring?, recurrence_config? }
 * Response: 200 { task }
 */
router.put(
  '/:id',
  authenticate,
  validateTaskUpdate,
  taskController.update
);

/**
 * PATCH /api/tasks/:id/status
 * Update task status
 * 
 * Auth: Required
 * Body: { status: "pending" | "in_progress" | "completed" | "cancelled" }
 * Response: 200 { task, nextTask? }
 * 
 * Note: If task is recurring and status is "completed", nextTask is returned
 */
router.patch(
  '/:id/status',
  authenticate,
  validateTaskStatusUpdate,
  taskController.updateStatus
);

/**
 * PUT /api/tasks/:id/assign
 * Assign task to a user
 * 
 * Auth: Required (owner or associated)
 * Body: { userId }
 * Response: 200 { message, task }
 */
router.put(
  '/:id/assign',
  authenticate,
  authorize('owner', 'associated'),
  validateTaskAssign,
  taskController.assign
);

/**
 * DELETE /api/tasks/:id
 * Delete a task
 * 
 * Auth: Required (owner only)
 * Response: 200 { message }
 */
router.delete(
  '/:id',
  authenticate,
  authorize('owner'),
  taskController.remove
);

// ============================================
// CLIENT TASKS ROUTES
// ============================================

/**
 * GET /api/clients/:clientId/tasks
 * Get tasks for a specific client
 * 
 * Auth: Required
 * Query: { status?, priority?, page?, limit? }
 * Response: 200 { tasks[], total, page, limit }
 */
router.get(
  '/client/:clientId',
  authenticate,
  taskController.findByClient
);

export default router;
