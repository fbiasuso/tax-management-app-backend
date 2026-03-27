/**
 * Firm Controller Tests
 * 
 * Tests for firm CRUD operations.
 * 
 * Test Scenarios:
 * - Create firm → 201 with firm object
 * - Get firm by ID → 200 with nested members
 * - Update firm → 200 with updated firm
 * - Delete firm → 200 with confirmation (soft delete)
 * - Add/remove members → 201/200 with correct responses
 * - Error handling: 404, 403, 409
 */

import { jest } from '@jest/globals';
import * as firmController from '../../controllers/firmController.js';

// Manual mocks - simpler for ESM
let mockFirm = {
  create: jest.fn(),
  findById: jest.fn()
};

let mockUser = {
  findById: jest.fn()
};

let mockPool = {
  query: jest.fn(),
  connect: jest.fn()
};

// Mock modules by replacing imports
jest.unstable_mockModule('../../models/Firm.js', () => ({
  default: mockFirm
}));

jest.unstable_mockModule('../../models/User.js', () => ({
  default: mockUser
}));

jest.unstable_mockModule('../../config/database.js', () => ({
  default: mockPool,
  connect: jest.fn()
}));

// Import after mocks are set up
const { default: Firm } = await import('../../models/Firm.js');
const { default: User } = await import('../../models/User.js');
const pool = await import('../../config/database.js');

describe('Firm Controller', () => {
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
    
    // Reset mocks
    Firm.create.mockReset();
    Firm.findById.mockReset();
    User.findById.mockReset();
    pool.default.query.mockReset();
    pool.connect.mockReset();
  });

  // ============================================
  // CREATE FIRM
  // ============================================

  describe('create', () => {
    it('should create firm and return 201', async () => {
      mockReq.user = { userId: 1, firmId: null, role: null };
      mockReq.validated.body = {
        name: 'New Firm',
        address: '123 Test St',
        phone: '+54 11 1234 5678',
        email: 'test@firm.com'
      };

      const mockFirmData = {
        id: 1,
        name: 'New Firm',
        address: '123 Test St',
        phone: '+54 11 1234 5678',
        email: 'test@firm.com',
        is_active: true
      };
      Firm.create.mockResolvedValue(mockFirmData);

      await firmController.create(mockReq, mockRes, mockNext);

      expect(Firm.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Firm' }),
        1
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockFirmData);
    });

    it('should return 400 when user already belongs to a firm', async () => {
      mockReq.user = { userId: 1, firmId: 5, role: 'owner' };
      mockReq.validated.body = { name: 'Another Firm' };

      await firmController.create(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'ALREADY_HAS_FIRM'
        })
      );
    });
  });

  // ============================================
  // FIND BY ID
  // ============================================

  describe('findById', () => {
    it('should return firm with members and clients', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1' };

      const mockFirmInstance = {
        id: 1,
        name: 'Test Firm',
        getMembers: jest.fn().mockResolvedValue([
          { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@test.com', role: 'owner' }
        ]),
        getClients: jest.fn().mockResolvedValue([
          { id: 1, name: 'Client 1', CUIT: '30-12345678-9', is_active: true, modules_count: '2' }
        ]),
        getStats: jest.fn().mockResolvedValue({ total_clients: 1, total_tasks: 5 })
      };
      Firm.findById.mockResolvedValue(mockFirmInstance);

      await firmController.findById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          name: 'Test Firm',
          members: expect.arrayContaining([]),
          clients: expect.arrayContaining([]),
          stats: expect.objectContaining({})
        })
      );
    });

    it('should return 400 for invalid firm ID', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: 'invalid' };

      await firmController.findById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'VALIDATION_ERROR'
        })
      );
    });

    it('should return 403 when accessing different firm', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '2' }; // Different firm

      await firmController.findById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'FORBIDDEN'
        })
      );
    });

    it('should return 404 when firm not found', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1' };
      Firm.findById.mockResolvedValue(null);

      await firmController.findById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'NOT_FOUND'
        })
      );
    });
  });

  // ============================================
  // UPDATE FIRM
  // ============================================

  describe('update', () => {
    it('should update firm and return 200', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1' };
      mockReq.validated.body = { name: 'Updated Firm' };

      const mockFirmInstance = {
        id: 1,
        name: 'Updated Firm',
        getMembers: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(true)
      };
      Firm.findById.mockResolvedValue(mockFirmInstance);

      await firmController.update(mockReq, mockRes, mockNext);

      expect(mockFirmInstance.update).toHaveBeenCalledWith({ name: 'Updated Firm' });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 403 when member tries to update', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'member' };
      mockReq.params = { id: '1' };
      mockReq.validated.body = { name: 'New Name' };

      await firmController.update(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 when firm not found', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1' };
      mockReq.validated.body = { name: 'New Name' };
      Firm.findById.mockResolvedValue(null);

      await firmController.update(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  // ============================================
  // REMOVE (DELETE) FIRM
  // ============================================

  describe('remove', () => {
    it('should soft-delete firm and return 200', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1' };

      const mockFirmInstance = { id: 1, name: 'Test Firm' };
      Firm.findById.mockResolvedValue(mockFirmInstance);

      const mockClient = {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn()
      };
      pool.connect.mockResolvedValue(mockClient);

      await firmController.remove(mockReq, mockRes, mockNext);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE accounting_firms'),
        [1]
      );
      expect(mockClient.release).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 403 when non-owner tries to delete', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'associated' };
      mockReq.params = { id: '1' };

      await firmController.remove(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Only owners can delete a firm'
        })
      );
    });

    it('should return 404 when firm not found', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1' };
      Firm.findById.mockResolvedValue(null);

      await firmController.remove(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  // ============================================
  // ADD MEMBER
  // ============================================

  describe('addMember', () => {
    it('should add member and return 201', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1' };
      mockReq.validated.body = { userId: 2, role: 'member' };

      const mockFirmInstance = {
        id: 1,
        addMember: jest.fn().mockResolvedValue({}),
        getMembers: jest.fn().mockResolvedValue([
          { id: 2, email: 'new@user.com', role: 'member' }
        ])
      };
      Firm.findById.mockResolvedValue(mockFirmInstance);
      User.findById.mockResolvedValue({ id: 2, email: 'new@user.com', first_name: 'New', last_name: 'User' });

      await firmController.addMember(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Member added successfully'
        })
      );
    });

    it('should return 403 when non-owner/associated tries to add member', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'member' };
      mockReq.params = { id: '1' };
      mockReq.validated.body = { userId: 2, role: 'member' };

      await firmController.addMember(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 when user to add not found', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1' };
      mockReq.validated.body = { userId: 999, role: 'member' };

      const mockFirmInstance = { id: 1, addMember: jest.fn() };
      Firm.findById.mockResolvedValue(mockFirmInstance);
      User.findById.mockResolvedValue(null);

      await firmController.addMember(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 409 when user is already a member', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1' };
      mockReq.validated.body = { userId: 2, role: 'member' };

      const mockFirmInstance = {
        id: 1,
        addMember: jest.fn().mockRejectedValue(new Error('User is already a member'))
      };
      Firm.findById.mockResolvedValue(mockFirmInstance);
      User.findById.mockResolvedValue({ id: 2, email: 'exists@user.com' });

      await firmController.addMember(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'DUPLICATE_MEMBER'
        })
      );
    });
  });

  // ============================================
  // REMOVE MEMBER
  // ============================================

  describe('removeMember', () => {
    it('should remove member and return 200', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1', memberId: '2' };

      const mockFirmInstance = {
        id: 1,
        removeMember: jest.fn().mockResolvedValue(true)
      };
      Firm.findById.mockResolvedValue(mockFirmInstance);

      await firmController.removeMember(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Member removed successfully'
        })
      );
    });

    it('should return 400 when owner tries to remove themselves', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1', memberId: '1' }; // Same user

      await firmController.removeMember(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'CANNOT_REMOVE_SELF'
        })
      );
    });

    it('should return 403 when non-owner tries to remove member', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'associated' };
      mockReq.params = { id: '1', memberId: '2' };

      await firmController.removeMember(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 when firm not found', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1', memberId: '2' };
      Firm.findById.mockResolvedValue(null);

      await firmController.removeMember(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  // ============================================
  // GET MEMBERS
  // ============================================

  describe('getMembers', () => {
    it('should return firm members', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1' };

      const mockFirmInstance = {
        id: 1,
        getMembers: jest.fn().mockResolvedValue([
          { id: 1, first_name: 'John', last_name: 'Doe', role: 'owner' },
          { id: 2, first_name: 'Jane', last_name: 'Smith', role: 'member' }
        ])
      };
      Firm.findById.mockResolvedValue(mockFirmInstance);

      await firmController.getMembers(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          members: expect.arrayContaining([]),
          total: 2
        })
      );
    });

    it('should return 403 when accessing different firm', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '2' };

      await firmController.getMembers(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  // ============================================
  // GET STATS
  // ============================================

  describe('getStats', () => {
    it('should return firm statistics', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1' };

      const mockFirmInstance = {
        id: 1,
        getStats: jest.fn().mockResolvedValue({
          total_clients: 10,
          total_tasks: 25,
          pending_tasks: 15,
          completed_tasks: 10
        })
      };
      Firm.findById.mockResolvedValue(mockFirmInstance);

      await firmController.getStats(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          firmId: 1,
          total_clients: 10,
          total_tasks: 25
        })
      );
    });
  });
});
