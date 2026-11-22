const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: process.env.VERCEL ? 5 : 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'tienda_tecnologia',
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

const pool = new Pool(poolConfig);

let isConnected = false;

pool.on('error', (err) => {
  console.error('❌ Error inesperado en cliente PostgreSQL:', err.message);
});

// Verificar conexión inicial
pool.connect()
  .then((client) => {
    const target = connectionString ? 'Supabase PostgreSQL' : (process.env.PGDATABASE || 'tienda_tecnologia');
    console.log(`✅ Conectado exitosamente a ${target}`);
    isConnected = true;
    client.release();
  })
  .catch((err) => {
    console.error('⚠️ Error conectando a PostgreSQL:', err.message);
    console.error('ℹ️ Verifica DATABASE_URL / credenciales en server/.env');
  });

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  isConnected: () => isConnected,
};
