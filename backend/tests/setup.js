import { afterEach } from 'vitest';
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
// La bandera REQUIRE_EMAIL_VERIFICATION ya no existe: aunque estuviera en el entorno, se ignora.
instalarComprobanteAutomatico();

// Las pruebas firman tokens a mano (utilsPrueba.firmarToken) sin el claim `v`, que vale 0. Las que cambian o restablecen
// contraseñas, o desactivan usuarios, suben `usuarios.version_token` (revocación de sesiones): se devuelve a 0 al terminar
// cada prueba para que no contamine a las demás. Las pruebas de la revocación (seguridadTokens.test.js) comprueban el
// efecto DENTRO de su propia prueba.
afterEach(async () => {
  const { pool } = await import('../db/connection.js');
  await pool.query('UPDATE usuarios SET version_token = 0 WHERE version_token <> 0').catch(() => {});
});
