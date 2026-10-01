import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { asegurarBaseDePrueba } from './guardBaseDePrueba.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Fuerza las variables de la base de pruebas antes de que cualquier
// controlador importe config/env.js y abra la conexion real a Postgres.
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true, quiet: true });

asegurarBaseDePrueba();
