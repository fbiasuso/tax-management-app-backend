// models/TaxModule.js
import db from '../config/database.js';

class TaxModule {
  constructor(data) {
    this.id = data.id;
    this.jurisdiction_id = data.jurisdiction_id;
    this.name = data.name;
    this.code = data.code;
    this.description = data.description;
    this.frequency = data.frequency;
    this.due_day = data.due_day;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async getAll() {
    try {
      const query = `
        SELECT 
          tm.*,
          tj.name as jurisdiction_name,
          tj.level as jurisdiction_level,
          tj.code as jurisdiction_code
        FROM tax_modules tm
        JOIN tax_jurisdictions tj ON tm.jurisdiction_id = tj.id
        WHERE tm.is_active = true
        ORDER BY tj.level, tj.name, tm.name
      `;

      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  static async getByJurisdiction(jurisdictionId) {
    try {
      const query = `
        SELECT * FROM tax_modules 
        WHERE jurisdiction_id = $1 AND is_active = true
        ORDER BY name
      `;

      const result = await db.query(query, [jurisdictionId]);
      return result.rows.map(row => new TaxModule(row));
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    try {
      const query = `
        SELECT 
          tm.*,
          tj.name as jurisdiction_name,
          tj.level as jurisdiction_level,
          tj.code as jurisdiction_code
        FROM tax_modules tm
        JOIN tax_jurisdictions tj ON tm.jurisdiction_id = tj.id
        WHERE tm.id = $1 AND tm.is_active = true
      `;

      const result = await db.query(query, [id]);
      return result.rows.length > 0 ? new TaxModule(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Obtener módulos por frecuencia (monthly, quarterly, yearly)
  static async getByFrequency(frequency) {
    try {
      const query = `
        SELECT 
          tm.*,
          tj.name as jurisdiction_name,
          tj.level as jurisdiction_level
        FROM tax_modules tm
        JOIN tax_jurisdictions tj ON tm.jurisdiction_id = tj.id
        WHERE tm.frequency = $1 AND tm.is_active = true
        ORDER BY tj.level, tm.name
      `;

      const result = await db.query(query, [frequency]);
      return result.rows.map(row => new TaxModule(row));
    } catch (error) {
      throw error;
    }
  }

  // Obtener clientes asignados a este módulo
  async getAssignedClients() {
    try {
      const query = `
        SELECT 
          c.*,
          cm.assigned_at
        FROM clients c
        JOIN client_modules cm ON c.id = cm.client_id
        WHERE cm.module_id = $1 AND c.is_active = true
        ORDER BY c.name
      `;

      const result = await db.query(query, [this.id]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

export default TaxModule;