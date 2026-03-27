// middleware/validation.js
import Joi from 'joi';

/**
 * Input Validation Middleware
 * 
 * Provides Joi schemas and validation middleware for all API endpoints.
 * Validates request payloads before they reach controllers.
 */

// ============================================
// REGEX PATTERNS
// ============================================

// Argentine CUIT format: XX-XXXXXXXX-X
const CUIT_REGEX = /^\d{2}-\d{8}-\d{1}$/;

// Argentine phone formats
const PHONE_REGEX = /^(\+54\s?)?(\d{2,4})?\s?\d{3,4}\s?\d{3,4}$/;

// ============================================
// JOI EXTENSIONS
// ============================================

// Custom Joi extension for Argentine CUIT
const cuidExtension = (joi) => ({
  type: 'cuit',
  base: joi.string(),
  messages: {
    'cuit.format': 'CUIT must be in format XX-XXXXXXXX-X',
    'cuit.invalid': 'Invalid Argentine CUIT'
  },
  validate(value, helpers) {
    // First check format
    if (!CUIT_REGEX.test(value)) {
      return { value, errors: helpers.error('cuit.format') };
    }
    // Validate check digit
    const cleanCuit = value.replace(/-/g, '');
    if (!/^\d{11}$/.test(cleanCuit)) {
      return { value, errors: helpers.error('cuit.format') };
    }
    const digits = cleanCuit.split('').map(Number);
    const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += digits[i] * multipliers[i];
    }
    const remainder = sum % 11;
    const verifierDigit = remainder < 2 ? remainder : 11 - remainder;
    if (digits[10] !== verifierDigit) {
      return { value, errors: helpers.error('cuit.invalid') };
    }
    return { value };
  }
});

// ============================================
// SCHEMAS
// ============================================

// Firm schemas
export const firmCreateSchema = Joi.object({
  name: Joi.string().min(1).max(255).required()
    .messages({
      'string.empty': 'Firm name is required',
      'string.max': 'Firm name must not exceed 255 characters',
      'any.required': 'Firm name is required'
    }),
  address: Joi.string().max(500).optional(),
  phone: Joi.string().max(50).pattern(PHONE_REGEX).optional()
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    }),
  email: Joi.string().email().max(255).optional()
    .messages({
      'string.email': 'Invalid email format'
    }),
  cuit: Joi.string().pattern(CUIT_REGEX).optional()
    .messages({
      'string.pattern.base': 'CUIT must be in format XX-XXXXXXXX-X'
    })
});

export const firmUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional()
    .messages({
      'string.empty': 'Firm name cannot be empty',
      'string.max': 'Firm name must not exceed 255 characters'
    }),
  address: Joi.string().max(500).optional(),
  phone: Joi.string().max(50).pattern(PHONE_REGEX).optional()
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    }),
  email: Joi.string().email().max(255).optional()
    .messages({
      'string.email': 'Invalid email format'
    }),
  cuit: Joi.string().pattern(CUIT_REGEX).optional()
    .messages({
      'string.pattern.base': 'CUIT must be in format XX-XXXXXXXX-X'
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Firm member schemas
export const firmAddMemberSchema = Joi.object({
  userId: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'User ID must be a number',
      'number.positive': 'User ID must be positive',
      'any.required': 'User ID is required'
    }),
  role: Joi.string().valid('owner', 'associated', 'member').required()
    .messages({
      'any.only': 'Role must be one of: owner, associated, member',
      'any.required': 'Role is required'
    })
});

// Client schemas
export const clientCreateSchema = Joi.object({
  name: Joi.string().min(1).max(255).required()
    .messages({
      'string.empty': 'Client name is required',
      'string.max': 'Client name must not exceed 255 characters',
      'any.required': 'Client name is required'
    }),
  CUIT: Joi.string().pattern(CUIT_REGEX).required()
    .messages({
      'string.pattern.base': 'CUIT must be in format XX-XXXXXXXX-X',
      'any.required': 'CUIT is required'
    }),
  address: Joi.string().max(500).optional(),
  phone: Joi.string().max(50).pattern(PHONE_REGEX).optional()
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    }),
  email: Joi.string().email().max(255).optional()
    .messages({
      'string.email': 'Invalid email format'
    }),
  category_id: Joi.number().integer().positive().optional()
    .messages({
      'number.base': 'Category ID must be a number',
      'number.positive': 'Category ID must be positive'
    }),
  observations: Joi.string().max(2000).optional()
});

export const clientUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional()
    .messages({
      'string.empty': 'Client name cannot be empty',
      'string.max': 'Client name must not exceed 255 characters'
    }),
  address: Joi.string().max(500).optional(),
  phone: Joi.string().max(50).pattern(PHONE_REGEX).optional()
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    }),
  email: Joi.string().email().max(255).optional()
    .messages({
      'string.email': 'Invalid email format'
    }),
  category_id: Joi.number().integer().positive().optional()
    .messages({
      'number.base': 'Category ID must be a number',
      'number.positive': 'Category ID must be positive'
    }),
  observations: Joi.string().max(2000).optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Module assignment schema
export const moduleAssignSchema = Joi.object({
  moduleId: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'Module ID must be a number',
      'number.positive': 'Module ID must be positive',
      'any.required': 'Module ID is required'
    }),
  expirationDate: Joi.date().iso().optional()
    .messages({
      'date.format': 'Expiration date must be in ISO 8601 format (YYYY-MM-DD)'
    })
});

// Task schemas
export const taskCreateSchema = Joi.object({
  title: Joi.string().min(1).max(500).required()
    .messages({
      'string.empty': 'Task title is required',
      'string.max': 'Task title must not exceed 500 characters',
      'any.required': 'Task title is required'
    }),
  description: Joi.string().max(2000).optional(),
  client_id: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'Client ID must be a number',
      'number.positive': 'Client ID must be positive',
      'any.required': 'Client ID is required'
    }),
  module_id: Joi.number().integer().positive().optional(),
  due_date: Joi.date().iso().required()
    .messages({
      'date.format': 'Due date must be in ISO 8601 format (YYYY-MM-DD)',
      'any.required': 'Due date is required'
    }),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium')
    .messages({
      'any.only': 'Priority must be one of: low, medium, high, urgent'
    }),
  is_recurring: Joi.boolean().default(false),
  recurrence_config: Joi.object({
    frequency: Joi.string().valid('monthly', 'quarterly', 'yearly').optional(),
    interval: Joi.number().integer().min(1).max(12).optional(),
    day: Joi.number().integer().min(1).max(31).optional(),
    month: Joi.number().integer().min(1).max(12).optional()
  }).optional()
});

export const taskUpdateSchema = Joi.object({
  title: Joi.string().min(1).max(500).optional()
    .messages({
      'string.empty': 'Task title cannot be empty',
      'string.max': 'Task title must not exceed 500 characters'
    }),
  description: Joi.string().max(2000).optional(),
  due_date: Joi.date().iso().optional()
    .messages({
      'date.format': 'Due date must be in ISO 8601 format (YYYY-MM-DD)'
    }),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional()
    .messages({
      'any.only': 'Priority must be one of: low, medium, high, urgent'
    }),
  is_recurring: Joi.boolean().optional(),
  recurrence_config: Joi.object({
    frequency: Joi.string().valid('monthly', 'quarterly', 'yearly').optional(),
    interval: Joi.number().integer().min(1).max(12).optional(),
    day: Joi.number().integer().min(1).max(31).optional(),
    month: Joi.number().integer().min(1).max(12).optional()
  }).optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

export const taskStatusUpdateSchema = Joi.object({
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled').required()
    .messages({
      'any.only': 'Status must be one of: pending, in_progress, completed, cancelled',
      'any.required': 'Status is required'
    })
});

export const taskAssignSchema = Joi.object({
  userId: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'User ID must be a number',
      'number.positive': 'User ID must be positive',
      'any.required': 'User ID is required'
    })
});

// Query parameter schemas
export const taskFilterSchema = Joi.object({
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  client_id: Joi.number().integer().positive().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

export const firmFilterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

export const clientFilterSchema = Joi.object({
  search: Joi.string().max(255).optional(),
  category_id: Joi.number().integer().positive().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

export const moduleFilterSchema = Joi.object({
  jurisdiction: Joi.string().valid('Nacional', 'Provincial', 'Municipal').optional(),
  category: Joi.string().max(100).optional()
});

// ============================================
// VALIDATION MIDDLEWARE FACTORY
// ============================================

/**
 * Create validation middleware for a specific schema
 * 
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[property];
    
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      // Format validation errors
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: errors[0].message,
        details: errors
      });
    }

    // Replace request data with validated and sanitized data
    req[property] = value;
    
    // Also set req.validated for convenience
    req.validated = req.validated || {};
    req.validated[property] = value;

    next();
  };
};

/**
 * Validate multiple properties at once
 * 
 * @param {Object} schemaMap - Object mapping property names to schemas
 * @returns {Function} Express middleware
 */
export const validateMultiple = (schemaMap) => {
  return (req, res, next) => {
    const errors = [];

    for (const [property, schema] of Object.entries(schemaMap)) {
      const dataToValidate = req[property];
      
      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        error.details.forEach(detail => {
          errors.push({
            field: `${property}.${detail.path.join('.')}`,
            message: detail.message
          });
        });
      } else {
        req[property] = value;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: errors[0].message,
        details: errors
      });
    }

    // Set req.validated for convenience
    req.validated = req.validated || {};
    for (const [property, schema] of Object.entries(schemaMap)) {
      req.validated[property] = req[property];
    }

    next();
  };
};

// ============================================
// SPECIFIC VALIDATION MIDDLEWARE
// ============================================

// Firm validation
export const validateFirmCreate = validate(firmCreateSchema, 'body');
export const validateFirmUpdate = validate(firmUpdateSchema, 'body');
export const validateFirmMemberAdd = validate(firmAddMemberSchema, 'body');
export const validateFirmQuery = validate(firmFilterSchema, 'query');

// Client validation
export const validateClientCreate = validate(clientCreateSchema, 'body');
export const validateClientUpdate = validate(clientUpdateSchema, 'body');
export const validateClientQuery = validate(clientFilterSchema, 'query');
export const validateModuleAssign = validate(moduleAssignSchema, 'body');

// Task validation
export const validateTaskCreate = validate(taskCreateSchema, 'body');
export const validateTaskUpdate = validate(taskUpdateSchema, 'body');
export const validateTaskStatusUpdate = validate(taskStatusUpdateSchema, 'body');
export const validateTaskAssign = validate(taskAssignSchema, 'body');
export const validateTaskQuery = validate(taskFilterSchema, 'query');

// Module validation
export const validateModuleQuery = validate(moduleFilterSchema, 'query');

export default {
  // Schemas
  firmCreateSchema,
  firmUpdateSchema,
  firmAddMemberSchema,
  clientCreateSchema,
  clientUpdateSchema,
  moduleAssignSchema,
  taskCreateSchema,
  taskUpdateSchema,
  taskStatusUpdateSchema,
  taskAssignSchema,
  
  // Middleware
  validate,
  validateMultiple,
  
  // Pre-built middleware
  validateFirmCreate,
  validateFirmUpdate,
  validateFirmMemberAdd,
  validateFirmQuery,
  validateClientCreate,
  validateClientUpdate,
  validateClientQuery,
  validateModuleAssign,
  validateTaskCreate,
  validateTaskUpdate,
  validateTaskStatusUpdate,
  validateTaskAssign,
  validateTaskQuery,
  validateModuleQuery
};
