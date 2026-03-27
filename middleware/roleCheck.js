// middleware/roleCheck.js
import Firm from '../models/Firm.js';

/**
 * Role-Based Access Control Middleware
 * 
 * Factory that returns middleware to check user roles and firm membership.
 * Roles hierarchy: owner > associated > member
 * 
 * Usage:
 *   authorize('owner') - only owners allowed
 *   authorize('owner', 'associated') - owners and associated allowed
 *   authorize('owner', 'associated', 'member') - all roles allowed
 */

/**
 * Valid role values
 */
const VALID_ROLES = ['owner', 'associated', 'member'];

/**
 * Role hierarchy for comparison
 */
const ROLE_HIERARCHY = {
  owner: 3,
  associated: 2,
  member: 1
};

/**
 * Check if user has required role or higher
 */
const hasRole = (userRole, requiredRoles) => {
  if (!userRole || !requiredRoles || requiredRoles.length === 0) {
    return false;
  }

  const userLevel = ROLE_HIERARCHY[userRole];
  
  if (!userLevel) {
    return false;
  }

  // Check if user's role is in the allowed roles
  return requiredRoles.includes(userRole);
};

/**
 * Factory function to create authorization middleware
 * 
 * @param {...string} allowedRoles - Roles that are allowed to access the route
 * @returns {Function} Express middleware
 */
export const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }

      // Validate roles parameter
      if (!allowedRoles || allowedRoles.length === 0) {
        console.error('authorize middleware: no roles specified');
        return res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Server configuration error'
        });
      }

      // Check for valid role values
      const invalidRoles = allowedRoles.filter(role => !VALID_ROLES.includes(role));
      if (invalidRoles.length > 0) {
        console.error(`authorize middleware: invalid roles specified: ${invalidRoles.join(', ')}`);
        return res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Server configuration error'
        });
      }

      // Check if user has required role
      if (!hasRole(req.user.role, allowedRoles)) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Insufficient permissions'
        });
      }

      // Role check passed
      next();
    } catch (error) {
      console.error('Role check middleware error:', error.message);
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Authorization check failed'
      });
    }
  };
};

/**
 * Middleware to check if user belongs to the requested firm
 * 
 * Use this to ensure users can only access their own firm's resources.
 * Should be used AFTER authenticate middleware.
 * 
 * Checks:
 * - req.params.firmId
 * - req.body.firmId
 * - req.query.firmId
 */
export const checkFirmAccess = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    // If user has no firm association, deny access
    if (!req.user.firmId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not associated with a firm'
      });
    }

    // Extract firm ID from request (params, body, or query)
    const requestedFirmId = 
      req.params.firmId || 
      req.body.firmId || 
      req.query.firmId;

    // If no firm ID in request, allow (may be creating new firm)
    if (!requestedFirmId) {
      return next();
    }

    // Parse to number if string
    const firmIdNum = parseInt(requestedFirmId, 10);

    // Check if user belongs to the requested firm
    if (req.user.firmId !== firmIdNum) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this firm\'s resources'
      });
    }

    next();
  } catch (error) {
    console.error('Firm access check middleware error:', error.message);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Firm access check failed'
    });
  }
};

/**
 * Middleware to ensure user is owner of the firm
 * 
 * Use for destructive operations like deleting a firm.
 */
export const requireOwner = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    if (req.user.role !== 'owner') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only owners can perform this action'
      });
    }

    next();
  } catch (error) {
    console.error('Owner check middleware error:', error.message);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authorization check failed'
    });
  }
};

/**
 * Middleware to ensure user is owner or associated
 * 
 * Use for operations that members cannot perform.
 */
export const requireOwnerOrAssociated = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    if (req.user.role !== 'owner' && req.user.role !== 'associated') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only owners or associated members can perform this action'
      });
    }

    next();
  } catch (error) {
    console.error('Owner/Associated check middleware error:', error.message);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authorization check failed'
    });
  }
};

export default { authorize, checkFirmAccess, requireOwner, requireOwnerOrAssociated };
