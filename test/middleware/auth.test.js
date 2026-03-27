/**
 * Auth Middleware Tests
 * 
 * Tests for JWT authentication middleware.
 * 
 * Test Scenarios:
 * - Valid JWT token → req.user populated correctly
 * - Missing token → 401 UNAUTHORIZED
 * - Invalid token format → 401 UNAUTHORIZED
 * - Invalid/expired token → 401 INVALID_TOKEN
 * - Token without required payload → 401 INVALID_TOKEN
 */

import jwt from 'jsonwebtoken';
import { authenticate, optionalAuth } from '../../middleware/auth.js';

// Mock dependencies
jest.mock('../../models/User.js', () => ({
  default: {
    findById: jest.fn()
  }
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn()
}));

import User from '../../models/User.js';

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set up environment variable
    process.env.JWT_SECRET = 'test-secret-key-min-32-chars-long';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  describe('authenticate', () => {
    it('should return 401 when Authorization header is missing', async () => {
      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'Missing authentication token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header has invalid format', async () => {
      mockReq.headers.authorization = 'Basic some-token';

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'Invalid authorization header format. Use: Bearer <token>'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is empty after Bearer prefix', async () => {
      mockReq.headers.authorization = 'Bearer ';

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'Missing authentication token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 when JWT_SECRET is not configured', async () => {
      delete process.env.JWT_SECRET;
      mockReq.headers.authorization = 'Bearer valid-token';

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'INTERNAL_ERROR',
        message: 'Server configuration error'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid (JsonWebTokenError)', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'INVALID_TOKEN',
        message: 'Token expired or invalid'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired (TokenExpiredError)', async () => {
      mockReq.headers.authorization = 'Bearer expired-token';
      jwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'INVALID_TOKEN',
        message: 'Token has expired'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token payload is invalid (missing userId)', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockResolvedValue({ email: 'test@example.com' });

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'INVALID_TOKEN',
        message: 'Token payload is invalid'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not found in database', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockResolvedValue({ userId: 123, email: 'test@example.com' });
      User.findById.mockResolvedValue(null);

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'User not found or inactive'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() and attach user to req when token is valid', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      const mockUser = {
        id: 123,
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe'
      };
      jwt.verify.mockResolvedValue({ 
        userId: 123, 
        email: 'test@example.com',
        firmId: 1,
        role: 'owner'
      });
      User.findById.mockResolvedValue(mockUser);

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({
        userId: 123,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        firmId: 1,
        role: 'owner'
      });
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle token with id field instead of userId', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      const mockUser = {
        id: 456,
        email: 'alt@example.com',
        first_name: 'Jane',
        last_name: 'Smith'
      };
      jwt.verify.mockResolvedValue({ 
        id: 456, 
        email: 'alt@example.com',
        firmId: 2,
        role: 'member'
      });
      User.findById.mockResolvedValue(mockUser);

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({
        userId: 456,
        email: 'alt@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        firmId: 2,
        role: 'member'
      });
    });

    it('should default firmId and role to null when not in token', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      const mockUser = {
        id: 789,
        email: 'minimal@example.com',
        first_name: 'Min',
        last_name: 'imal'
      };
      jwt.verify.mockResolvedValue({ userId: 789, email: 'minimal@example.com' });
      User.findById.mockResolvedValue(mockUser);

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({
        userId: 789,
        email: 'minimal@example.com',
        firstName: 'Min',
        lastName: 'imal',
        firmId: null,
        role: null
      });
    });
  });

  describe('optionalAuth', () => {
    it('should call next() without user when no token provided', async () => {
      await optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeNull();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next() without user when token is invalid', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeNull();
    });

    it('should attach user when valid token provided', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      const mockUser = {
        id: 111,
        email: 'optional@example.com',
        first_name: 'Opt',
        last_name: 'ional'
      };
      jwt.verify.mockResolvedValue({ 
        userId: 111, 
        email: 'optional@example.com',
        firmId: 3,
        role: 'associated'
      });
      User.findById.mockResolvedValue(mockUser);

      await optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({
        userId: 111,
        email: 'optional@example.com',
        firstName: 'Opt',
        lastName: 'ional',
        firmId: 3,
        role: 'associated'
      });
    });

    it('should call next() without user when JWT_SECRET is not configured', async () => {
      delete process.env.JWT_SECRET;
      mockReq.headers.authorization = 'Bearer some-token';

      await optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeNull();
    });
  });
});
