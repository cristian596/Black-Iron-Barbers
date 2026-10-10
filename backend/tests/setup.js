import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { asegurarBaseDePrueba } from './guardBaseDePrueba.js';
import { SECRETO_PRUEBA, instalarComprobanteAutomatico } from './verificacionPrueba.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Fuerza las variables de la base de pruebas antes de que cualquier
// controlador importe config/env.js y abra la conexion real a Postgres.
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true, quiet: true });

asegurarBaseDePrueba();

// La verificación del correo es obligatoria también en las pruebas: se usa un secreto propio de pruebas (distinto del
// JWT_SECRET) y los comprobantes se firman de verdad (ver verificacionPrueba.js).
process.env.EMAIL_VERIF_SECRET = SECRETO_PRUEBA;
delete process.env.REQUIRE_EMAIL_VERIFICATION;
instalarComprobanteAutomatico();
