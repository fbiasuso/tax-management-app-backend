// controllers/firmController.js
import Firm from '../models/Firm.js';
import User from '../models/User.js';
import Client from '../models/Client.js';
import pool from '../config/database.js';

/**
 * Firm Controller
 * 
 * Handles all firm-related operations including CRUD and member management.
 * All methods assume authentication middleware has already run.
 */

// ============================================
// CREATE FIRM
// ============================================

export const create = async (req, res, next) => {
  try {
    const { name, address, phone, email, cuit } = req.validated.body;
    
    // Check if user already belongs to a firm
    if (req.user.firmId) {
      return res.status(400).json({
        error: 'ALREADY_HAS_FIRM',
        message: 'You already belong to a firm. Leave your current firm first.'
      });
    }
    
    // Create the firm
    const firm = await Firm.create({
      name,
      address,
      phone,
      email,
      cuid
    }, req.user.userId);
    
    // Update user's firm association in the request for consistency
    req.user.firmId = firm.id;
    req.user.role = 'owner';
    
    res.status(201).json(firm);
  } catch (error) {
    // Handle specific errors
    if (error.message.includes('inválido')) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message
      });
    }
    
    console.error('Create firm error:', error);
    next(error);
  }
};

// ============================================
// GET FIRMS (List user's firms)
// ============================================

export const findAll = async (req, res, next) => {
  try {
    // If user has a firm, return it
    if (req.user.firmId) {
      const firm = await Firm.findById(req.user.firmId);
      
      if (firm) {
        const members = await firm.getMembers();
        const stats = await firm.getStats();
        
        return res.status(200).json({
          firms: [{
            ...firm,
            members,
            stats
          }],
          total: 1,
          page: 1,
          limit: 20
        });
      }
    }
    
    // If user has no firm, return empty list
    res.status(200).json({
      firms: [],
      total: 0,
      page: 1,
      limit: 20
    });
  } catch (error) {
    console.error('Get firms error:', error);
    next(error);
  }
};

// ============================================
// GET FIRM BY ID
// ============================================

export const findById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Parse ID
    const firmId = parseInt(id, 10);
    
    if (isNaN(firmId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid firm ID'
      });
    }
    
    // Check if user has access to this firm
    if (req.user.firmId !== firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this firm\'s resources'
      });
    }
    
    // Find firm
    const firm = await Firm.findById(firmId);
    
    if (!firm) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Firm not found'
      });
    }
    
    // Get members
    const members = await firm.getMembers();
    
    // Get clients (basic info)
    const clients = await firm.getClients({ limit: 100 });
    
    // Get stats
    const stats = await firm.getStats();
    
    res.status(200).json({
      ...firm,
      members,
      clients: clients.map(c => ({
        id: c.id,
        name: c.name,
       CUIT: c.CUIT,
        is_active: c.is_active,
        modules_count: parseInt(c.modules_count, 10)
      })),
      stats
    });
  } catch (error) {
    console.error('Get firm by ID error:', error);
    next(error);
  }
};

// ============================================
// UPDATE FIRM
// ============================================

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.validated.body;
    
    // Parse ID
    const firmId = parseInt(id, 10);
    
    if (isNaN(firmId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid firm ID'
      });
    }
    
    // Check if user has access to this firm
    if (req.user.firmId !== firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this firm\'s resources'
      });
    }
    
    // Check if user has permission to update (owner or associated)
    if (req.user.role !== 'owner' && req.user.role !== 'associated') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only owners and associated members can update firm details'
      });
    }
    
    // Find firm
    const firm = await Firm.findById(firmId);
    
    if (!firm) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Firm not found'
      });
    }
    
    // Update firm
    await firm.update(updateData);
    
    // Get updated members
    const members = await firm.getMembers();
    
    res.status(200).json({
      ...firm,
      members
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
    
    console.error('Update firm error:', error);
    next(error);
  }
};

// ============================================
// DELETE FIRM (Soft delete)
// ============================================

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Parse ID
    const firmId = parseInt(id, 10);
    
    if (isNaN(firmId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid firm ID'
      });
    }
    
    // Check if user has access to this firm
    if (req.user.firmId !== firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this firm\'s resources'
      });
    }
    
    // Only owners can delete
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only owners can delete a firm'
      });
    }
    
    // Find firm
    const firm = await Firm.findById(firmId);
    
    if (!firm) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Firm not found'
      });
    }
    
    // Use transaction to soft-delete firm and deactivate clients/tasks
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Soft-delete the firm
      await client.query(
        'UPDATE accounting_firms SET is_active = false, updated_at = NOW() WHERE id = $1',
        [firmId]
      );
      
      // Deactivate all clients
      await client.query(
        'UPDATE clients SET is_active = false, updated_at = NOW() WHERE firm_id = $1',
        [firmId]
      );
      
      // Cancel all active tasks
      await client.query(`
        UPDATE tasks 
        SET status = 'cancelled', updated_at = NOW() 
        WHERE client_id IN (SELECT id FROM clients WHERE firm_id = $1) 
        AND status = 'pending'
      `, [firmId]);
      
      await client.query('COMMIT');
      
      res.status(200).json({
        message: 'Firm deleted successfully',
        firmId
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Delete firm error:', error);
    next(error);
  }
};

// ============================================
// ADD MEMBER
// ============================================

export const addMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.validated.body;
    
    // Parse firm ID
    const firmId = parseInt(id, 10);
    
    if (isNaN(firmId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid firm ID'
      });
    }
    
    // Check if user has access to this firm
    if (req.user.firmId !== firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this firm\'s resources'
      });
    }
    
    // Only owners and associated can add members
    if (req.user.role !== 'owner' && req.user.role !== 'associated') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only owners and associated members can add new members'
      });
    }
    
    // Check if firm exists
    const firm = await Firm.findById(firmId);
    
    if (!firm) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Firm not found'
      });
    }
    
    // Check if user exists
    const userToAdd = await User.findById(userId);
    
    if (!userToAdd) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User not found'
      });
    }
    
    // Add member to firm
    const member = await firm.addMember(userId, role);
    
    // Get full member info
    const members = await firm.getMembers();
    const newMember = members.find(m => m.id === userId);
    
    res.status(201).json({
      message: 'Member added successfully',
      member: newMember || {
        id: userId,
        email: userToAdd.email,
        first_name: userToAdd.first_name,
        last_name: userToAdd.last_name,
        role
      }
    });
  } catch (error) {
    // Handle specific errors
    if (error.message.includes('inválido')) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message
      });
    }
    
    if (error.message.includes('already exists') || error.message.includes('ya es miembro')) {
      return res.status(409).json({
        error: 'DUPLICATE_MEMBER',
        message: 'User is already a member of this firm'
      });
    }
    
    console.error('Add member error:', error);
    next(error);
  }
};

// ============================================
// REMOVE MEMBER
// ============================================

export const removeMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    
    // Parse IDs
    const firmId = parseInt(id, 10);
    const userIdToRemove = parseInt(memberId, 10);
    
    if (isNaN(firmId) || isNaN(userIdToRemove)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid ID format'
      });
    }
    
    // Check if user has access to this firm
    if (req.user.firmId !== firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this firm\'s resources'
      });
    }
    
    // Only owners can remove members
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only owners can remove members'
      });
    }
    
    // Check if firm exists
    const firm = await Firm.findById(firmId);
    
    if (!firm) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Firm not found'
      });
    }
    
    // Cannot remove yourself
    if (userIdToRemove === req.user.userId) {
      return res.status(400).json({
        error: 'CANNOT_REMOVE_SELF',
        message: 'Cannot remove yourself as the only owner'
      });
    }
    
    // Remove member
    await firm.removeMember(userIdToRemove);
    
    res.status(200).json({
      message: 'Member removed successfully',
      userId: userIdToRemove
    });
  } catch (error) {
    // Handle specific errors
    if (error.message.includes('No se puede remover al propietario')) {
      return res.status(400).json({
        error: 'CANNOT_REMOVE_OWNER',
        message: error.message
      });
    }
    
    if (error.message.includes('no es miembro')) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: error.message
      });
    }
    
    console.error('Remove member error:', error);
    next(error);
  }
};

// ============================================
// GET FIRM MEMBERS
// ============================================

export const getMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Parse ID
    const firmId = parseInt(id, 10);
    
    if (isNaN(firmId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid firm ID'
      });
    }
    
    // Check if user has access to this firm
    if (req.user.firmId !== firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this firm\'s resources'
      });
    }
    
    // Find firm
    const firm = await Firm.findById(firmId);
    
    if (!firm) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Firm not found'
      });
    }
    
    // Get members
    const members = await firm.getMembers();
    
    res.status(200).json({
      members,
      total: members.length
    });
  } catch (error) {
    console.error('Get members error:', error);
    next(error);
  }
};

// ============================================
// GET FIRM CLIENTS
// ============================================

export const getClients = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { search, category_id, page = 1, limit = 20 } = req.query;
    
    // Parse ID
    const firmId = parseInt(id, 10);
    
    if (isNaN(firmId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid firm ID'
      });
    }
    
    // Check if user has access to this firm
    if (req.user.firmId !== firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this firm\'s resources'
      });
    }
    
    // Find firm
    const firm = await Firm.findById(firmId);
    
    if (!firm) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Firm not found'
      });
    }
    
    // Get clients with pagination
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    
    const clients = await firm.getClients({
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
    const countResult = await pool.query(countQuery, [firmId]);
    const total = parseInt(countResult.rows[0].total, 10);
    
    res.status(200).json({
      clients,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });
  } catch (error) {
    console.error('Get firm clients error:', error);
    next(error);
  }
};

// ============================================
// GET FIRM STATS
// ============================================

export const getStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Parse ID
    const firmId = parseInt(id, 10);
    
    if (isNaN(firmId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid firm ID'
      });
    }
    
    // Check if user has access to this firm
    if (req.user.firmId !== firmId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this firm\'s resources'
      });
    }
    
    // Find firm
    const firm = await Firm.findById(firmId);
    
    if (!firm) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Firm not found'
      });
    }
    
    // Get stats
    const stats = await firm.getStats();
    
    res.status(200).json({
      firmId,
      ...stats
    });
  } catch (error) {
    console.error('Get firm stats error:', error);
    next(error);
  }
};

export default {
  create,
  findAll,
  findById,
  update,
  remove,
  addMember,
  removeMember,
  getMembers,
  getClients,
  getStats
};
