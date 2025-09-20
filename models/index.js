// models/index.js
// Importar todos los modelos
import User from './User.js';
import Firm from './Firm.js';
import Client from './Client.js';
import Task from './Task.js';
import TaxModule from './TaxModule.js';
import ClientCategory from './ClientCategory.js';
import TaxJurisdiction from './TaxJurisdiction.js';

// Exportar todos los modelos
export {
  User,
  Firm,
  Client,
  Task,
  TaxModule,
  ClientCategory,
  TaxJurisdiction
};

// Export por defecto para uso conveniente
export default {
  User,
  Firm,
  Client,
  Task,
  TaxModule,
  ClientCategory,
  TaxJurisdiction
};