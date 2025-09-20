#!/usr/bin/env node
// database/migrate.js

import MigrationRunner from './migration-runner.js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const runner = new MigrationRunner();

async function main() {
  const command = process.argv[2];
  const subcommand = process.argv[3];
  
  try {
    switch (command) {
      case 'up':
      case 'run':
        if (subcommand === 'seeds') {
          console.log('🌱 Ejecutando seeds pendientes...');
          await runner.runPendingSeeds();
        } else if (subcommand === 'all') {
          console.log('🚀 Ejecutando migraciones y seeds...');
          await runner.runAll();
        } else {
          console.log('🚀 Ejecutando migraciones pendientes...');
          await runner.runPendingMigrations();
        }
        break;
        
      case 'seed':
      case 'seeds':
        console.log('🌱 Ejecutando seeds pendientes...');
        await runner.runPendingSeeds();
        break;
        
      case 'rollback':
      case 'down':
        console.log('⏪ Ejecutando rollback de la última migración...');
        await runner.rollbackLastMigration();
        break;
        
      case 'status':
        console.log('📊 Estado de migraciones y seeds:\n');
        const status = await runner.getStatus();
        
        console.log('🗄️  MIGRACIONES:');
        console.log(`   ✅ Ejecutadas: ${status.migrations.executed}`);
        console.log(`   ⏳ Pendientes: ${status.migrations.pending}`);
        
        if (status.migrations.pendingFiles.length > 0) {
          console.log('   📋 Archivos pendientes:');
          status.migrations.pendingFiles.forEach(file => 
            console.log(`      - ${file}`)
          );
        }
        
        console.log('\n🌱 SEEDS:');
        console.log(`   ✅ Ejecutados: ${status.seeds.executed}`);
        console.log(`   ⏳ Pendientes: ${status.seeds.pending}`);
        
        if (status.seeds.pendingFiles.length > 0) {
          console.log('   📋 Archivos pendientes:');
          status.seeds.pendingFiles.forEach(file => 
            console.log(`      - ${file}`)
          );
        }
        break;
        
      case 'fresh':
        console.log('🔄 Ejecutando migraciones y seeds desde cero...');
        await runner.runAll();
        break;
        
      default:
        console.log(`
🗄️  Sistema de Migraciones - Tax Management App

Uso: npm run migrate <comando> [subcomando]

Comandos disponibles:
  up, run           Ejecutar migraciones pendientes
  up seeds          Ejecutar solo seeds pendientes  
  up all            Ejecutar migraciones y seeds
  seed, seeds       Ejecutar seeds pendientes
  rollback, down    Deshacer la última migración
  status            Ver estado actual
  fresh             Ejecutar todo desde cero

Ejemplos:
  npm run migrate up
  npm run migrate seeds  
  npm run migrate up all
  npm run migrate status
  npm run migrate rollback
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

main();