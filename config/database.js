// config/database.js
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tax_management_dev',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  
  // Configuración del pool de conexiones
  max: 20, // máximo número de clientes en el pool
  idleTimeoutMillis: 30000, // cerrar conexiones inactivas después de 30 segundos
  connectionTimeoutMillis: 2000, // timeout para obtener conexión del pool
  
  // Configuración SSL (para producción)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(config);

// Event listeners para debugging
pool.on('connect', (client) => {
  console.log('🔗 Nueva conexión a PostgreSQL establecida');
});

pool.on('error', (err, client) => {
  console.error('❌ Error inesperado en cliente de PostgreSQL:', err);
  process.exit(-1);
});

// Función para testing de conexión
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    client.release();
    
    console.log('✅ Conexión a PostgreSQL exitosa');
    console.log(`⏰ Tiempo del servidor: ${result.rows[0].current_time}`);
    console.log(`🐘 Versión PostgreSQL: ${result.rows[0].postgres_version.split(' ')[0]}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error.message);
    return false;
  }
};

// Función para cerrar todas las conexiones
const closePool = async () => {
  try {
    await pool.end();
    console.log('🔚 Pool de conexiones cerrado');
  } catch (error) {
    console.error('❌ Error cerrando pool:', error.message);
  }
};

export default pool;
export { testConnection, closePool };