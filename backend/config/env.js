import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// En local (fuera de Docker) el .env vive en la raíz del proyecto.
// Dentro de Docker las variables ya llegan inyectadas y esto no hace nada.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const REQUERIDAS = [
  'DB_USER',
  'DB_PASSWORD',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'JWT_SECRET',
  'ADMIN_USER',
  'ADMIN_PASSWORD',
  'FRONTEND_URL',
];

const faltantes = REQUERIDAS.filter((clave) => !process.env[clave]);

if (faltantes.length > 0) {
  console.error(
    `❌ Faltan variables de entorno requeridas: ${faltantes.join(', ')}`
  );
  process.exit(1);
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  db: {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
  },
  jwtSecret: process.env.JWT_SECRET,
  adminUser: process.env.ADMIN_USER,
  adminPassword: process.env.ADMIN_PASSWORD,
  frontendUrl: process.env.FRONTEND_URL,
};
