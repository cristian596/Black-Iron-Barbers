import pg from 'pg';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { aplicarMigracionesCatalogo } from './migracionesCatalogo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

export const pool = new Pool({
  user: env.db.user,
  password: env.db.password,
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
});

const crearTablas = async () => {
  const schema = readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);
  console.log('📋 Tablas de la barbería verificadas/creadas correctamente.');
};

export const conectarConReintentos = async (intentos = 5, esperaMs = 5000) => {
  let reintentos = intentos;

  while (reintentos > 0) {
    try {
      await pool.query('SELECT NOW()');
      console.log('✅ Conectado exitosamente a PostgreSQL (Black Iron DB)');
      break;
    } catch {
      reintentos -= 1;
      if (reintentos > 0) {
        console.log(
          `⏳ Esperando que la base de datos esté lista... (${reintentos} intentos restantes)`
        );
        await new Promise((resolve) => setTimeout(resolve, esperaMs));
      } else {
        throw new Error('No se pudo conectar a la base de datos tras varios intentos.');
      }
    }
  }

  // Una vez conectados, el esquema/migración se ejecuta una sola vez: si falla (por
  // ejemplo, citas solapadas que bloquean la restricción nueva) es un problema de datos,
  // no de conectividad, así que se deja fallar con su mensaje real en vez de reintentar.
  await crearTablas();
  await aplicarMigracionesCatalogo(pool);
};
