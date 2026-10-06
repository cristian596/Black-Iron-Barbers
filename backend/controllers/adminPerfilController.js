// Revisión de los cambios de perfil (nombre y foto del dashboard) que hacen los barberos. Solo admin.
// El aviso cuenta BARBEROS distintos con algún cambio sin revisar; "revisar" y "restablecer" actúan por barbero.
import { pool } from '../db/connection.js';
import { validarParametros, leerEntero } from '../utils/parametrosQuery.js';
import { borrarArchivosFoto } from './perfilController.js';

const fallo = (res, estado, codigo, error, extra = {}) => res.status(estado).json({ error, codigo, ...extra });

const barberoExiste = async (cliente, id) => (await cliente.query('SELECT 1 FROM barberos WHERE id = $1', [id])).rowCount > 0;

// GET /api/admin/cambios-perfil → { total_barberos, barberos: [{ barbero_id, nombre, ultimo_cambio, cambios: [...] }] }
// `nombre` es el público (barberos.nombre); cada cambio trae campo, valor_anterior, valor_nuevo y creado_en.
export const listarCambiosPerfil = async (req, res, next) => {
  try {
    const error = validarParametros(req.query, []);
    if (error) return fallo(res, 400, 'PARAMETRO_INVALIDO', error);

    const { rows } = await pool.query(
      `SELECT c.id, c.barbero_id, b.nombre, u.usuario, c.campo, c.valor_anterior, c.valor_nuevo, c.creado_en
       FROM cambios_perfil c
       JOIN barberos b ON b.id = c.barbero_id
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.revisado_en IS NULL
       ORDER BY c.creado_en DESC, c.id DESC`
    );

    const porBarbero = new Map();
    for (const fila of rows) {
      if (!porBarbero.has(fila.barbero_id)) {
        porBarbero.set(fila.barbero_id, { barbero_id: fila.barbero_id, nombre: fila.nombre, ultimo_cambio: fila.creado_en, cambios: [] });
      }
      porBarbero.get(fila.barbero_id).cambios.push({
        id: fila.id,
        usuario: fila.usuario,
        campo: fila.campo,
        valor_anterior: fila.valor_anterior,
        valor_nuevo: fila.valor_nuevo,
        creado_en: fila.creado_en,
      });
    }

    res.json({ total_barberos: porBarbero.size, barberos: [...porBarbero.values()] });
  } catch (err) {
    next(err);
  }
};

const leerBarberoId = (valor) => (typeof valor === 'number' && Number.isInteger(valor) ? leerEntero(String(valor), 1) : Number.NaN);

// POST /api/admin/cambios-perfil/revisar  { barbero_id } → marca como revisados todos sus cambios pendientes.
export const revisarCambiosPerfil = async (req, res, next) => {
  try {
    const cuerpo = req.body ?? {};
    const claves = Object.keys(cuerpo);
    if (claves.length !== 1 || claves[0] !== 'barbero_id') {
      return fallo(res, 400, 'DATOS_INVALIDOS', 'Solo se admite el campo barbero_id', { campo: 'barbero_id' });
    }
    const barberoId = leerBarberoId(cuerpo.barbero_id);
    if (Number.isNaN(barberoId)) return fallo(res, 400, 'DATOS_INVALIDOS', 'barbero_id debe ser un entero positivo', { campo: 'barbero_id' });
    if (!(await barberoExiste(pool, barberoId))) return fallo(res, 404, 'BARBERO_NO_ENCONTRADO', 'Barbero no encontrado');

    const { rowCount } = await pool.query(
      'UPDATE cambios_perfil SET revisado_en = $1, revisado_por = $2 WHERE barbero_id = $3 AND revisado_en IS NULL',
      [new Date(), req.usuario.id, barberoId]
    );
    res.json({ barbero_id: barberoId, revisados: rowCount });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/barberos/:id/restablecer-perfil → nombre_perfil y foto_perfil a NULL en TODOS los usuarios de ese
// barbero, borra los archivos de foto y marca sus cambios como revisados. Una sola transacción.
export const restablecerPerfil = async (req, res, next) => {
  const barberoId = leerEntero(req.params.id, 1);
  if (Number.isNaN(barberoId)) return fallo(res, 400, 'ID_INVALIDO', 'El id del barbero no es válido');

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    if (!(await barberoExiste(cliente, barberoId))) {
      await cliente.query('ROLLBACK');
      return fallo(res, 404, 'BARBERO_NO_ENCONTRADO', 'Barbero no encontrado');
    }
    const { rows } = await cliente.query('SELECT id, foto_perfil FROM usuarios WHERE barbero_id = $1 FOR UPDATE', [barberoId]);
    const archivos = rows.map((u) => u.foto_perfil).filter(Boolean);

    await cliente.query('UPDATE usuarios SET nombre_perfil = NULL, foto_perfil = NULL WHERE barbero_id = $1', [barberoId]);
    const revisados = await cliente.query(
      'UPDATE cambios_perfil SET revisado_en = $1, revisado_por = $2 WHERE barbero_id = $3 AND revisado_en IS NULL',
      [new Date(), req.usuario.id, barberoId]
    );
    await cliente.query('COMMIT');

    const archivosEliminados = await borrarArchivosFoto(archivos);
    res.json({ barbero_id: barberoId, usuarios_restablecidos: rows.length, archivos_eliminados: archivosEliminados, revisados: revisados.rowCount });
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    cliente.release();
  }
};
