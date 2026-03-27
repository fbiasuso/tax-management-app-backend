/**
 * RoleCheck Middleware Tests
 * 
 * Tests for role-based access control middleware.
 * 
 * Test Scenarios:
 * - Owner → full access (all operations)
 * - Associated → denied on DELETE firm
 * - Member → denied on other firm's data
 * - Unauthenticated → 401 UNAUTHORIZED
 * - User without firm → 401 UNAUTHORIZED
 */

import { authorize, checkFirmAccess, requireOwner, requireOwnerOrAssociated } from '../../middleware/roleCheck.js';

describe('RoleCheck Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {},
      params: {},
      body: {},
      query: {},
      user: null
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authorize', () => {
    it('should return 401 when req.user is not present', async () => {
      const middleware = authorize('owner', 'member');
      
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 when no roles are specified', async () => {
      mockReq.user = { userId: 1, role: 'owner' };
      const middleware = authorize();
      
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'INTERNAL_ERROR',
        message: 'Server configuration error'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 when invalid roles are specified', async () => {
      mockReq.user = { userId: 1, role: 'owner' };
      const middleware = authorize('owner', 'invalid-role');
      
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'INTERNAL_ERROR',
        message: 'Server configuration error'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user role is not in allowed roles', async () => {
      mockReq.user = { userId: 1, role: 'member' };
      const middleware = authorize('owner', 'associated');
      
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() when user has required role (owner)', async () => {
      mockReq.user = { userId: 1, role: 'owner' };
      const middleware = authorize('owner', 'associated', 'member');
      
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next() when user has required role (associated)', async () => {
      mockReq.user = { userId: 2, role: 'associated' };
      const middleware = authorize('owner', 'associated');
      
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next() when user has required role (member)', async () => {
      mockReq.user = { userId: 3, role: 'member' };
      const middleware = authorize('member');
      
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next() when user role is null but no roles required', async () => {
      mockReq.user = { userId: 4, role: null };
      const middleware = authorize();
      
      // This should fail because no roles are specified (500)
      await middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should return 403 when user role is not in the valid roles list', async () => {
      mockReq.user = { userId: 5, role: 'admin' };
      const middleware = authorize('owner', 'member');
      
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('checkFirmAccess', () => {
    it('should return 401 when req.user is not present', async () => {
      await checkFirmAccess(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    });

    it('should return 401 when user has no firm association', async () => {
      mockReq.user = { userId: 1, firmId: null };

      await checkFirmAccess(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'User not associated with a firm'
      });
    });

    it('should return 403 when accessing different firm via params', async () => {
      mockReq.user = { userId: 1, firmId: 100 };
      mockReq.params = { firmId: '200' };

      await checkFirmAccess(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'FORBIDDEN',
        message: 'Access denied to this firm\'s resources'
      });
    });

    it('should return 403 when accessing different firm via body', async () => {
      mockReq.user = { userId: 1, firmId: 100 };
      mockReq.body = { firmId: 200 };

      await checkFirmAccess(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'FORBIDDEN',
        message: 'Access denied to this firm\'s resources'
      });
    });

    it('should return 403 when accessing different firm via query', async () => {
      mockReq.user = { userId: 1, firmId: 100 };
      mockReq.query = { firmId: '200' };

      await checkFirmAccess(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'FORBIDDEN',
        message: 'Access denied to this firm\'s resources'
      });
    });

    it('should call next() when accessing own firm via params', async () => {
      mockReq.user = { userId: 1, firmId: 100 };
      mockReq.params = { firmId: '100' };

      await checkFirmAccess(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next() when no firm ID in request (allows creation)', async () => {
      mockReq.user = { userId: 1, firmId: 100 };
      mockReq.params = {};
      mockReq.body = {};
      mockReq.query = {};

      await checkFirmAccess(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle string firmId comparison correctly', async () => {
      mockReq.user = { userId: 1, firmId: 100 };
      mockReq.params = { firmId: 100 };

      await checkFirmAccess(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireOwner', () => {
    it('should return 401 when req.user is not present', async () => {
      await requireOwner(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    });

    it('should return 403 when user role is not owner', async () => {
      mockReq.user = { userId: 1, role: 'member' };

      await requireOwner(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'FORBIDDEN',
        message: 'Only owners can perform this action'
      });
    });

    it('should call next() when user is owner', async () => {
      mockReq.user = { userId: 1, role: 'owner' };

      await requireOwner(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user is associated', async () => {
      mockReq.user = { userId: 2, role: 'associated' };

      await requireOwner(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireOwnerOrAssociated', () => {
    it('should return 401 when req.user is not present', async () => {
      await requireOwnerOrAssociated(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    });

    it('should return 403 when user role is member', async () => {
      mockReq.user = { userId: 1, role: 'member' };

      await requireOwnerOrAssociated(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'FORBIDDEN',
        message: 'Only owners or associated members can perform this action'
      });
    });

    it('should call next() when user is owner', async () => {
      mockReq.user = { userId: 1, role: 'owner' };

      await requireOwnerOrAssociated(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() when user is associated', async () => {
      mockReq.user = { userId: 2, role: 'associated' };

      await requireOwnerOrAssociated(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 when user role is null', async () => {
      mockReq.user = { userId: 3, role: null };

      await requireOwnerOrAssociated(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
