// middleware/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * JWT Authentication Middleware
 * 
 * Verifies Bearer token from Authorization header and attaches
 * decoded user payload to req.user.
 * 
 * Expected JWT payload: { userId, email, firmId, role }
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get Authorization header
    const authHeader = req.headers.authorization;

    // Check if Authorization header exists
    if (!authHeader) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Missing authentication token'
      });
    }

    // Check Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid authorization header format. Use: Bearer <token>'
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Missing authentication token'
      });
    }

    // Get JWT secret from environment
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('FATAL: JWT_SECRET not configured in environment');
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Server configuration error'
      });
    }

    // Verify and decode token
    const decoded = jwt.verify(token, jwtSecret);

    // Validate decoded payload has required fields
    if (!decoded.userId && !decoded.id) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Token payload is invalid'
      });
    }

    // Normalize userId field name
    const userId = decoded.userId || decoded.id;

    // Fetch user from database to ensure they still exist and are active
    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not found or inactive'
      });
    }

    // Attach user to request object
    req.user = {
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      firmId: decoded.firmId || null,
      role: decoded.role || null
    };

    // Proceed to next middleware
    next();
  } catch (error) {
    // Handle different JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Token has expired'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid token'
      });
    }

    // Log unexpected errors
    console.error('Auth middleware error:', error.message);

    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Token expired or invalid'
    });
  }
};

/**
 * Optional authentication middleware
 * 
 * Attaches user to req.user if token is present and valid,
 * but does not block the request if no token is provided.
 * Use for endpoints that can work with or without auth.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided - continue without user
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId || decoded.id;

    if (userId) {
      const user = await User.findById(userId);
      
      if (user) {
        req.user = {
          userId: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          firmId: decoded.firmId || null,
          role: decoded.role || null
        };
      } else {
        req.user = null;
      }
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // Silently continue without user on any error
    req.user = null;
    next();
  }
};

export default { authenticate, optionalAuth };
