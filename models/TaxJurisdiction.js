// models/TaxJurisdiction.js
import db from '../config/database.js';

class TaxJurisdiction {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.code = data.code;
    this.level = data.level; // 'federal', 'provincial', 'municipal'
    this.parent_id = data.parent_id;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Niveles válidos de jurisdicciones
  static get LEVELS() {
    return {
      FEDERAL: 'federal',
      PROVINCIAL: 'provincial',
      MUNICIPAL: 'municipal'
    };
  }

  static async getAll() {
    try {
      const query = `
        SELECT 
          tj.*,
          parent.name as parent_name,
          COUNT(tm.id) as modules_count
        FROM tax_jurisdictions tj
        LEFT JOIN tax_jurisdictions parent ON tj.parent_id = parent.id
        LEFT JOIN tax_modules tm ON tj.id = tm.jurisdiction_id AND tm.is_active = true
        WHERE tj.is_active = true
        GROUP BY tj.id, parent.name
        ORDER BY tj.level, tj.name
      `;

      const result = await db.query(query);
      return result.rows.map(row => new TaxJurisdiction(row));
    } catch (error) {
      throw error;
    }
  }

  static async getByLevel(level) {
    try {
      const validLevels = Object.values(this.LEVELS);
      if (!validLevels.includes(level)) {
        throw new Error('Nivel de jurisdicción inválido');
      }

      const query = `
        SELECT 
          tj.*,
          COUNT(tm.id) as modules_count
        FROM tax_jurisdictions tj
        LEFT JOIN tax_modules tm ON tj.id = tm.jurisdiction_id AND tm.is_active = true
        WHERE tj.level = $1 AND tj.is_active = true
        GROUP BY tj.id
        ORDER BY tj.name
      `;

      const result = await db.query(query, [level]);
      return result.rows.map(row => new TaxJurisdiction(row));
    } catch (error) {
      throw error;
    }
  }

  static async findById(id) {
    try {
      const query = `
        SELECT 
          tj.*,
          parent.name as parent_name
        FROM tax_jurisdictions tj
        LEFT JOIN tax_jurisdictions parent ON tj.parent_id = parent.id
        WHERE tj.id = $1 AND tj.is_active = true
      `;

      const result = await db.query(query, [id]);
      return result.rows.length > 0 ? new TaxJurisdiction(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  static async findByCode(code) {
    try {
      const query = `
        SELECT * FROM tax_jurisdictions 
        WHERE code = $1 AND is_active = true
      `;

      const result = await db.query(query, [code]);
      return result.rows.length > 0 ? new TaxJurisdiction(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Obtener jurisdicciones federales (AFIP)
  static async getFederal() {
    try {
      return await this.getByLevel(this.LEVELS.FEDERAL);
    } catch (error) {
      throw error;
    }
  }

  // Obtener todas las provincias
  static async getProvinces() {
    try {
      return await this.getByLevel(this.LEVELS.PROVINCIAL);
    } catch (error) {
      throw error;
    }
  }

  // Obtener municipios de una provincia
  static async getMunicipalitiesByProvince(provinceId) {
    try {
      const query = `
        SELECT 
          tj.*,
          COUNT(tm.id) as modules_count
        FROM tax_jurisdictions tj
        LEFT JOIN tax_modules tm ON tj.id = tm.jurisdiction_id AND tm.is_active = true
        WHERE tj.parent_id = $1 AND tj.level = 'municipal' AND tj.is_active = true
        GROUP BY tj.id
        ORDER BY tj.name
      `;

      const result = await db.query(query, [provinceId]);
      return result.rows.map(row => new TaxJurisdiction(row));
    } catch (error) {
      throw error;
    }
  }

  // Obtener módulos fiscales de esta jurisdicción
  async getTaxModules() {
    try {
      const query = `
        SELECT * FROM tax_modules 
        WHERE jurisdiction_id = $1 AND is_active = true
        ORDER BY name
      `;

      const result = await db.query(query, [this.id]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Obtener jurisdicciones hijas (ej: municipios de una provincia)
  async getChildren() {
    try {
      const query = `
        SELECT 
          tj.*,
          COUNT(tm.id) as modules_count
        FROM tax_jurisdictions tj
        LEFT JOIN tax_modules tm ON tj.id = tm.jurisdiction_id AND tm.is_active = true
        WHERE tj.parent_id = $1 AND tj.is_active = true
        GROUP BY tj.id
        ORDER BY tj.name
      `;

      const result = await db.query(query, [this.id]);
      return result.rows.map(row => new TaxJurisdiction(row));
    } catch (error) {
      throw error;
    }
  }

  // Obtener jurisdicción padre
  async getParent() {
    try {
      if (!this.parent_id) return null;

      const query = `
        SELECT * FROM tax_jurisdictions 
        WHERE id = $1 AND is_active = true
      `;

      const result = await db.query(query, [this.parent_id]);
      return result.rows.length > 0 ? new TaxJurisdiction(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Verificar si es jurisdicción federal (AFIP)
  isFederal() {
    return this.level === TaxJurisdiction.LEVELS.FEDERAL;
  }

  // Verificar si es jurisdicción provincial
  isProvincial() {
    return this.level === TaxJurisdiction.LEVELS.PROVINCIAL;
  }

  // Verificar si es jurisdicción municipal
  isMunicipal() {
    return this.level === TaxJurisdiction.LEVELS.MUNICIPAL;
  }

  // Obtener estadísticas de la jurisdicción
  async getStats() {
    try {
      const query = `
        SELECT 
          COUNT(tm.id) as total_modules,
          COUNT(CASE WHEN tm.frequency = 'monthly' THEN 1 END) as monthly_modules,
          COUNT(CASE WHEN tm.frequency = 'quarterly' THEN 1 END) as quarterly_modules,
          COUNT(CASE WHEN tm.frequency = 'yearly' THEN 1 END) as yearly_modules,
          COUNT(DISTINCT cm.client_id) as total_clients_using
        FROM tax_modules tm
        LEFT JOIN client_modules cm ON tm.id = cm.module_id
        WHERE tm.jurisdiction_id = $1 AND tm.is_active = true
      `;

      const result = await db.query(query, [this.id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

export default TaxJurisdiction;