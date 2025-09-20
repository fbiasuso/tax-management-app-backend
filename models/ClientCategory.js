// models/ClientCategory.js
import db from '../config/database.js';

class ClientCategory {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async getAll() {
    try {
      const query = `
        SELECT 
          cc.*,
          COUNT(c.id) as clients_count
        FROM client_categories cc
        LEFT JOIN clients c ON cc.id = c.category_id AND c.is_active = true
        GROUP BY cc.id
        ORDER BY cc.name
      `;

      const result = await db.query(query);
      return result.rows.map(row => new ClientCategory(row));
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    try {
      const query = `
        SELECT * FROM client_categories 
        WHERE id = $1
      `;

      const result = await db.query(query, [id]);
      return result.rows.length > 0 ? new ClientCategory(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  static async findByName(name) {
    try {
      const query = `
        SELECT * FROM client_categories 
        WHERE name ILIKE $1
      `;

      const result = await db.query(query, [name]);
      return result.rows.length > 0 ? new ClientCategory(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Obtener clientes de esta categoría
  async getClients(firmId = null) {
    try {
      let query = `
        SELECT 
          c.*,
          af.name as firm_name
        FROM clients c
        JOIN accounting_firms af ON c.firm_id = af.id
        WHERE c.category_id = $1 AND c.is_active = true
      `;
      
      const values = [this.id];

      if (firmId) {
        query += ` AND c.firm_id = $2`;
        values.push(firmId);
      }

      query += ` ORDER BY c.name`;

      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Estadísticas de la categoría
  async getStats(firmId = null) {
    try {
      let query = `
        SELECT 
          COUNT(c.id) as total_clients,
          COUNT(CASE WHEN c.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_clients_month
        FROM clients c
        WHERE c.category_id = $1 AND c.is_active = true
      `;
      
      const values = [this.id];

      if (firmId) {
        query += ` AND c.firm_id = $2`;
        values.push(firmId);
      }

      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

export default ClientCategory;