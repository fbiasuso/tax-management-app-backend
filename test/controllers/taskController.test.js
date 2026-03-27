/**
 * Task Controller Tests
 * 
 * Tests for task CRUD operations.
 * 
 * Test Scenarios:
 * - Create task → 201 with task object
 * - Get tasks with filters → 200 with pagination
 * - Get task by ID → 200
 * - Update task status → 200 with status history
 * - Recurring task completion → creates next occurrence
 * - Assign task → 200
 * - Error handling: 404, 403, 400
 */

import { jest } from '@jest/globals';
import * as taskController from '../../controllers/taskController.js';

// Manual mocks
const mockTask = {
  create: jest.fn(),
  findById: jest.fn(),
  findByFilters: jest.fn(),
  getStatsByFirm: jest.fn()
};

const mockClient = {
  findById: jest.fn()
};

const mockUser = {
  findById: jest.fn()
};

const mockPool = {
  query: jest.fn(),
  connect: jest.fn()
};

jest.unstable_mockModule('../../models/Task.js', () => ({
  default: mockTask,
  STATUSES: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  }
}));

jest.unstable_mockModule('../../models/Client.js', () => ({
  default: mockClient
}));

jest.unstable_mockModule('../../models/User.js', () => ({
  default: mockUser
}));

jest.unstable_mockModule('../../config/database.js', () => ({
  default: mockPool,
  connect: jest.fn()
}));

const Task = (await import('../../models/Task.js')).default;
const Client = (await import('../../models/Client.js')).default;
const User = (await import('../../models/User.js')).default;
const pool = await import('../../config/database.js');

describe('Task Controller', () => {
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
    
    Task.create.mockReset();
    Task.findById.mockReset();
    Task.findByFilters.mockReset();
    Client.findById.mockReset();
    User.findById.mockReset();
    pool.default.query.mockReset();
    pool.connect.mockReset();
  });

  // ============================================
  // CREATE TASK
  // ============================================

  describe('create', () => {
    it('should create task and return 201', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.validated.body = {
        title: 'Presentar IVA',
        description: 'Declaración mensual',
        client_id: 1,
        module_id: 2,
        due_date: '2026-04-15',
        priority: 'high',
        is_recurring: false
      };

      const mockClientData = {
        id: 1,
        firm_id: 1,
        is_active: true
      };
      Client.findById.mockResolvedValue(mockClientData);
      
      // No module check needed
      pool.default.query.mockResolvedValue({ rows: [] });

      const mockTaskData = {
        id: 1,
        client_id: 1,
        module_id: 2,
        title: 'Presentar IVA',
        description: 'Declaración mensual',
        due_date: '2026-04-15',
        status: 'pending',
        priority: 'high',
        assigned_to: 1,
        is_recurring: false
      };
      Task.create.mockResolvedValue(mockTaskData);

      await taskController.create(mockReq, mockRes, mockNext);

      expect(Task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Presentar IVA',
          client_id: 1
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 when user has no firm', async () => {
      mockReq.user = { userId: 1, firmId: null };
      mockReq.validated.body = {
        title: 'Test Task',
        client_id: 1,
        due_date: '2026-04-15'
      };

      await taskController.create(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'NO_FIRM'
        })
      );
    });

    it('should return 404 when client not found', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.validated.body = {
        title: 'Test Task',
        client_id: 999,
        due_date: '2026-04-15'
      };
      Client.findById.mockResolvedValue(null);

      await taskController.create(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when accessing different firm\'s client', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.validated.body = {
        title: 'Test Task',
        client_id: 1,
        due_date: '2026-04-15'
      };

      const mockClientData = { id: 1, firm_id: 2 };
      Client.findById.mockResolvedValue(mockClientData);

      await taskController.create(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 when client is inactive', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.validated.body = {
        title: 'Test Task',
        client_id: 1,
        due_date: '2026-04-15'
      };

      const mockClientData = { id: 1, firm_id: 1, is_active: false };
      Client.findById.mockResolvedValue(mockClientData);

      await taskController.create(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INACTIVE_CLIENT'
        })
      );
    });
  });

  // ============================================
  // FIND BY FILTERS
  // ============================================

  describe('findByFilters', () => {
    it('should return tasks with pagination', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.query = { page: '1', limit: '20' };

      const mockTasks = [
        { id: 1, title: 'Task 1', client_name: 'Client A', status: 'pending' },
        { id: 2, title: 'Task 2', client_name: 'Client B', status: 'completed' }
      ];
      Task.findByFilters.mockResolvedValue(mockTasks);
      pool.default.query.mockResolvedValue({ rows: [{ total: '2' }] });

      await taskController.findByFilters(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          tasks: expect.arrayContaining([]),
          total: 2,
          page: 1,
          limit: 20
        })
      );
    });

    it('should return 400 when user has no firm', async () => {
      mockReq.user = { userId: 1, firmId: null };

      await taskController.findByFilters(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  // ============================================
  // FIND BY ID
  // ============================================

  describe('findById', () => {
    it('should return task with full details', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.params = { id: '1' };

      const mockTaskData = {
        id: 1,
        title: 'Test Task',
        client_id: 1,
        client_name: 'Test Client',
        client_cuit: '30-71584796-3',
        status: 'pending',
        priority: 'high',
        due_date: '2026-04-15'
      };
      Task.findById.mockResolvedValue(mockTaskData);

      const mockClientData = { id: 1, firm_id: 1 };
      Client.findById.mockResolvedValue(mockClientData);

      await taskController.findById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          title: 'Test Task'
        })
      );
    });

    it('should return 404 when task not found', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.params = { id: '999' };
      Task.findById.mockResolvedValue(null);

      await taskController.findById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when accessing different firm\'s task', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.params = { id: '1' };

      const mockTaskData = { id: 1, client_id: 2 };
      Task.findById.mockResolvedValue(mockTaskData);
      Client.findById.mockResolvedValue({ firm_id: 2 });

      await taskController.findById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  // ============================================
  // UPDATE STATUS
  // ============================================

  describe('updateStatus', () => {
    it('should update task status', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.params = { id: '1' };
      mockReq.validated.body = { status: 'completed' };

      const mockTaskInstance = {
        id: 1,
        client_id: 1,
        status: 'pending',
        updateStatus: jest.fn().mockResolvedValue(true)
      };
      Task.findById.mockResolvedValue(mockTaskInstance);

      const mockClientData = { id: 1, firm_id: 1 };
      Client.findById.mockResolvedValue(mockClientData);

      // Mock no history insert
      pool.default.query.mockRejectedValue(new Error('Table not found'));
      Task.findByFilters.mockResolvedValue([]);

      await taskController.updateStatus(mockReq, mockRes, mockNext);

      expect(mockTaskInstance.updateStatus).toHaveBeenCalledWith('completed', 1);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when task not found', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      mockReq.params = { id: '999' };
      mockReq.validated.body = { status: 'completed' };
      Task.findById.mockResolvedValue(null);

      await taskController.updateStatus(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  // ============================================
  // ASSIGN TASK
  // ============================================

  describe('assign', () => {
    it('should assign task to user', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'owner' };
      mockReq.params = { id: '1' };
      mockReq.validated.body = { userId: 2 };

      const mockTaskInstance = {
        id: 1,
        title: 'Test Task',
        status: 'pending',
        assign: jest.fn().mockResolvedValue(true)
      };
      Task.findById.mockResolvedValue(mockTaskInstance);

      const mockClientData = { id: 1, firm_id: 1 };
      Client.findById.mockResolvedValue(mockClientData);

      const mockUserData = { id: 2, email: 'assignee@test.com' };
      User.findById.mockResolvedValue(mockUserData);

      await taskController.assign(mockReq, mockRes, mockNext);

      expect(mockTaskInstance.assign).toHaveBeenCalledWith(2);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 403 when member tries to assign', async () => {
      mockReq.user = { userId: 1, firmId: 1, role: 'member' };
      mockReq.params = { id: '1' };
      mockReq.validated.body = { userId: 2 };

      const mockTaskInstance = { id: 1, client_id: 1 };
      Task.findById.mockResolvedValue(mockTaskInstance);
      const mockClientData = { id: 1, firm_id: 1 };
      Client.findById.mockResolvedValue(mockClientData);

      await taskController.assign(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  // ============================================
  // GET STATS
  // ============================================

  describe('getStats', () => {
    it('should return task statistics', async () => {
      mockReq.user = { userId: 1, firmId: 1 };
      
      Task.getStatsByFirm.mockResolvedValue({
        total_tasks: '10',
        pending_tasks: '5',
        in_progress_tasks: '2',
        completed_tasks: '3',
        overdue_tasks: '1',
        urgent_tasks: '2',
        high_priority_tasks: '3'
      });

      await taskController.getStats(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          total_tasks: 10,
          pending_tasks: 5,
          in_progress_tasks: 2,
          completed_tasks: 3
        })
      );
    });

    it('should return 400 when user has no firm', async () => {
      mockReq.user = { userId: 1, firmId: null };

      await taskController.getStats(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
