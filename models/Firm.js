// models/Firm.js
import db from '../config/database.js';
import User from './User.js';

class Firm {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.cuit = data.cuit;
    this.address = data.address;
    this.phone = data.phone;
    this.email = data.email;
    this.is_active = data.is_active;
    this.settings = data.settings;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Crear estudio contable
  static async create(firmData, ownerId) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Validar CUIT del estudio
      if (firmData.cuit && !User.validateCUIT(firmData.cuit)) {
        throw new Error('CUIT del estudio inválido');
      }

      // Formatear CUIT
      if (firmData.cuit) {
        firmData.cuit = User.formatCUIT(firmData.cuit);
      }

      // Crear el estudio
      const firmQuery = `
        INSERT INTO accounting_firms (name, cuit, address, phone, email, settings)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const defaultSettings = {
        timezone: 'America/Argentina/Buenos_Aires',
        notifications_enabled: true,
        backup_frequency: 'weekly',
        theme: 'light'
      };

      const firmValues = [
        firmData.name,
        firmData.cuit,
        firmData.address,
        firmData.phone,
        firmData.email,
        { ...defaultSettings, ...firmData.settings }
      ];

      const firmResult = await client.query(firmQuery, firmValues);
      const firm = new Firm(firmResult.rows[0]);

      // Agregar al propietario como member con role 'owner'
      const memberQuery = `
        INSERT INTO firm_members (firm_id, user_id, role, joined_at)
        VALUES ($1, $2, 'owner', NOW())
      `;

      await client.query(memberQuery, [firm.id, ownerId]);

      await client.query('COMMIT');
      return firm;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Buscar por ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM accounting_firms WHERE id = $1 AND is_active = true';
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) return null;
      return new Firm(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Obtener miembros del estudio
  async getMembers() {
    try {
      const query = `
        SELECT 
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.cuit,
          fm.role,
          fm.joined_at
        FROM users u
        JOIN firm_members fm ON u.id = fm.user_id
        WHERE fm.firm_id = $1 AND u.is_active = true
        ORDER BY 
          CASE fm.role 
            WHEN 'owner' THEN 1 
            WHEN 'associated' THEN 2 
            WHEN 'member' THEN 3 
          END,
          fm.joined_at ASC
      `;
      
      const result = await db.query(query, [this.id]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Agregar miembro
  async addMember(userId, role = 'member') {
    try {
      const validRoles = ['owner', 'associated', 'member'];
      if (!validRoles.includes(role)) {
        throw new Error('Rol inválido');
      }

      const query = `
        INSERT INTO firm_members (firm_id, user_id, role, joined_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (firm_id, user_id) 
        DO UPDATE SET role = EXCLUDED.role, joined_at = NOW()
        RETURNING *
      `;

      const result = await db.query(query, [this.id, userId, role]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Remover miembro
  async removeMember(userId) {
    try {
      // No se puede remover al owner
      const memberCheck = `
        SELECT role FROM firm_members 
        WHERE firm_id = $1 AND user_id = $2
      `;
      
      const memberResult = await db.query(memberCheck, [this.id, userId]);
      
      if (memberResult.rows.length === 0) {
        throw new Error('El usuario no es miembro de este estudio');
      }

      if (memberResult.rows[0].role === 'owner') {
        throw new Error('No se puede remover al propietario del estudio');
      }

      const query = `
        DELETE FROM firm_members 
        WHERE firm_id = $1 AND user_id = $2
      `;

      const result = await db.query(query, [this.id, userId]);
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }

  // Obtener clientes
  async getClients(filters = {}) {
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
      
      const values = [this.id];
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
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Actualizar configuraciones
  async updateSettings(newSettings) {
    try {
      const currentSettings = this.settings || {};
      const updatedSettings = { ...currentSettings, ...newSettings };

      const query = `
        UPDATE accounting_firms 
        SET settings = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING settings
      `;

      const result = await db.query(query, [updatedSettings, this.id]);
      this.settings = result.rows[0].settings;
      return this.settings;
    } catch (error) {
      throw error;
    }
  }

  // Actualizar datos del estudio
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
        if (key !== 'id') {
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
        UPDATE accounting_firms 
        SET ${fields.join(', ')} 
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Estudio no encontrado');
      }

      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      throw error;
    }
  }

  // Estadísticas del estudio
  async getStats() {
    try {
      const query = `
        SELECT 
          (SELECT COUNT(*) FROM clients WHERE firm_id = $1 AND is_active = true) as total_clients,
          (SELECT COUNT(*) FROM firm_members WHERE firm_id = $1) as total_members,
          (SELECT COUNT(*) FROM tasks t 
           JOIN clients c ON t.client_id = c.id 
           WHERE c.firm_id = $1 AND t.status = 'pending') as pending_tasks,
          (SELECT COUNT(*) FROM tasks t 
           JOIN clients c ON t.client_id = c.id 
           WHERE c.firm_id = $1 AND t.due_date < CURRENT_DATE AND t.status = 'pending') as overdue_tasks
      `;

      const result = await db.query(query, [this.id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

export default Firm;