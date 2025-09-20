// models/Client.js
import db from '../config/database.js';
import User from './User.js';

class Client {
  constructor(data) {
    this.id = data.id;
    this.firm_id = data.firm_id;
    this.name = data.name;
    this.cuit = data.cuit;
    this.address = data.address;
    this.phone = data.phone;
    this.email = data.email;
    this.category_id = data.category_id;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Crear cliente
  static async create(clientData) {
    try {
      // Validar CUIT
      if (clientData.cuit && !User.validateCUIT(clientData.cuit)) {
        throw new Error('CUIT del cliente inválido');
      }

      // Formatear CUIT
      if (clientData.cuit) {
        clientData.cuit = User.formatCUIT(clientData.cuit);
      }

      const query = `
        INSERT INTO clients (firm_id, name, cuit, address, phone, email, category_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      
      const values = [
        clientData.firm_id,
        clientData.name,
        clientData.cuit,
        clientData.address,
        clientData.phone,
        clientData.email,
        clientData.category_id
      ];

      const result = await db.query(query, values);
      return new Client(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Buscar por ID
  static async findById(id) {
    try {
      const query = `
        SELECT 
          c.*,
          cc.name as category_name,
          cc.description as category_description
        FROM clients c
        LEFT JOIN client_categories cc ON c.category_id = cc.id
        WHERE c.id = $1 AND c.is_active = true
      `;
      
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) return null;
      return new Client(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Buscar clientes de un estudio
  static async findByFirm(firmId, filters = {}) {
    try {
      let query = `
        SELECT 
          c.*,
          cc.name as category_name,
          COUNT(cm.id) as modules_count
        FROM clients c
        LEFT JOIN client_categories cc ON c.category_id = cc.id
        LEFT JOIN client_modules cm ON c.id = cm.client_id
        WHERE c.firm_id = $1 AND c.is_active = true
      `;
      
      const values = [firmId];
      let paramCount = 2;

      // Aplicar filtros
      if (filters.search) {
        query += ` AND (c.name ILIKE $${paramCount} OR c.cuit ILIKE $${paramCount})`;
        values.push(`%${filters.search}%`);
        paramCount++;
      }

      if (filters.category_id) {
        query += ` AND c.category_id = $${paramCount}`;
        values.push(filters.category_id);
        paramCount++;
      }

      query += `
        GROUP BY c.id, cc.name
        ORDER BY c.name
      `;

      if (filters.limit) {
        query += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
        paramCount++;
      }

      if (filters.offset) {
        query += ` OFFSET $${paramCount}`;
        values.push(filters.offset);
      }

      const result = await db.query(query, values);
      return result.rows.map(row => new Client(row));
    } catch (error) {
      throw error;
    }
  }

  // Obtener módulos fiscales asignados
  async getModules() {
    try {
      const query = `
        SELECT 
          tm.*,
          tj.name as jurisdiction_name,
          cm.assigned_at
        FROM client_modules cm
        JOIN tax_modules tm ON cm.module_id = tm.id
        JOIN tax_jurisdictions tj ON tm.jurisdiction_id = tj.id
        WHERE cm.client_id = $1
        ORDER BY tj.level, tm.name
      `;
      
      const result = await db.query(query, [this.id]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Asignar módulo fiscal
  async assignModule(moduleId) {
    try {
      const query = `
        INSERT INTO client_modules (client_id, module_id, assigned_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (client_id, module_id) DO NOTHING
        RETURNING *
      `;

      const result = await db.query(query, [this.id, moduleId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Desasignar módulo fiscal
  async unassignModule(moduleId) {
    try {
      const query = `
        DELETE FROM client_modules 
        WHERE client_id = $1 AND module_id = $2
      `;

      const result = await db.query(query, [this.id, moduleId]);
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }

  // Obtener tareas pendientes
  async getTasks(filters = {}) {
    try {
      let query = `
        SELECT 
          t.*,
          tm.name as module_name,
          tj.name as jurisdiction_name
        FROM tasks t
        JOIN tax_modules tm ON t.module_id = tm.id
        JOIN tax_jurisdictions tj ON tm.jurisdiction_id = tj.id
        WHERE t.client_id = $1
      `;
      
      const values = [this.id];
      let paramCount = 2;

      if (filters.status) {
        query += ` AND t.status = $${paramCount}`;
        values.push(filters.status);
        paramCount++;
      }

      if (filters.due_date_from) {
        query += ` AND t.due_date >= $${paramCount}`;
        values.push(filters.due_date_from);
        paramCount++;
      }

      if (filters.due_date_to) {
        query += ` AND t.due_date <= $${paramCount}`;
        values.push(filters.due_date_to);
        paramCount++;
      }

      query += ` ORDER BY t.due_date ASC`;

      if (filters.limit) {
        query += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
      }

      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Actualizar cliente
  async update(updateData) {
    try {
      // Validar CUIT si se está actualizando
      if (updateData.cuit && !User.validateCUIT(updateData.cuit)) {
        throw new Error('CUIT inválido');
      }

      // Formatear CUIT
      if (updateData.cuit) {
        updateData.cuit = User.formatCUIT(updateData.cuit);
      }

      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updateData).forEach(key => {
        if (key !== 'id' && key !== 'firm_id') {
          fields.push(`${key} = $${paramCount}`);
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
        UPDATE clients 
        SET ${fields.join(', ')} 
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Cliente no encontrado');
      }

      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      throw error;
    }
  }

  // Desactivar cliente
  async deactivate() {
    try {
      const query = `
        UPDATE clients 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `;

      const result = await db.query(query, [this.id]);
      this.is_active = false;
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  // Obtener estadísticas del cliente
  async getStats() {
    try {
      const query = `
        SELECT 
          (SELECT COUNT(*) FROM tasks WHERE client_id = $1) as total_tasks,
          (SELECT COUNT(*) FROM tasks WHERE client_id = $1 AND status = 'pending') as pending_tasks,
          (SELECT COUNT(*) FROM tasks WHERE client_id = $1 AND status = 'completed') as completed_tasks,
          (SELECT COUNT(*) FROM tasks WHERE client_id = $1 AND due_date < CURRENT_DATE AND status = 'pending') as overdue_tasks,
          (SELECT COUNT(*) FROM client_modules WHERE client_id = $1) as assigned_modules
      `;

      const result = await db.query(query, [this.id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

export default Client;