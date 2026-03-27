/**
 * Validation Middleware Tests
 * 
 * Tests for Joi validation schemas and middleware.
 * 
 * Test Scenarios:
 * - Valid payloads → req.validated populated
 * - Invalid CUIT format → 400 VALIDATION_ERROR
 * - Missing required fields → 400 VALIDATION_ERROR
 * - Invalid dates → 400 VALIDATION_ERROR
 * - Invalid enum values → 400 VALIDATION_ERROR
 */

import { 
  firmCreateSchema,
  firmUpdateSchema,
  clientCreateSchema,
  clientUpdateSchema,
  taskCreateSchema,
  taskStatusUpdateSchema,
  taskUpdateSchema,
  moduleAssignSchema,
  validate,
  validateFirmCreate,
  validateClientCreate,
  validateTaskCreate,
  validateTaskStatusUpdate
} from '../../middleware/validation.js';

describe('Validation Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      query: {},
      validated: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  // ============================================
  // FIRM SCHEMAS
  // ============================================

  describe('firmCreateSchema', () => {
    it('should accept valid firm creation payload', () => {
      const validPayload = {
        name: 'Acme Contadores',
        address: 'Calle Principal 123',
        phone: '+54 11 1234 5678',
        email: 'contacto@acme.com',
        cuit: '30-71584796-3'
      };

      const { error, value } = firmCreateSchema.validate(validPayload);

      expect(error).toBeUndefined();
      expect(value).toEqual(validPayload);
    });

    it('should accept minimal payload with only required fields', () => {
      const minimalPayload = {
        name: 'Minimal Firm'
      };

      const { error, value } = firmCreateSchema.validate(minimalPayload);

      expect(error).toBeUndefined();
      expect(value.name).toBe('Minimal Firm');
    });

    it('should reject empty firm name', () => {
      const invalidPayload = {
        name: ''
      };

      const { error } = firmCreateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('required');
    });

    it('should reject missing firm name', () => {
      const invalidPayload = {
        address: 'Some address'
      };

      const { error } = firmCreateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('required');
    });

    it('should reject invalid email format', () => {
      const invalidPayload = {
        name: 'Test Firm',
        email: 'not-an-email'
      };

      const { error } = firmCreateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('email');
    });

    it('should reject invalid CUIT format', () => {
      const invalidPayload = {
        name: 'Test Firm',
        cuit: '12345678901' // Missing dashes
      };

      const { error } = firmCreateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('CUIT');
    });

    it('should accept valid Argentine CUIT format', () => {
      const validPayload = {
        name: 'Test Firm',
        cuit: '30-71584796-3'
      };

      const { error, value } = firmCreateSchema.validate(validPayload);

      expect(error).toBeUndefined();
      expect(value.cuit).toBe('30-71584796-3');
    });

    it('should reject invalid phone format', () => {
      const invalidPayload = {
        name: 'Test Firm',
        phone: 'abc' // Invalid format
      };

      const { error } = firmCreateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('phone');
    });
  });

  describe('firmUpdateSchema', () => {
    it('should reject empty update payload', () => {
      const invalidPayload = {};

      const { error } = firmUpdateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('At least one field');
    });

    it('should accept valid update payload', () => {
      const validPayload = {
        name: 'Updated Firm Name',
        address: 'New Address'
      };

      const { error, value } = firmUpdateSchema.validate(validPayload);

      expect(error).toBeUndefined();
      expect(value.name).toBe('Updated Firm Name');
    });
  });

  // ============================================
  // CLIENT SCHEMAS
  // ============================================

  describe('clientCreateSchema', () => {
    it('should accept valid client creation payload', () => {
      const validPayload = {
        name: 'Cliente Ejemplo SA',
        CUIT: '30-71584796-3',
        address: 'Av. Corrientes 1000',
        phone: '+54 11 4567 8901',
        email: 'cliente@ejemplo.com'
      };

      const { error, value } = clientCreateSchema.validate(validPayload);

      expect(error).toBeUndefined();
      expect(value.name).toBe('Cliente Ejemplo SA');
      expect(value.CUIT).toBe('30-71584796-3');
    });

    it('should reject missing required fields', () => {
      const invalidPayload = {
        name: 'Test Client'
        // Missing CUIT
      };

      const { error } = clientCreateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('CUIT');
    });

    it('should reject invalid CUIT format', () => {
      const invalidPayload = {
        name: 'Test Client',
        CUIT: '12-34567890-1' // Invalid format
      };

      const { error } = clientCreateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('CUIT');
    });

    it('should accept valid Argentine CUIT with proper check digit', () => {
      const validPayload = {
        name: 'Valid CUIT Client',
        CUIT: '30-71584796-3'
      };

      const { error, value } = clientCreateSchema.validate(validPayload);

      expect(error).toBeUndefined();
      expect(value.CUIT).toBe('30-71584796-3');
    });

    it('should reject invalid CUIT check digit', () => {
      const invalidPayload = {
        name: 'Invalid Check Digit',
        CUIT: '30-71584796-0' // Wrong check digit
      };

      const { error } = clientCreateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('Invalid Argentine CUIT');
    });

    it('should accept optional fields when provided', () => {
      const validPayload = {
        name: 'Full Client',
        CUIT: '20-12345678-9',
        category_id: 1,
        observations: 'Some observations about the client'
      };

      const { error, value } = clientCreateSchema.validate(validPayload);

      expect(error).toBeUndefined();
      expect(value.category_id).toBe(1);
      expect(value.observations).toBe('Some observations about the client');
    });
  });

  describe('clientUpdateSchema', () => {
    it('should reject empty update payload', () => {
      const invalidPayload = {};

      const { error } = clientUpdateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
    });

    it('should accept partial update with only name', () => {
      const validPayload = {
        name: 'New Client Name'
      };

      const { error, value } = clientUpdateSchema.validate(validPayload);

      expect(error).toBeUndefined();
      expect(value.name).toBe('New Client Name');
    });
  });

  // ============================================
  // TASK SCHEMAS
  // ============================================

  describe('taskCreateSchema', () => {
    it('should accept valid task creation payload', () => {
      const validPayload = {
        title: 'Presentar declaraciones mensuales',
        description: 'Declaración de IVA mensual',
        client_id: 1,
        module_id: 2,
        due_date: '2026-04-15',
        priority: 'high',
        is_recurring: true,
        recurrence_config: {
          frequency: 'monthly',
          day: 15
        }
      };

      const { error, value } = taskCreateSchema.validate(validPayload);

      expect(error).toBeUndefined();
      expect(value.title).toBe('Presentar declaraciones mensuales');
      expect(value.priority).toBe('high');
    });

    it('should reject missing required fields', () => {
      const invalidPayload = {
        title: 'Some Task'
        // Missing client_id, due_date
      };

      const { error } = taskCreateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details.some(d => d.path.includes('client_id'))).toBe(true);
      expect(error.details.some(d => d.path.includes('due_date'))).toBe(true);
    });

    it('should reject invalid priority enum', () => {
      const invalidPayload = {
        title: 'Test Task',
        client_id: 1,
        due_date: '2026-04-15',
        priority: 'super-urgent' // Invalid enum
      };

      const { error } = taskCreateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('Priority');
    });

    it('should reject invalid date format', () => {
      const invalidPayload = {
        title: 'Test Task',
        client_id: 1,
        due_date: '15/04/2026' // Invalid format
      };

      const { error } = taskCreateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('ISO 8601');
    });

    it('should accept valid ISO date format', () => {
      const validPayload = {
        title: 'Task with ISO date',
        client_id: 1,
        due_date: '2026-12-31'
      };

      const { error, value } = taskCreateSchema.validate(validPayload);

      expect(error).toBeUndefined();
      expect(value.due_date).toBeInstanceOf(Date);
    });

    it('should default priority to medium when not provided', () => {
      const validPayload = {
        title: 'Task without priority',
        client_id: 1,
        due_date: '2026-04-15'
      };

      const { value } = taskCreateSchema.validate(validPayload);

      expect(value.priority).toBe('medium');
    });

    it('should accept recurring task with complete config', () => {
      const validPayload = {
        title: 'Monthly Task',
        client_id: 1,
        due_date: '2026-04-15',
        is_recurring: true,
        recurrence_config: {
          frequency: 'monthly',
          interval: 1,
          day: 15
        }
      };

      const { error, value } = taskCreateSchema.validate(validPayload);

      expect(error).toBeUndefined();
      expect(value.is_recurring).toBe(true);
      expect(value.recurrence_config.frequency).toBe('monthly');
    });

    it('should reject invalid recurrence frequency', () => {
      const invalidPayload = {
        title: 'Invalid Recurring Task',
        client_id: 1,
        due_date: '2026-04-15',
        is_recurring: true,
        recurrence_config: {
          frequency: 'daily', // Invalid
          day: 15
        }
      };

      const { error } = taskCreateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
    });

    it('should accept task without module_id', () => {
      const validPayload = {
        title: 'Task without module',
        client_id: 1,
        due_date: '2026-04-15'
      };

      const { error, value } = taskCreateSchema.validate(validPayload);

      expect(error).toBeUndefined();
      expect(value.module_id).toBeUndefined();
    });
  });

  describe('taskStatusUpdateSchema', () => {
    it('should accept valid status update', () => {
      const validPayload = {
        status: 'completed'
      };

      const { error, value } = taskStatusUpdateSchema.validate(validPayload);

      expect(error).toBeUndefined();
      expect(value.status).toBe('completed');
    });

    it('should accept all valid statuses', () => {
      const statuses = ['pending', 'in_progress', 'completed', 'cancelled'];

      statuses.forEach(status => {
        const { error } = taskStatusUpdateSchema.validate({ status });
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid status', () => {
      const invalidPayload = {
        status: 'done' // Not a valid status
      };

      const { error } = taskStatusUpdateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('Status');
    });

    it('should reject missing status', () => {
      const invalidPayload = {};

      const { error } = taskStatusUpdateSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('required');
    });
  });

  // ============================================
  // MODULE ASSIGN SCHEMA
  // ============================================

  describe('moduleAssignSchema', () => {
    it('should accept valid module assignment', () => {
      const validPayload = {
        moduleId: 5,
        expirationDate: '2026-12-31'
      };

      const { error, value } = moduleAssignSchema.validate(validPayload);

      expect(error).toBeUndefined();
      expect(value.moduleId).toBe(5);
    });

    it('should reject missing moduleId', () => {
      const invalidPayload = {
        expirationDate: '2026-12-31'
      };

      const { error } = moduleAssignSchema.validate(invalidPayload);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('Module ID');
    });

    it('should reject invalid moduleId (non-positive)', () => {
      const invalidPayload = {
        moduleId: -1
      };

      const { error } = moduleAssignSchema.validate(invalidPayload);

      expect(error).toBeDefined();
    });

    it('should accept optional expirationDate', () => {
      const validPayload = {
        moduleId: 3
      };

      const { error, value } = moduleAssignSchema.validate(validPayload);

      expect(error).toBeUndefined();
      expect(value.expirationDate).toBeUndefined();
    });
  });

  // ============================================
  // VALIDATION MIDDLEWARE
  // ============================================

  describe('validate middleware', () => {
    it('should call next() with valid data', () => {
      const middleware = validate(firmCreateSchema, 'body');
      mockReq.body = { name: 'Test Firm' };

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body.name).toBe('Test Firm');
      expect(mockReq.validated.body).toBeDefined();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 400 with validation errors', () => {
      const middleware = validate(firmCreateSchema, 'body');
      mockReq.body = { name: '' }; // Invalid: empty name

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'VALIDATION_ERROR'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 with multiple validation errors', () => {
      const middleware = validate(firmCreateSchema, 'body');
      mockReq.body = { 
        name: '', 
        email: 'not-email' 
      };

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'VALIDATION_ERROR',
          details: expect.arrayContaining([])
        })
      );
    });

    it('should strip unknown fields', () => {
      const middleware = validate(firmCreateSchema, 'body');
      mockReq.body = { 
        name: 'Valid Name',
        unknownField: 'should be removed'
      };

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body.unknownField).toBeUndefined();
    });
  });

  describe('pre-built validation middleware', () => {
    it('validateFirmCreate should work correctly', () => {
      mockReq.body = { name: 'My Firm' };

      validateFirmCreate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('validateClientCreate should reject invalid CUIT', () => {
      mockReq.body = { 
        name: 'Client', 
        CUIT: 'invalid-cuit' 
      };

      validateClientCreate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('validateTaskCreate should reject missing required fields', () => {
      mockReq.body = { title: 'Task' };

      validateTaskCreate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('validateTaskStatusUpdate should reject invalid status', () => {
      mockReq.body = { status: 'invalid' };

      validateTaskStatusUpdate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
