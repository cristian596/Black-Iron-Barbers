import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  user: env.db.user,
  password: env.db.password,
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
});

const crearTablas = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS barberos (
      id SERIAL PRIMARY KEY,
      usuario VARCHAR(50) UNIQUE NOT NULL,
      contrasena VARCHAR(255) NOT NULL,
      nombre VARCHAR(100) NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS citas (
      id SERIAL PRIMARY KEY,
      cliente VARCHAR(100) NOT NULL,
      servicio VARCHAR(100) NOT NULL,
      fecha VARCHAR(50) NOT NULL,
      hora VARCHAR(50) NOT NULL,
      barbero_id INT REFERENCES barberos(id) ON DELETE SET NULL
    );
  `);

  console.log('📋 Tablas de la barbería verificadas/creadas correctamente.');
};

export const conectarConReintentos = async (intentos = 5, esperaMs = 5000) => {
  let reintentos = intentos;

  while (reintentos > 0) {
    try {
      await pool.query('SELECT NOW()');
      console.log('✅ Conectado exitosamente a PostgreSQL (Black Iron DB)');
      await crearTablas();
      return;
    } catch {
      reintentos -= 1;
      if (reintentos > 0) {
        console.log(
          `⏳ Esperando que la base de datos esté lista... (${reintentos} intentos restantes)`
        );
        await new Promise((resolve) => setTimeout(resolve, esperaMs));
      }
    }
  }

  throw new Error('No se pudo conectar a la base de datos tras varios intentos.');
};
