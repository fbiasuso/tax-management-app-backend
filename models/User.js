// models/User.js
import bcrypt from 'bcrypt';
import db from '../config/database.js';

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.password = data.password;
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.cuit = data.cuit;
    this.phone = data.phone;
    this.is_active = data.is_active;
    this.email_verified = data.email_verified;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Validar formato CUIT argentino (XX-XXXXXXXX-X)
  static validateCUIT(cuit) {
    if (!cuit) return false;
    
    // Remover guiones para validación
    const cleanCuit = cuit.replace(/-/g, '');
    
    // Debe tener exactamente 11 dígitos
    if (!/^\d{11}$/.test(cleanCuit)) return false;
    
    // Validar dígito verificador
    const digits = cleanCuit.split('').map(Number);
    const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += digits[i] * multipliers[i];
    }
    
    const remainder = sum % 11;
    const verifierDigit = remainder < 2 ? remainder : 11 - remainder;
    
    return digits[10] === verifierDigit;
  }

  // Formatear CUIT con guiones
  static formatCUIT(cuit) {
    if (!cuit) return '';
    const clean = cuit.replace(/-/g, '');
    if (clean.length === 11) {
      return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
    }
    return cuit;
  }

  // Hash de contraseña
  static async hashPassword(password) {
    return await bcrypt.hash(password, 12);
  }

  // Verificar contraseña
  async verifyPassword(password) {
    return await bcrypt.compare(password, this.password);
  }

  // Crear usuario
  static async create(userData) {
    try {
      // Validar CUIT
      if (userData.cuit && !this.validateCUIT(userData.cuit)) {
        throw new Error('CUIT inválido');
      }

      // Formatear CUIT
      if (userData.cuit) {
        userData.cuit = this.formatCUIT(userData.cuit);
      }

      // Hash password
      userData.password = await this.hashPassword(userData.password);

      const query = `
        INSERT INTO users (email, password, first_name, last_name, cuit, phone)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const values = [
        userData.email,
        userData.password,
        userData.first_name,
        userData.last_name,
        userData.cuit,
        userData.phone
      ];

      const result = await db.query(query, values);
      return new User(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Buscar por email
  static async findByEmail(email) {
    try {
      const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
      const result = await db.query(query, [email]);
      
      if (result.rows.length === 0) return null;
      return new User(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Buscar por ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) return null;
      return new User(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Obtener estudios del usuario con roles
  async getAccountingFirms() {
    try {
      const query = `
        SELECT 
          af.*,
          fm.role,
          fm.joined_at
        FROM accounting_firms af
        JOIN firm_members fm ON af.id = fm.firm_id
        WHERE fm.user_id = $1 AND af.is_active = true
        ORDER BY fm.joined_at DESC
      `;
      
      const result = await db.query(query, [this.id]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Verificar si el usuario pertenece a un estudio
  async belongsToFirm(firmId) {
    try {
      const query = `
        SELECT role FROM firm_members 
        WHERE user_id = $1 AND firm_id = $2
      `;
      
      const result = await db.query(query, [this.id, firmId]);
      return result.rows.length > 0 ? result.rows[0].role : null;
    } catch (error) {
      throw error;
    }
  }

  // Actualizar perfil
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
        if (key !== 'id' && key !== 'password') {
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
        UPDATE users 
        SET ${fields.join(', ')} 
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Usuario no encontrado');
      }

      // Actualizar instancia actual
      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      throw error;
    }
  }

  // Cambiar contraseña
  async changePassword(newPassword) {
    try {
      const hashedPassword = await User.hashPassword(newPassword);
      
      const query = `
        UPDATE users 
        SET password = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id
      `;

      const result = await db.query(query, [hashedPassword, this.id]);
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  // Desactivar usuario
  async deactivate() {
    try {
      const query = `
        UPDATE users 
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

  // Método para serializar (eliminar password del output)
  toJSON() {
    const { password, ...userWithoutPassword } = this;
    return userWithoutPassword;
  }
}

export default User;