// database/migration-runner.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MigrationRunner {
  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
    this.seedsDir = path.join(__dirname, 'seeds');
    this.ensureMigrationsTable();
  }

  async ensureMigrationsTable() {
    const createMigrationsTableSQL = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS seeds (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    try {
      await pool.query(createMigrationsTableSQL);
      console.log('✅ Tablas de migraciones y seeds creadas/verificadas');
    } catch (error) {
      console.error('❌ Error creando tablas de control:', error);
      throw error;
    }
  }

  async getExecutedMigrations() {
    const result = await pool.query('SELECT filename FROM migrations ORDER BY id');
    return result.rows.map(row => row.filename);
  }

  async getExecutedSeeds() {
    const result = await pool.query('SELECT filename FROM seeds ORDER BY id');
    return result.rows.map(row => row.filename);
  }

  async getPendingMigrations() {
    const executedMigrations = await this.getExecutedMigrations();
    const allMigrationFiles = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    return allMigrationFiles.filter(file => !executedMigrations.includes(file));
  }

  async getPendingSeeds() {
    const executedSeeds = await this.getExecutedSeeds();
    const allSeedFiles = fs.readdirSync(this.seedsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    return allSeedFiles.filter(file => !executedSeeds.includes(file));
  }

  async runMigration(filename) {
    const filePath = path.join(this.migrationsDir, filename);
    const migrationSQL = fs.readFileSync(filePath, 'utf8');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Ejecutar la migración
      await client.query(migrationSQL);
      
      // Marcar como ejecutada
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [filename]
      );
      
      await client.query('COMMIT');
      console.log(`✅ Migración ejecutada: ${filename}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Error ejecutando migración ${filename}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async runSeed(filename) {
    const filePath = path.join(this.seedsDir, filename);
    const seedSQL = fs.readFileSync(filePath, 'utf8');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Ejecutar el seed
      await client.query(seedSQL);
      
      // Marcar como ejecutado
      await client.query(
        'INSERT INTO seeds (filename) VALUES ($1)',
        [filename]
      );
      
      await client.query('COMMIT');
      console.log(`✅ Seed ejecutado: ${filename}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Error ejecutando seed ${filename}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async runPendingMigrations() {
    const pendingMigrations = await this.getPendingMigrations();
    
    if (pendingMigrations.length === 0) {
      console.log('✅ No hay migraciones pendientes');
      return;
    }

    console.log(`📋 Ejecutando ${pendingMigrations.length} migraciones pendientes...`);
    
    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }
    
    console.log('🎉 Todas las migraciones ejecutadas correctamente');
  }

  async runPendingSeeds() {
    const pendingSeeds = await this.getPendingSeeds();
    
    if (pendingSeeds.length === 0) {
      console.log('✅ No hay seeds pendientes');
      return;
    }

    console.log(`🌱 Ejecutando ${pendingSeeds.length} seeds pendientes...`);
    
    for (const seed of pendingSeeds) {
      await this.runSeed(seed);
    }
    
    console.log('🎉 Todos los seeds ejecutados correctamente');
  }

  async runAll() {
    console.log('🚀 Ejecutando migraciones y seeds...\n');
    
    // Primero ejecutar migraciones
    await this.runPendingMigrations();
    
    // Luego ejecutar seeds
    console.log('\n🌱 Continuando con seeds...');
    await this.runPendingSeeds();
    
    console.log('\n🎉 Proceso completo finalizado exitosamente');
  }

  async rollbackLastMigration() {
    const result = await pool.query(
      'SELECT filename FROM migrations ORDER BY id DESC LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No hay migraciones para deshacer');
      return;
    }
    
    const lastMigration = result.rows[0].filename;
    const rollbackFile = lastMigration.replace('.sql', '_rollback.sql');
    const rollbackPath = path.join(this.migrationsDir, rollbackFile);
    
    if (!fs.existsSync(rollbackPath)) {
      console.log(`❌ No existe archivo de rollback: ${rollbackFile}`);
      return;
    }
    
    const rollbackSQL = fs.readFileSync(rollbackPath, 'utf8');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(rollbackSQL);
      await client.query('DELETE FROM migrations WHERE filename = $1', [lastMigration]);
      await client.query('COMMIT');
      
      console.log(`✅ Rollback ejecutado: ${lastMigration}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Error en rollback:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getStatus() {
    const pendingMigrations = await this.getPendingMigrations();
    const executedMigrations = await this.getExecutedMigrations();
    const pendingSeeds = await this.getPendingSeeds();
    const executedSeeds = await this.getExecutedSeeds();
    
    return {
      migrations: {
        executed: executedMigrations.length,
        pending: pendingMigrations.length,
        pendingFiles: pendingMigrations
      },
      seeds: {
        executed: executedSeeds.length,
        pending: pendingSeeds.length,
        pendingFiles: pendingSeeds
      }
    };
  }
}

export default MigrationRunner;