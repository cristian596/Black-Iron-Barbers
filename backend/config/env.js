import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { faltantesDeBaseDatos, leerConfigBaseDatos, leerTrustProxy } from './baseDatos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// En local (fuera de Docker) el .env vive en la raíz del proyecto.
// Dentro de Docker las variables ya llegan inyectadas y esto no hace nada.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Las DB_* solo son obligatorias si no hay DATABASE_URL (ver config/baseDatos.js).
const REQUERIDAS = [
  'JWT_SECRET',
  'ADMIN_USER',
  'ADMIN_PASSWORD',
  'FRONTEND_URL',
];

const faltantes = [...faltantesDeBaseDatos(), ...REQUERIDAS.filter((clave) => !process.env[clave])];

if (faltantes.length > 0) {
  console.error(
    `❌ Faltan variables de entorno requeridas: ${faltantes.join(', ')}`
  );
  process.exit(1);
}

// DB_SSL, DATABASE_URL y TRUST_PROXY: un valor inválido impide arrancar, con un mensaje que no incluye valores.
let db;
let trustProxy;
try {
  db = leerConfigBaseDatos();
  trustProxy = leerTrustProxy();
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  db,
  trustProxy,
  jwtSecret: process.env.JWT_SECRET,
  adminUser: process.env.ADMIN_USER,
  adminPassword: process.env.ADMIN_PASSWORD,
  frontendUrl: process.env.FRONTEND_URL,
};
