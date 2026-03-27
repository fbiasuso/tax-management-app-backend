// controllers/moduleController.js
import TaxModule from '../models/TaxModule.js';
import TaxJurisdiction from '../models/TaxJurisdiction.js';

/**
 * Module Controller
 * 
 * Handles all tax module and jurisdiction-related operations.
 * These endpoints are PUBLIC (no authentication required).
 */

// ============================================
// GET ALL MODULES
// ============================================

export const getAll = async (req, res, next) => {
  try {
    const { jurisdiction, frequency } = req.query;
    
    let modules;
    
    // Filter by jurisdiction
    if (jurisdiction) {
      // Get jurisdiction by name
      const jurisdictions = await TaxJurisdiction.getAll();
      const foundJurisdiction = jurisdictions.find(j => 
        j.name.toLowerCase() === jurisdiction.toLowerCase()
      );
      
      if (!foundJurisdiction) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: `Jurisdiction '${jurisdiction}' not found`
        });
      }
      
      modules = await TaxModule.getByJurisdiction(foundJurisdiction.id);
    } 
    // Filter by frequency
    else if (frequency) {
      const validFrequencies = ['monthly', 'quarterly', 'yearly'];
      if (!validFrequencies.includes(frequency.toLowerCase())) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `Frequency must be one of: ${validFrequencies.join(', ')}`
        });
      }
      
      modules = await TaxModule.getByFrequency(frequency.toLowerCase());
    } 
    else {
      modules = await TaxModule.getAll();
    }
    
    res.status(200).json({
      modules: modules.map(m => ({
        id: m.id,
        name: m.name,
        code: m.code,
        description: m.description,
        frequency: m.frequency,
        due_day: m.due_day,
        jurisdiction: m.jurisdiction_name,
        jurisdiction_level: m.jurisdiction_level
      })),
      total: modules.length
    });
  } catch (error) {
    console.error('Get all modules error:', error);
    next(error);
  }
};

// ============================================
// GET MODULE BY ID
// ============================================

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const moduleId = parseInt(id, 10);
    
    if (isNaN(moduleId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid module ID'
      });
    }
    
    const taxModule = await TaxModule.findById(moduleId);
    
    if (!taxModule) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Module not found'
      });
    }
    
    // Get client count for this module
    const clients = await taxModule.getAssignedClients();
    
    res.status(200).json({
      id: taxModule.id,
      name: taxModule.name,
      code: taxModule.code,
      description: taxModule.description,
      frequency: taxModule.frequency,
      due_day: taxModule.due_day,
      jurisdiction: {
        id: taxModule.jurisdiction_id,
        name: taxModule.jurisdiction_name,
        level: taxModule.jurisdiction_level,
        code: taxModule.jurisdiction_code
      },
      clientCount: clients.length,
      is_active: taxModule.is_active,
      created_at: taxModule.created_at
    });
  } catch (error) {
    console.error('Get module by ID error:', error);
    next(error);
  }
};

// ============================================
// GET MODULES BY JURISDICTION
// ============================================

export const getByJurisdiction = async (req, res, next) => {
  try {
    const { jurisdictionId } = req.params;
    
    const jurisdictionIdNum = parseInt(jurisdictionId, 10);
    
    if (isNaN(jurisdictionIdNum)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid jurisdiction ID'
      });
    }
    
    const jurisdiction = await TaxJurisdiction.findById(jurisdictionIdNum);
    
    if (!jurisdiction) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Jurisdiction not found'
      });
    }
    
    const modules = await TaxModule.getByJurisdiction(jurisdictionIdNum);
    
    res.status(200).json({
      jurisdiction: {
        id: jurisdiction.id,
        name: jurisdiction.name,
        code: jurisdiction.code,
        level: jurisdiction.level
      },
      modules: modules.map(m => ({
        id: m.id,
        name: m.name,
        code: m.code,
        description: m.description,
        frequency: m.frequency,
        due_day: m.due_day
      })),
      total: modules.length
    });
  } catch (error) {
    console.error('Get modules by jurisdiction error:', error);
    next(error);
  }
};

// ============================================
// GET MODULES BY FREQUENCY
// ============================================

export const getByFrequency = async (req, res, next) => {
  try {
    const { frequency } = req.params;
    
    const validFrequencies = ['monthly', 'quarterly', 'yearly'];
    
    if (!validFrequencies.includes(frequency.toLowerCase())) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Frequency must be one of: ${validFrequencies.join(', ')}`
      });
    }
    
    const modules = await TaxModule.getByFrequency(frequency.toLowerCase());
    
    res.status(200).json({
      frequency: frequency.toLowerCase(),
      modules: modules.map(m => ({
        id: m.id,
        name: m.name,
        code: m.code,
        description: m.description,
        due_day: m.due_day,
        jurisdiction: {
          name: m.jurisdiction_name,
          level: m.jurisdiction_level
        }
      })),
      total: modules.length
    });
  } catch (error) {
    console.error('Get modules by frequency error:', error);
    next(error);
  }
};

// ============================================
// GET ALL JURISDICTIONS
// ============================================

export const getJurisdictions = async (req, res, next) => {
  try {
    const { level } = req.query;
    
    let jurisdictions;
    
    if (level) {
      const validLevels = ['federal', 'provincial', 'municipal'];
      if (!validLevels.includes(level.toLowerCase())) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `Level must be one of: ${validLevels.join(', ')}`
        });
      }
      
      jurisdictions = await TaxJurisdiction.getByLevel(level.toLowerCase());
    } else {
      jurisdictions = await TaxJurisdiction.getAll();
    }
    
    res.status(200).json({
      jurisdictions: jurisdictions.map(j => ({
        id: j.id,
        name: j.name,
        code: j.code,
        level: j.level,
        parent_id: j.parent_id,
        parent_name: j.parent_name || null,
        modules_count: parseInt(j.modules_count, 10) || 0
      })),
      total: jurisdictions.length
    });
  } catch (error) {
    console.error('Get jurisdictions error:', error);
    next(error);
  }
};

// ============================================
// GET JURISDICTION BY ID
// ============================================

export const getJurisdictionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const jurisdictionId = parseInt(id, 10);
    
    if (isNaN(jurisdictionId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid jurisdiction ID'
      });
    }
    
    const jurisdiction = await TaxJurisdiction.findById(jurisdictionId);
    
    if (!jurisdiction) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Jurisdiction not found'
      });
    }
    
    // Get stats for this jurisdiction
    const stats = await jurisdiction.getStats();
    
    // Get child jurisdictions (e.g., municipalities for a province)
    const children = await jurisdiction.getChildren();
    
    res.status(200).json({
      id: jurisdiction.id,
      name: jurisdiction.name,
      code: jurisdiction.code,
      level: jurisdiction.level,
      parent_id: jurisdiction.parent_id,
      parent_name: jurisdiction.parent_name || null,
      is_federal: jurisdiction.isFederal(),
      is_provincial: jurisdiction.isProvincial(),
      is_municipal: jurisdiction.isMunicipal(),
      stats: {
        total_modules: parseInt(stats.total_modules, 10),
        monthly_modules: parseInt(stats.monthly_modules, 10),
        quarterly_modules: parseInt(stats.quarterly_modules, 10),
        yearly_modules: parseInt(stats.yearly_modules, 10),
        total_clients_using: parseInt(stats.total_clients_using, 10)
      },
      children: children.map(c => ({
        id: c.id,
        name: c.name,
        code: c.code,
        level: c.level,
        modules_count: parseInt(c.modules_count, 10) || 0
      })),
      created_at: jurisdiction.created_at
    });
  } catch (error) {
    console.error('Get jurisdiction by ID error:', error);
    next(error);
  }
};

// ============================================
// GET CLIENTS ASSIGNED TO MODULE
// ============================================

export const getAssignedClients = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const moduleId = parseInt(id, 10);
    
    if (isNaN(moduleId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid module ID'
      });
    }
    
    const taxModule = await TaxModule.findById(moduleId);
    
    if (!taxModule) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Module not found'
      });
    }
    
    const clients = await taxModule.getAssignedClients();
    
    res.status(200).json({
      module: {
        id: taxModule.id,
        name: taxModule.name,
        code: taxModule.code,
        jurisdiction: taxModule.jurisdiction_name
      },
      clients: clients.map(c => ({
        id: c.id,
        name: c.name,
        CUIT: c.cuit,
        email: c.email,
        phone: c.phone,
        assigned_at: c.assigned_at,
        is_active: c.is_active
      })),
      total: clients.length
    });
  } catch (error) {
    console.error('Get assigned clients error:', error);
    next(error);
  }
};

export default {
  getAll,
  getById,
  getByJurisdiction,
  getByFrequency,
  getJurisdictions,
  getJurisdictionById,
  getAssignedClients
};
