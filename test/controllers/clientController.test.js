/**
 * Client Controller Tests
 * 
 * Tests for client CRUD operations.
 * 
 * Test Scenarios:
 * - Create client with CUIT validation → 201
 * - Get clients by firm → 200 with pagination
 * - Get client by ID with modules → 200
 * - Update client → 200
 * - Deactivate client → 200 with task cancellation
 * - Assign module → 200
 * - Error handling: 404, 403, 409 (duplicate CUIT, duplicate module)
 */

import { jest } from '@jest/globals';
import * as clientController from '../../controllers/clientController.js';

// Manual mocks
const mockClient = {
  create: jest.fn(),
  findById: jest.fn(),
  findByFirm: jest.fn()
};

const mockTaxModule = {
  findById: jest.fn()
};

const mockPool = {
  query: jest.fn(),
  connect: jest.fn()
};

jest.unstable_mockModule('../../models/Client.js', () => ({
  default: mockClient
}));

jest.unstable_mockModule('../../models/TaxModule.js', () => ({
  default: mockTaxModule
}));

jest.unstable_mockModule('../../config/database.js', () => ({
  default: mockPool,
  connect: jest.fn()
}));

const Client = (await import('../../models/Client.js')).default;
const TaxModule = (await import('../../models/TaxModule.js')).default;
const pool = await import('../../config/database.js');

describe('Client Controller', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      query: {},
      user: null,
      validated: { body: {} }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    
    Client.create.mockReset();
    Client.findById.mockReset();
    Client.findByFirm.mockReset();
    TaxModule.findById.mockReset();
    pool.default.query.mockReset();
    pool.connect.mockReset();
  });

  // ============================================
  // CREATE CLIENT
  // ============================================

  describe('create', () => {
    it('should create client and return 201', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.validated.body = {
        name: 'Test Client',
        CUIT: '30-71584796-3',
        address: 'Test Address',
        phone: '+54 11 1234 5678',
        email: 'client@test.com'
      };

      // Mock no duplicate CUIT
      pool.default.query.mockResolvedValue({ rows: [] });

      const mockClientData = {
        id: 1,
        name: 'Test Client',
        CUIT: '30-71584796-3',
        firm_id: 1,
        is_active: true
      };
      Client.create.mockResolvedValue(mockClientData);

      await clientController.create(mockReq, mockRes, mockNext);

      expect(Client.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Client',
          CUIT: '30-71584796-3',
          firm_id: 1
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockClientData);
    });

    it('should return 400 when user has no firm', async () => {
      mockReq.user = { userId: 1, firmId: null };
      mockReq.validated.body = { name: 'Test Client', CUIT: '30-71584796-3' };

      await clientController.create(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'NO_FIRM'
        })
      );
    });

    it('should return 409 when CUIT already exists in firm', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.validated.body = {
        name: 'Duplicate Client',
        CUIT: '30-71584796-3'
      };

      // Mock duplicate CUIT found
      pool.default.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await clientController.create(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'DUPLICATE_CUIT'
        })
      );
    });
  });

  // ============================================
  // FIND BY FIRM
  // ============================================

  describe('findByFirm', () => {
    it('should return clients with pagination', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.query = { page: '1', limit: '20' };

      const mockClients = [
        { id: 1, name: 'Client 1', CUIT: '30-11111111-1', is_active: true, modules_count: '2' },
        { id: 2, name: 'Client 2', CUIT: '30-22222222-2', is_active: true, modules_count: '0' }
      ];
      Client.findByFirm.mockResolvedValue(mockClients);
      pool.default.query.mockResolvedValue({ rows: [{ total: '2' }] });

      await clientController.findByFirm(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          clients: expect.arrayContaining([]),
          total: 2,
          page: 1,
          limit: 20
        })
      );
    });

    it('should return 400 when user has no firm', async () => {
      mockReq.user = { userId: 1, firmId: null };

      await clientController.findByFirm(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'NO_FIRM'
        })
      );
    });
  });

  // ============================================
  // FIND BY ID
  // ============================================

  describe('findById', () => {
    it('should return client with assigned modules', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.params = { id: '1' };

      const mockClientInstance = {
        id: 1,
        name: 'Test Client',
        CUIT: '30-71584796-3',
        firm_id: 1,
        is_active: true,
        getModules: jest.fn().mockResolvedValue([
          { id: 1, name: 'IVA', code: 'IVA', jurisdiction_name: 'Nacional', frequency: 'monthly' }
        ]),
        getStats: jest.fn().mockResolvedValue({
          total_tasks: '5',
          pending_tasks: '2',
          completed_tasks: '3',
          overdue_tasks: '0',
          assigned_modules: '1'
        })
      };
      Client.findById.mockResolvedValue(mockClientInstance);

      await clientController.findById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          name: 'Test Client',
          assignedModules: expect.arrayContaining([])
        })
      );
    });

    it('should return 404 when client not found', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.params = { id: '999' };
      Client.findById.mockResolvedValue(null);

      await clientController.findById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when accessing different firm\'s client', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.params = { id: '1' };
      
      const mockClientInstance = { id: 1, firm_id: 2 }; // Different firm
      Client.findById.mockResolvedValue(mockClientInstance);

      await clientController.findById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  // ============================================
  // ASSIGN MODULE
  // ============================================

  describe('assignModule', () => {
    it('should assign module to client', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.params = { id: '1' };
      mockReq.validated.body = { moduleId: 2 };

      const mockClientInstance = {
        id: 1,
        firm_id: 1,
        assignModule: jest.fn().mockResolvedValue(true),
        getModules: jest.fn().mockResolvedValue([
          { id: 2, name: 'IVA', jurisdiction_name: 'Nacional', frequency: 'monthly' }
        ])
      };
      Client.findById.mockResolvedValue(mockClientInstance);
      TaxModule.findById.mockResolvedValue({ id: 2, name: 'IVA' });
      
      // Mock no duplicate module
      pool.default.query.mockResolvedValue({ rows: [] });

      await clientController.assignModule(mockReq, mockRes, mockNext);

      expect(mockClientInstance.assignModule).toHaveBeenCalledWith(2);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 409 when module already assigned', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.params = { id: '1' };
      mockReq.validated.body = { moduleId: 2 };

      const mockClientInstance = { id: 1, firm_id: 1 };
      Client.findById.mockResolvedValue(mockClientInstance);
      TaxModule.findById.mockResolvedValue({ id: 2, name: 'IVA' });
      
      // Mock duplicate module assignment
      pool.default.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await clientController.assignModule(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
    });
  });
});
