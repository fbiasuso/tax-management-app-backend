// controllers/clientController.js
import Client from '../models/Client.js';
import TaxModule from '../models/TaxModule.js';
import pool from '../config/database.js';

/**
 * Client Controller
 * 
 * Handles all client-related operations including CRUD and module assignment.
 * All methods assume authentication middleware has already run.
 */

// ============================================
// CREATE CLIENT
// ============================================

export const create = async (req, res, next) => {
  try {
    const { name, CUIT, address, phone, email, category_id, observations } = req.validated.body;
    
    // Check if user has a firm
    if (!req.user.firmId) {
      return res.status(400).json({
        error: 'NO_FIRM',
        message: 'You must belong to a firm to create clients'
      });
    }
    
    // Check for duplicate CUIT in the same firm
    const existingClientQuery = `
      SELECT id FROM clients 
      WHERE firm_id = $1 AND CUIT = $2 AND is_active = true
    `;
    const existingResult = await pool.query(existingClientQuery, [req.user.firmId, CUIT]);
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: 'DUPLICATE_CUIT',
        message: 'A client with this CUIT already exists in your firm'
      });
    }
    
    // Create the client
    const client = await Client.create({
      firm_id: req.user.firmId,
      name,
      CUIT,
      address,
      phone,
      email,
      category_id
    });
    
    res.status(201).json(client);
  } catch (error) {
    // Handle specific errors
    if (error.message.includes('inválido')) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message
      });
    }
    
    console.error('Create client error:', error);
    next(error);
  }
};

// ============================================
// GET CLIENTS BY FIRM
// ============================================

export const findByFirm = async (req, res, next) => {
  try {
    const { search, category_id, page = 1, limit = 20 } = req.query;
    
    // Check if user has a firm
    if (!req.user.firmId) {
      return res.status(400).json({
        error: 'NO_FIRM',
        message: 'You must belong to a firm to view clients'
      });
    }
    
    // Calculate offset for pagination
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    
    // Get clients
    const clients = await Client.findByFirm(req.user.firmId, {
      search,
      category_id: category_id ? parseInt(category_id, 10) : undefined,
      limit: parseInt(limit, 10),
      offset
    });
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM clients 
      WHERE firm_id = $1 AND is_active = true
    `;
    const countResult = await pool.query(countQuery, [req.user.firmId]);
    const total = parseInt(countResult.rows[0].total, 10);
    
    res.status(200).json({
      clients: clients.map(c => ({
        id: c.id,
        name: c.name,
        CUIT: c.CUIT,
        address: c.address,
        phone: c.phone,
        email: c.email,
        is_active: c.is_active,
        category_name: c.category_name,
        modules_count: parseInt(c.modules_count, 10) || 0,
        created_at: c.created_at
      })),
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });
  } catch (error) {
    console.error('Get clients error:', error);
    next(error);
  }
};

// ============================================
// GET CLIENT BY ID
// ============================================

export const findById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Parse ID
    const clientId = parseInt(id, 10);
    
    if (isNaN(clientId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid client ID'
      });
    }
    
    // Find client
    const client = await Client.findById(clientId);
    
    if (!client) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Client not found'
      });
    }
    
    // Check if client belongs to user's firm
    if (client.firm_id !== req.user.firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this client'
      });
    }
    
    // Get assigned modules
    const modules = await client.getModules();
    
    // Get stats
    const stats = await client.getStats();
    
    res.status(200).json({
      id: client.id,
      firm_id: client.firm_id,
      name: client.name,
      CUIT: client.CUIT,
      address: client.address,
      phone: client.phone,
      email: client.email,
      category_id: client.category_id,
      category_name: client.category_name,
      is_active: client.is_active,
      created_at: client.created_at,
      updated_at: client.updated_at,
      assignedModules: modules.map(m => ({
        moduleId: m.id,
        name: m.name,
        code: m.code,
        jurisdiction: m.jurisdiction_name,
        frequency: m.frequency,
        due_day: m.due_day,
        assigned_at: m.assigned_at
      })),
      stats: {
        total_tasks: parseInt(stats.total_tasks, 10),
        pending_tasks: parseInt(stats.pending_tasks, 10),
        completed_tasks: parseInt(stats.completed_tasks, 10),
        overdue_tasks: parseInt(stats.overdue_tasks, 10),
        assigned_modules: parseInt(stats.assigned_modules, 10)
      }
    });
  } catch (error) {
    console.error('Get client by ID error:', error);
    next(error);
  }
};

// ============================================
// UPDATE CLIENT
// ============================================

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.validated.body;
    
    // Parse ID
    const clientId = parseInt(id, 10);
    
    if (isNaN(clientId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid client ID'
      });
    }
    
    // Find client
    const client = await Client.findById(clientId);
    
    if (!client) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Client not found'
      });
    }
    
    // Check if client belongs to user's firm
    if (client.firm_id !== req.user.firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this client'
      });
    }
    
    // Check for duplicate CUIT if being updated
    if (updateData.CUIT && updateData.CUIT !== client.CUIT) {
      const existingClientQuery = `
        SELECT id FROM clients 
        WHERE firm_id = $1 AND CUIT = $2 AND id != $3 AND is_active = true
      `;
      const existingResult = await pool.query(existingClientQuery, [req.user.firmId, updateData.CUIT, clientId]);
      
      if (existingResult.rows.length > 0) {
        return res.status(409).json({
          error: 'DUPLICATE_CUIT',
          message: 'A client with this CUIT already exists in your firm'
        });
      }
    }
    
    // Update client
    await client.update(updateData);
    
    // Get updated modules
    const modules = await client.getModules();
    
    res.status(200).json({
      ...client,
      assignedModules: modules.map(m => ({
        moduleId: m.id,
        name: m.name,
        jurisdiction: m.jurisdiction_name
      }))
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
    
    console.error('Update client error:', error);
    next(error);
  }
};

// ============================================
// DEACTIVATE CLIENT
// ============================================

export const deactivate = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Parse ID
    const clientId = parseInt(id, 10);
    
    if (isNaN(clientId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid client ID'
      });
    }
    
    // Find client
    const client = await Client.findById(clientId);
    
    if (!client) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Client not found'
      });
    }
    
    // Check if client belongs to user's firm
    if (client.firm_id !== req.user.firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this client'
      });
    }
    
    // Only owners and associated can deactivate clients
    if (req.user.role !== 'owner' && req.user.role !== 'associated') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only owners and associated members can deactivate clients'
      });
    }
    
    // Use transaction to deactivate client and cancel active tasks
    const clientConn = await pool.connect();
    
    try {
      await clientConn.query('BEGIN');
      
      // Deactivate the client
      await clientConn.query(
        'UPDATE clients SET is_active = false, updated_at = NOW() WHERE id = $1',
        [clientId]
      );
      
      // Cancel all active tasks for this client
      await clientConn.query(`
        UPDATE tasks 
        SET status = 'cancelled', updated_at = NOW() 
        WHERE client_id = $1 AND status IN ('pending', 'in_progress')
      `, [clientId]);
      
      await clientConn.query('COMMIT');
      
      res.status(200).json({
        message: 'Client deactivated successfully',
        clientId,
        cancelledTasksMessage: 'All active tasks have been cancelled'
      });
    } catch (error) {
      await clientConn.query('ROLLBACK');
      throw error;
    } finally {
      clientConn.release();
    }
  } catch (error) {
    console.error('Deactivate client error:', error);
    next(error);
  }
};

// ============================================
// ASSIGN MODULE
// ============================================

export const assignModule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { moduleId, expirationDate } = req.validated.body;
    
    // Parse IDs
    const clientId = parseInt(id, 10);
    const taxModuleId = parseInt(moduleId, 10);
    
    if (isNaN(clientId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid client ID'
      });
    }
    
    if (isNaN(taxModuleId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid module ID'
      });
    }
    
    // Find client
    const client = await Client.findById(clientId);
    
    if (!client) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Client not found'
      });
    }
    
    // Check if client belongs to user's firm
    if (client.firm_id !== req.user.firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this client'
      });
    }
    
    // Check if module exists
    const taxModule = await TaxModule.findById(taxModuleId);
    
    if (!taxModule) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Tax module not found'
      });
    }
    
    // Check if module is already assigned
    const checkQuery = `
      SELECT id FROM client_modules 
      WHERE client_id = $1 AND module_id = $2
    `;
    const checkResult = await pool.query(checkQuery, [clientId, taxModuleId]);
    
    if (checkResult.rows.length > 0) {
      return res.status(409).json({
        error: 'DUPLICATE_MODULE',
        message: 'This module is already assigned to the client'
      });
    }
    
    // Assign module
    await client.assignModule(taxModuleId);
    
    // Get updated client with modules
    const modules = await client.getModules();
    
    res.status(200).json({
      message: 'Module assigned successfully',
      client: {
        id: client.id,
        name: client.name,
        CUIT: client.CUIT,
        assignedModules: modules.map(m => ({
          moduleId: m.id,
          name: m.name,
          jurisdiction: m.jurisdiction_name,
          frequency: m.frequency
        }))
      }
    });
  } catch (error) {
    console.error('Assign module error:', error);
    next(error);
  }
};

// ============================================
// UNASSIGN MODULE
// ============================================

export const unassignModule = async (req, res, next) => {
  try {
    const { id, moduleId } = req.params;
    
    // Parse IDs
    const clientId = parseInt(id, 10);
    const taxModuleId = parseInt(moduleId, 10);
    
    if (isNaN(clientId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid client ID'
      });
    }
    
    if (isNaN(taxModuleId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid module ID'
      });
    }
    
    // Find client
    const client = await Client.findById(clientId);
    
    if (!client) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Client not found'
      });
    }
    
    // Check if client belongs to user's firm
    if (client.firm_id !== req.user.firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this client'
      });
    }
    
    // Unassign module
    const removed = await client.unassignModule(taxModuleId);
    
    if (!removed) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Module assignment not found'
      });
    }
    
    // Get updated client with modules
    const modules = await client.getModules();
    
    res.status(200).json({
      message: 'Module unassigned successfully',
      client: {
        id: client.id,
        name: client.name,
        CUIT: client.CUIT,
        assignedModules: modules.map(m => ({
          moduleId: m.id,
          name: m.name,
          jurisdiction: m.jurisdiction_name
        }))
      }
    });
  } catch (error) {
    console.error('Unassign module error:', error);
    next(error);
  }
};

// ============================================
// GET CLIENT MODULES
// ============================================

export const getModules = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Parse ID
    const clientId = parseInt(id, 10);
    
    if (isNaN(clientId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid client ID'
      });
    }
    
    // Find client
    const client = await Client.findById(clientId);
    
    if (!client) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Client not found'
      });
    }
    
    // Check if client belongs to user's firm
    if (client.firm_id !== req.user.firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this client'
      });
    }
    
    // Get modules
    const modules = await client.getModules();
    
    res.status(200).json({
      clientId: client.id,
      clientName: client.name,
      modules: modules.map(m => ({
        moduleId: m.id,
        name: m.name,
        code: m.code,
        jurisdiction: m.jurisdiction_name,
        frequency: m.frequency,
        due_day: m.due_day,
        assigned_at: m.assigned_at
      })),
      total: modules.length
    });
  } catch (error) {
    console.error('Get client modules error:', error);
    next(error);
  }
};

export default {
  create,
  findByFirm,
  findById,
  update,
  deactivate,
  assignModule,
  unassignModule,
  getModules
};
