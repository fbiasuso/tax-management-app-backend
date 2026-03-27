// models/Task.js
import db from '../config/database.js';

class Task {
  constructor(data) {
    this.id = data.id;
    this.client_id = data.client_id;
    this.module_id = data.module_id;
    this.title = data.title;
    this.description = data.description;
    this.due_date = data.due_date;
    this.status = data.status;
    this.priority = data.priority;
    this.assigned_to = data.assigned_to;
    this.completed_date = data.completed_date;
    this.completed_at = data.completed_at;
    this.is_recurring = data.is_recurring;
    this.recurrence_config = data.recurrence_config;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Estados válidos de tareas
  static get STATUSES() {
    return {
      PENDING: 'pending',
      IN_PROGRESS: 'in_progress',
      PAUSED: 'paused',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
      OVERDUE: 'overdue'
    };
  }

  // Prioridades válidas
  static get PRIORITIES() {
    return {
      LOW: 'low',
      NORMAL: 'normal',
      HIGH: 'high',
      URGENT: 'urgent'
    };
  }

  // Crear tarea
  static async create(taskData) {
    try {
      // Validar status
      const validStatuses = Object.values(this.STATUSES);
      if (taskData.status && !validStatuses.includes(taskData.status)) {
        throw new Error('Estado de tarea inválido');
      }

      // Validar priority
      const validPriorities = Object.values(this.PRIORITIES);
      if (taskData.priority && !validPriorities.includes(taskData.priority)) {
        throw new Error('Prioridad de tarea inválida');
      }

      const query = `
        INSERT INTO tasks (
          client_id, module_id, title, description, due_date, 
          status, priority, assigned_to, is_recurring, recurrence_config
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const values = [
        taskData.client_id,
        taskData.module_id,
        taskData.title,
        taskData.description,
        taskData.due_date,
        taskData.status || this.STATUSES.PENDING,
        taskData.priority || this.PRIORITIES.NORMAL,
        taskData.assigned_to,
        taskData.is_recurring || false,
        taskData.recurrence_config || null
      ];

      const result = await db.query(query, values);
      return new Task(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Buscar por ID
  static async findById(id) {
    try {
      const query = `
        SELECT 
          t.*,
          c.business_name as client_name,
          c.cuit as client_cuit,
          tm.name as module_name,
          tj.name as jurisdiction_name,
          u_assigned.first_name as assigned_first_name,
          u_assigned.last_name as assigned_last_name,
          u_completed.first_name as completed_first_name,
          u_completed.last_name as completed_last_name
        FROM tasks t
        JOIN clients c ON t.client_id = c.id
        JOIN tax_modules tm ON t.module_id = tm.id
        JOIN tax_jurisdictions tj ON tm.jurisdiction_id = tj.id
        LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
        LEFT JOIN users u_completed ON t.completed_date = CURRENT_DATE
        WHERE t.id = $1
      `;
      
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) return null;
      return new Task(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Buscar tareas por filtros
  static async findByFilters(filters = {}) {
    try {
      let query = `
        SELECT 
          t.*,
          c.business_name as client_name,
          c.cuit as client_cuit,
          tm.name as module_name,
          tj.name as jurisdiction_name,
          u_assigned.first_name as assigned_first_name,
          u_assigned.last_name as assigned_last_name
        FROM tasks t
        JOIN clients c ON t.client_id = c.id
        JOIN tax_modules tm ON t.module_id = tm.id
        JOIN tax_jurisdictions tj ON tm.jurisdiction_id = tj.id
        LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
        WHERE 1=1
      `;
      
      const values = [];
      let paramCount = 1;

      // Filtros
      if (filters.firm_id) {
        query += ` AND c.firm_id = ${paramCount}`;
        values.push(filters.firm_id);
        paramCount++;
      }

      if (filters.client_id) {
        query += ` AND t.client_id = ${paramCount}`;
        values.push(filters.client_id);
        paramCount++;
      }

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query += ` AND t.status = ANY(${paramCount})`;
          values.push(filters.status);
        } else {
          query += ` AND t.status = ${paramCount}`;
          values.push(filters.status);
        }
        paramCount++;
      }

      if (filters.priority) {
        query += ` AND t.priority = ${paramCount}`;
        values.push(filters.priority);
        paramCount++;
      }

      if (filters.assigned_to) {
        query += ` AND t.assigned_to = ${paramCount}`;
        values.push(filters.assigned_to);
        paramCount++;
      }

      if (filters.due_date_from) {
        query += ` AND t.due_date >= ${paramCount}`;
        values.push(filters.due_date_from);
        paramCount++;
      }

      if (filters.due_date_to) {
        query += ` AND t.due_date <= ${paramCount}`;
        values.push(filters.due_date_to);
        paramCount++;
      }

      if (filters.overdue) {
        query += ` AND t.due_date < CURRENT_DATE AND t.status IN ('pending', 'in_progress')`;
      }

      if (filters.search) {
        query += ` AND (t.title ILIKE ${paramCount} OR t.description ILIKE ${paramCount} OR c.name ILIKE ${paramCount})`;
        values.push(`%${filters.search}%`);
        paramCount++;
      }

      // Ordenamiento
      query += ` ORDER BY `;
      if (filters.sort_by) {
        const validSortFields = ['due_date', 'priority', 'status', 'created_at', 'client_name'];
        if (validSortFields.includes(filters.sort_by)) {
          query += `t.${filters.sort_by}`;
        } else {
          query += `t.due_date`;
        }
      } else {
        query += `
          CASE t.priority 
            WHEN 'urgent' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'normal' THEN 3 
            WHEN 'low' THEN 4 
          END,
          t.due_date ASC
        `;
      }

      if (filters.sort_order === 'desc') {
        query += ` DESC`;
      } else {
        query += ` ASC`;
      }

      // Paginación
      if (filters.limit) {
        query += ` LIMIT ${paramCount}`;
        values.push(filters.limit);
        paramCount++;
      }

      if (filters.offset) {
        query += ` OFFSET ${paramCount}`;
        values.push(filters.offset);
      }

      const result = await db.query(query, values);
      return result.rows.map(row => new Task(row));
    } catch (error) {
      throw error;
    }
  }

  // Obtener tareas próximas a vencer
  static async getUpcoming(firmId, days = 7) {
    try {
      const query = `
        SELECT 
          t.*,
          c.business_name as client_name,
          c.cuit as client_cuit,
          tm.name as module_name,
          tj.name as jurisdiction_name
        FROM tasks t
        JOIN clients c ON t.client_id = c.id
        JOIN tax_modules tm ON t.module_id = tm.id
        JOIN tax_jurisdictions tj ON tm.jurisdiction_id = tj.id
        WHERE c.firm_id = $1 
          AND t.status IN ('pending', 'in_progress')
          AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'
        ORDER BY t.due_date ASC, t.priority DESC
      `;

      const result = await db.query(query, [firmId]);
      return result.rows.map(row => new Task(row));
    } catch (error) {
      throw error;
    }
  }

  // Marcar como completada
  async complete(completedBy) {
    try {
      const query = `
        UPDATE tasks 
        SET 
          status = $1,
          completed_date = CURRENT_DATE,
          completed_at = NOW(),
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;

      const result = await db.query(query, [Task.STATUSES.COMPLETED, completedBy, this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Tarea no encontrada');
      }

      Object.assign(this, result.rows[0]);

      // Si es recurrente, crear la próxima instancia
      if (this.is_recurring && this.recurrence_config) {
        await this.createNextRecurrence();
      }

      return this;
    } catch (error) {
      throw error;
    }
  }

  // Actualizar estado
  async updateStatus(status, userId) {
    try {
      const validStatuses = Object.values(Task.STATUSES);
      if (!validStatuses.includes(status)) {
        throw new Error('Estado inválido');
      }

      let query = `
        UPDATE tasks 
        SET status = $1, updated_at = NOW()
      `;
      let values = [status];
      let paramCount = 2;

      // Si se marca como completada, agregar datos de completado
      if (status === Task.STATUSES.COMPLETED) {
        query += `, completed_by = ${paramCount}, completed_at = NOW()`;
        values.push(userId);
        paramCount++;
      }

      query += ` WHERE id = ${paramCount} RETURNING *`;
      values.push(this.id);

      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Tarea no encontrada');
      }

      Object.assign(this, result.rows[0]);

      // Si es recurrente y se completó, crear la próxima
      if (status === Task.STATUSES.COMPLETED && this.is_recurring && this.recurrence_config) {
        await this.createNextRecurrence();
      }

      return this;
    } catch (error) {
      throw error;
    }
  }

  // Asignar tarea
  async assign(userId) {
    try {
      const query = `
        UPDATE tasks 
        SET assigned_to = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const result = await db.query(query, [userId, this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Tarea no encontrada');
      }

      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      throw error;
    }
  }

  // Crear próxima recurrencia
  async createNextRecurrence() {
    try {
      if (!this.is_recurring || !this.recurrence_config) {
        return null;
      }

      const config = this.recurrence_config;
      let nextDueDate = new Date(this.due_date);

      // Calcular próxima fecha según configuración
      switch (config.frequency) {
        case 'monthly':
          nextDueDate.setMonth(nextDueDate.getMonth() + (config.interval || 1));
          break;
        case 'quarterly':
          nextDueDate.setMonth(nextDueDate.getMonth() + 3 * (config.interval || 1));
          break;
        case 'yearly':
          nextDueDate.setFullYear(nextDueDate.getFullYear() + (config.interval || 1));
          break;
        default:
          return null;
      }

      const nextTask = await Task.create({
        client_id: this.client_id,
        module_id: this.module_id,
        title: this.title,
        description: this.description,
        due_date: nextDueDate,
        priority: this.priority,
        assigned_to: this.assigned_to,
        is_recurring: true,
        recurrence_config: this.recurrence_config
      });

      return nextTask;
    } catch (error) {
      throw error;
    }
  }

  // Actualizar tarea
  async update(updateData) {
    try {
      // Validar status si se está actualizando
      if (updateData.status && !Object.values(Task.STATUSES).includes(updateData.status)) {
        throw new Error('Estado inválido');
      }

      // Validar priority si se está actualizando
      if (updateData.priority && !Object.values(Task.PRIORITIES).includes(updateData.priority)) {
        throw new Error('Prioridad inválida');
      }

      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updateData).forEach(key => {
        if (key !== 'id' && key !== 'created_at') {
          fields.push(`${key} = ${paramCount}`);
          values.push(updateData[key]);
          paramCount++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No hay campos para actualizar');
      }

      fields.push(`updated_at = NOW()`);
      values.push(this.id);

      const query = `
        UPDATE tasks 
        SET ${fields.join(', ')} 
        WHERE id = ${paramCount}
        RETURNING *
      `;

      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Tarea no encontrada');
      }

      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      throw error;
    }
  }

  // Eliminar tarea
  async delete() {
    try {
      const query = `DELETE FROM tasks WHERE id = $1`;
      const result = await db.query(query, [this.id]);
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }

  // Verificar si está vencida
  isOverdue() {
    if (this.status === Task.STATUSES.COMPLETED || this.status === Task.STATUSES.CANCELLED) {
      return false;
    }
    
    const today = new Date();
    const dueDate = new Date(this.due_date);
    return dueDate < today;
  }

  // Días hasta vencimiento
  daysUntilDue() {
    const today = new Date();
    const dueDate = new Date(this.due_date);
    const diffTime = dueDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Estadísticas de tareas por estudio
  static async getStatsByFirm(firmId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
          COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
          COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
          COUNT(CASE WHEN t.due_date < CURRENT_DATE AND t.status IN ('pending', 'in_progress') THEN 1 END) as overdue_tasks,
          COUNT(CASE WHEN t.priority = 'urgent' THEN 1 END) as urgent_tasks,
          COUNT(CASE WHEN t.priority = 'high' THEN 1 END) as high_priority_tasks
        FROM tasks t
        JOIN clients c ON t.client_id = c.id
        WHERE c.firm_id = $1
      `;

      const result = await db.query(query, [firmId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

export default Task;