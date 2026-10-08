import { pool } from '../db/connection.js';
import { identidadAsesoria } from '../utils/identidadAsesoria.js';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Comprobación temprana de UX: ¿esta persona aún puede reservar la asesoría gratis? Solo avisa antes de que el cliente
// llene el resto del formulario; la verdad la decide POST /api/citas dentro de la transacción (UNIQUE de la base).
// La respuesta es mínima a propósito: un booleano, sin decir si coincidió el correo o el teléfono ni nada de nadie.
// Riesgo residual (oráculo): quien pruebe correos/teléfonos puede saber si ALGUNO de los dos ya usó la gratis; lo acotan
// el formato exigido y el límite estricto por IP (10 intentos cada 15 min).
export const comprobarAsesoriaGratis = async (req, res, next) => {
  try {
    const { correo, telefono } = req.body ?? {};
    const identidad = typeof correo === 'string' && REGEX_CORREO.test(correo) ? identidadAsesoria(correo, telefono) : null;
    if (!identidad) {
      return res.status(400).json({ error: 'Datos inválidos', codigo: 'DATOS_INVALIDOS' });
    }

    const { rows } = await pool.query(
      'SELECT 1 FROM asesoria_gratis_usos WHERE correo_norm = $1 OR telefono_norm = $2 LIMIT 1',
      [identidad.correo_norm, identidad.telefono_norm]
    );
    res.json({ disponible: rows.length === 0 });
  } catch (err) {
    next(err);
  }
};
