// database/test-connection.js
import { testConnection, closePool } from '../config/database.js';

async function main() {
  console.log('🔍 Probando conexión a PostgreSQL...\n');
  
  const isConnected = await testConnection();
  
  if (isConnected) {
    console.log('\n🎉 ¡Conexión exitosa! La base de datos está lista.');
  } else {
    console.log('\n💥 Error de conexión. Verifica tu configuración.');
    process.exit(1);
  }
  
  await closePool();
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});