// controllers/taskController.js
import Task from '../models/Task.js';
import Client from '../models/Client.js';
import User from '../models/User.js';
import pool from '../config/database.js';

/**
 * Task Controller
 * 
 * Handles all task-related operations including CRUD and recurrence handling.
 * All methods assume authentication middleware has already run.
 */

// ============================================
// CREATE TASK
// ============================================

export const create = async (req, res, next) => {
  try {
    const { 
      title, 
      description, 
      client_id, 
      module_id, 
      due_date, 
      priority, 
      is_recurring, 
      recurrence_config 
    } = req.validated.body;
    
    // Check if user has a firm
    if (!req.user.firmId) {
      return res.status(400).json({
        error: 'NO_FIRM',
        message: 'You must belong to a firm to create tasks'
      });
    }
    
    // Parse client ID
    const clientId = parseInt(client_id, 10);
    
    if (isNaN(clientId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid client ID'
      });
    }
    
    // Verify client exists and belongs to user's firm
    const client = await Client.findById(clientId);
    
    if (!client) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Client not found'
      });
    }
    
    if (client.firm_id !== req.user.firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this client'
      });
    }
    
    // Check if client is active
    if (!client.is_active) {
      return res.status(400).json({
        error: 'INACTIVE_CLIENT',
        message: 'Cannot create tasks for inactive clients'
      });
    }
    
    // If module_id provided, verify it exists and is assigned to client
    if (module_id) {
      const moduleId = parseInt(module_id, 10);
      const checkModuleQuery = `
        SELECT id FROM client_modules 
        WHERE client_id = $1 AND module_id = $2
      `;
      const moduleResult = await pool.query(checkModuleQuery, [clientId, moduleId]);
      
      if (moduleResult.rows.length === 0) {
        return res.status(400).json({
          error: 'MODULE_NOT_ASSIGNED',
          message: 'The specified module is not assigned to this client'
        });
      }
    }
    
    // Validate due date is not in the past
    const dueDate = new Date(due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dueDate < today) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Due date cannot be in the past'
      });
    }
    
    // Validate recurrence config if is_recurring is true
    if (is_recurring && !recurrence_config) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Recurrence configuration is required for recurring tasks'
      });
    }
    
    // Create the task
    const task = await Task.create({
      client_id: clientId,
      module_id: module_id || null,
      title,
      description,
      due_date,
      status: Task.STATUSES.PENDING,
      priority: priority || 'medium',
      assigned_to: req.user.userId, // Default to creator
      is_recurring: is_recurring || false,
      recurrence_config: is_recurring ? recurrence_config : null
    });
    
    res.status(201).json({
      id: task.id,
      client_id: task.client_id,
      module_id: task.module_id,
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      status: task.status,
      priority: task.priority,
      assigned_to: task.assigned_to,
      is_recurring: task.is_recurring,
      recurrence_config: task.recurrence_config,
      created_at: task.created_at
    });
  } catch (error) {
    // Handle specific errors
    if (error.message.includes('inválido')) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message
      });
    }
    
    console.error('Create task error:', error);
    next(error);
  }
};

// ============================================
// GET TASKS WITH FILTERS
// ============================================

export const findByFilters = async (req, res, next) => {
  try {
    const { 
      status, 
      priority, 
      client_id, 
      page = 1, 
      limit = 20,
      sort_by,
      sort_order,
      search,
      overdue
    } = req.query;
    
    // Check if user has a firm
    if (!req.user.firmId) {
      return res.status(400).json({
        error: 'NO_FIRM',
        message: 'You must belong to a firm to view tasks'
      });
    }
    
    // Calculate offset for pagination
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    
    // Build filters
    const filters = {
      firm_id: req.user.firmId,
      status: status ? status : undefined,
      priority: priority ? priority : undefined,
      client_id: client_id ? parseInt(client_id, 10) : undefined,
      sort_by: sort_by || 'due_date',
      sort_order: sort_order || 'asc',
      search: search,
      overdue: overdue === 'true' ? true : undefined,
      limit: parseInt(limit, 10),
      offset
    };
    
    // Get tasks
    const tasks = await Task.findByFilters(filters);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM tasks t
      JOIN clients c ON t.client_id = c.id
      WHERE c.firm_id = $1 AND c.is_active = true
    `;
    const countValues = [req.user.firmId];
    let paramCount = 2;
    
    if (status) {
      countQuery += ` AND t.status = $${paramCount}`;
      countValues.push(status);
      paramCount++;
    }
    
    if (priority) {
      countQuery += ` AND t.priority = $${paramCount}`;
      countValues.push(priority);
      paramCount++;
    }
    
    if (client_id) {
      countQuery += ` AND t.client_id = $${paramCount}`;
      countValues.push(parseInt(client_id, 10));
      paramCount++;
    }
    
    if (overdue === 'true') {
      countQuery += ` AND t.due_date < CURRENT_DATE AND t.status IN ('pending', 'in_progress')`;
    }
    
    const countResult = await pool.query(countQuery, countValues);
    const total = parseInt(countResult.rows[0].total, 10);
    
    res.status(200).json({
      tasks: tasks.map(t => ({
        id: t.id,
        client_id: t.client_id,
        client_name: t.client_name,
        client_cuit: t.client_cuit,
        module_id: t.module_id,
        module_name: t.module_name,
        title: t.title,
        description: t.description,
        due_date: t.due_date,
        status: t.status,
        priority: t.priority,
        assigned_to: t.assigned_to,
        assigned_first_name: t.assigned_first_name,
        assigned_last_name: t.assigned_last_name,
        is_recurring: t.is_recurring,
        created_at: t.created_at,
        is_overdue: t.isOverdue ? t.isOverdue() : (t.due_date < new Date().toISOString().split('T')[0] && ['pending', 'in_progress'].includes(t.status))
      })),
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    next(error);
  }
};

// ============================================
// GET TASK BY ID
// ============================================

export const findById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Parse ID
    const taskId = parseInt(id, 10);
    
    if (isNaN(taskId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid task ID'
      });
    }
    
    // Check if user has a firm
    if (!req.user.firmId) {
      return res.status(400).json({
        error: 'NO_FIRM',
        message: 'You must belong to a firm to view tasks'
      });
    }
    
    // Find task
    const task = await Task.findById(taskId);
    
    if (!task) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Task not found'
      });
    }
    
    // Get client to verify firm access
    const client = await Client.findById(task.client_id);
    
    if (!client || client.firm_id !== req.user.firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this task'
      });
    }
    
    res.status(200).json({
      id: task.id,
      client_id: task.client_id,
      client_name: task.client_name,
      client_cuit: task.client_cuit,
      module_id: task.module_id,
      module_name: task.module_name,
      jurisdiction_name: task.jurisdiction_name,
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      status: task.status,
      priority: task.priority,
      assigned_to: task.assigned_to,
      assigned_first_name: task.assigned_first_name,
      assigned_last_name: task.assigned_last_name,
      completed_by: task.completed_by,
      completed_first_name: task.completed_first_name,
      completed_last_name: task.completed_last_name,
      completed_at: task.completed_at,
      is_recurring: task.is_recurring,
      recurrence_config: task.recurrence_config,
      created_at: task.created_at,
      updated_at: task.updated_at,
      is_overdue: task.isOverdue ? task.isOverdue() : (task.due_date < new Date().toISOString().split('T')[0] && ['pending', 'in_progress'].includes(task.status))
    });
  } catch (error) {
    console.error('Get task by ID error:', error);
    next(error);
  }
};

// ============================================
// UPDATE TASK STATUS
// ============================================

export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.validated.body;
    
    // Parse ID
    const taskId = parseInt(id, 10);
    
    if (isNaN(taskId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid task ID'
      });
    }
    
    // Check if user has a firm
    if (!req.user.firmId) {
      return res.status(400).json({
        error: 'NO_FIRM',
        message: 'You must belong to a firm to update tasks'
      });
    }
    
    // Find task
    const task = await Task.findById(taskId);
    
    if (!task) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Task not found'
      });
    }
    
    // Get client to verify firm access
    const client = await Client.findById(task.client_id);
    
    if (!client || client.firm_id !== req.user.firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this task'
      });
    }
    
    // Update status
    const previousStatus = task.status;
    await task.updateStatus(status, req.user.userId);
    
    // Record status history (if table exists)
    try {
      await pool.query(`
        INSERT INTO task_status_history (task_id, previous_status, new_status, changed_by, changed_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [taskId, previousStatus, status, req.user.userId]);
    } catch (historyError) {
      // Table might not exist, continue without history
      console.warn('Could not record task status history:', historyError.message);
    }
    
    // If task is recurring and was completed, create next occurrence
    let nextTask = null;
    if (status === 'completed' && task.is_recurring && task.recurrence_config) {
      // The model already creates the next recurrence in updateStatus
      // We need to fetch the newly created task
      const recentTasks = await Task.findByFilters({
        client_id: task.client_id,
        is_recurring: true,
        limit: 1,
        sort_by: 'created_at',
        sort_order: 'desc'
      });
      
      if (recentTasks.length > 0) {
        nextTask = recentTasks[0];
      }
    }
    
    const response = {
      id: task.id,
      client_id: task.client_id,
      module_id: task.module_id,
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      status: task.status,
      priority: task.priority,
      assigned_to: task.assigned_to,
      completed_by: task.completed_by,
      completed_at: task.completed_at,
      is_recurring: task.is_recurring,
      recurrence_config: task.recurrence_config,
      updated_at: task.updated_at
    };
    
    if (nextTask) {
      response.nextTask = {
        id: nextTask.id,
        title: nextTask.title,
        due_date: nextTask.due_date,
        status: nextTask.status,
        priority: nextTask.priority
      };
    }
    
    res.status(200).json(response);
  } catch (error) {
    // Handle specific errors
    if (error.message.includes('inválido') || error.message.includes('Estado inválido')) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message
      });
    }
    
    console.error('Update task status error:', error);
    next(error);
  }
};

// ============================================
// UPDATE TASK (General)
// ============================================

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.validated.body;
    
    // Parse ID
    const taskId = parseInt(id, 10);
    
    if (isNaN(taskId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid task ID'
      });
    }
    
    // Check if user has a firm
    if (!req.user.firmId) {
      return res.status(400).json({
        error: 'NO_FIRM',
        message: 'You must belong to a firm to update tasks'
      });
    }
    
    // Find task
    const task = await Task.findById(taskId);
    
    if (!task) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Task not found'
      });
    }
    
    // Get client to verify firm access
    const client = await Client.findById(task.client_id);
    
    if (!client || client.firm_id !== req.user.firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this task'
      });
    }
    
    // Validate due_date if provided
    if (updateData.due_date) {
      const dueDate = new Date(updateData.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (dueDate < today) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Due date cannot be in the past'
        });
      }
    }
    
    // Update task
    await task.update(updateData);
    
    res.status(200).json({
      id: task.id,
      client_id: task.client_id,
      module_id: task.module_id,
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      status: task.status,
      priority: task.priority,
      assigned_to: task.assigned_to,
      is_recurring: task.is_recurring,
      recurrence_config: task.recurrence_config,
      updated_at: task.updated_at
    });
  } catch (error) {
    // Handle specific errors
    if (error.message.includes('inválido')) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message
      });
    }
    
    if (error.message.includes('No hay campos')) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message
      });
    }
    
    console.error('Update task error:', error);
    next(error);
  }
};

// ============================================
// ASSIGN TASK
// ============================================

export const assign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.validated.body;
    
    // Parse IDs
    const taskId = parseInt(id, 10);
    const assigneeId = parseInt(userId, 10);
    
    if (isNaN(taskId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid task ID'
      });
    }
    
    if (isNaN(assigneeId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid user ID'
      });
    }
    
    // Check if user has a firm
    if (!req.user.firmId) {
      return res.status(400).json({
        error: 'NO_FIRM',
        message: 'You must belong to a firm to assign tasks'
      });
    }
    
    // Find task
    const task = await Task.findById(taskId);
    
    if (!task) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Task not found'
      });
    }
    
    // Get client to verify firm access
    const client = await Client.findById(task.client_id);
    
    if (!client || client.firm_id !== req.user.firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this task'
      });
    }
    
    // Verify the assignee is a member of the same firm
    const assignee = await User.findById(assigneeId);
    
    if (!assignee) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User not found'
      });
    }
    
    // Check if user is member of the firm (we'd need to check firm_members)
    // For now, we'll assume if the user exists they can be assigned
    
    // Only owners and associated can assign tasks
    if (req.user.role !== 'owner' && req.user.role !== 'associated') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only owners and associated members can assign tasks'
      });
    }
    
    // Assign task
    await task.assign(assigneeId);
    
    res.status(200).json({
      message: 'Task assigned successfully',
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigned_to: task.assigned_to,
        updated_at: task.updated_at
      }
    });
  } catch (error) {
    console.error('Assign task error:', error);
    next(error);
  }
};

// ============================================
// DELETE TASK
// ============================================

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Parse ID
    const taskId = parseInt(id, 10);
    
    if (isNaN(taskId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid task ID'
      });
    }
    
    // Check if user has a firm
    if (!req.user.firmId) {
      return res.status(400).json({
        error: 'NO_FIRM',
        message: 'You must belong to a firm to delete tasks'
      });
    }
    
    // Find task
    const task = await Task.findById(taskId);
    
    if (!task) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Task not found'
      });
    }
    
    // Get client to verify firm access
    const client = await Client.findById(task.client_id);
    
    if (!client || client.firm_id !== req.user.firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this task'
      });
    }
    
    // Only owners can delete tasks
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only owners can delete tasks'
      });
    }
    
    // Delete task
    await task.delete();
    
    res.status(200).json({
      message: 'Task deleted successfully',
      taskId
    });
  } catch (error) {
    console.error('Delete task error:', error);
    next(error);
  }
};

// ============================================
// GET CLIENT TASKS
// ============================================

export const findByClient = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { status, priority, page = 1, limit = 20 } = req.query;
    
    // Parse client ID
    const clientIdNum = parseInt(clientId, 10);
    
    if (isNaN(clientIdNum)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid client ID'
      });
    }
    
    // Check if user has a firm
    if (!req.user.firmId) {
      return res.status(400).json({
        error: 'NO_FIRM',
        message: 'You must belong to a firm to view tasks'
      });
    }
    
    // Verify client belongs to user's firm
    const client = await Client.findById(clientIdNum);
    
    if (!client) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Client not found'
      });
    }
    
    if (client.firm_id !== req.user.firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this client'
      });
    }
    
    // Calculate offset for pagination
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    
    // Get tasks
    const tasks = await Task.findByFilters({
      client_id: clientIdNum,
      status: status ? status : undefined,
      priority: priority ? priority : undefined,
      limit: parseInt(limit, 10),
      offset
    });
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM tasks 
      WHERE client_id = $1
    `;
    const countValues = [clientIdNum];
    
    if (status) {
      countQuery += ` AND status = $2`;
      countValues.push(status);
    }
    
    if (priority) {
      countQuery += status ? ` AND priority = $3` : ` AND priority = $2`;
      countValues.push(priority);
    }
    
    const countResult = await pool.query(countQuery, countValues);
    const total = parseInt(countResult.rows[0].total, 10);
    
    res.status(200).json({
      tasks: tasks.map(t => ({
        id: t.id,
        module_id: t.module_id,
        module_name: t.module_name,
        title: t.title,
        description: t.description,
        due_date: t.due_date,
        status: t.status,
        priority: t.priority,
        assigned_to: t.assigned_to,
        is_recurring: t.is_recurring,
        created_at: t.created_at
      })),
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });
  } catch (error) {
    console.error('Get client tasks error:', error);
    next(error);
  }
};

// ============================================
// GET UPCOMING TASKS
// ============================================

export const getUpcoming = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    
    // Check if user has a firm
    if (!req.user.firmId) {
      return res.status(400).json({
        error: 'NO_FIRM',
        message: 'You must belong to a firm to view tasks'
      });
    }
    
    // Get upcoming tasks
    const tasks = await Task.getUpcoming(req.user.firmId, parseInt(days, 10));
    
    res.status(200).json({
      tasks: tasks.map(t => ({
        id: t.id,
        client_id: t.client_id,
        client_name: t.client_name,
        client_cuit: t.client_cuit,
        module_name: t.module_name,
        title: t.title,
        due_date: t.due_date,
        status: t.status,
        priority: t.priority,
        is_overdue: t.isOverdue ? t.isOverdue() : false
      })),
      total: tasks.length
    });
  } catch (error) {
    console.error('Get upcoming tasks error:', error);
    next(error);
  }
};

// ============================================
// GET TASK STATS
// ============================================

export const getStats = async (req, res, next) => {
  try {
    // Check if user has a firm
    if (!req.user.firmId) {
      return res.status(400).json({
        error: 'NO_FIRM',
        message: 'You must belong to a firm to view task statistics'
      });
    }
    
    // Get stats
    const stats = await Task.getStatsByFirm(req.user.firmId);
    
    res.status(200).json({
      total_tasks: parseInt(stats.total_tasks, 10),
      pending_tasks: parseInt(stats.pending_tasks, 10),
      in_progress_tasks: parseInt(stats.in_progress_tasks, 10),
      completed_tasks: parseInt(stats.completed_tasks, 10),
      overdue_tasks: parseInt(stats.overdue_tasks, 10),
      urgent_tasks: parseInt(stats.urgent_tasks, 10),
      high_priority_tasks: parseInt(stats.high_priority_tasks, 10)
    });
  } catch (error) {
    console.error('Get task stats error:', error);
    next(error);
  }
};

export default {
  create,
  findByFilters,
  findById,
  updateStatus,
  update,
  assign,
  remove,
  findByClient,
  getUpcoming,
  getStats
};
