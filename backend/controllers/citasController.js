import { pool } from '../db/connection.js';
import { esFechaValida, esHoraValida, esFechaAnterior, intervaloDentroDeHorario, hoyISO } from '../utils/fechas.js';
import { normalizarTelefono, esTelefonoValido } from '../utils/telefono.js';
import { leerServiciosDelCuerpo, cargarServicios } from '../utils/serviciosCita.js';
import { COLUMNAS_SERVICIOS, unirServiciosDeCita, serviciosDeCita } from '../db/citaServicios.js';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ESTADOS_VALIDOS = ['pendiente', 'completada', 'cancelada'];
const CODIGOS_CONFLICTO = ['23505', '23P01']; // doble reserva exacta / solapamiento por duración
const CODIGO_DEADLOCK = '40P01';
const MAX_REINTENTOS_DEADLOCK = 3;

const errorFueraDeHorario = (cantidadServicios) => ({
  status: 400,
  cuerpo: {
    error:
      cantidadServicios === 1
        ? 'El servicio no cabe dentro del horario de atención a esa hora'
        : 'Los servicios no caben dentro del horario de atención a esa hora',
  },
});

// Una reserva = UNA transacción: bloquea los servicios (FOR SHARE, ordenados por id), inserta la cita con la suma de
// duración y precio y sus líneas con el snapshot. Si algo falla, ROLLBACK completo: no quedan citas ni líneas huérfanas.
//
// Dos inserciones concurrentes que chocan contra la misma restricción EXCLUDE (índice GiST)
// pueden terminar en deadlock en vez de un conflicto limpio (comportamiento documentado de
// Postgres para EXCLUDE). Un deadlock aborta la transacción sin indicar si el hueco está
// realmente ocupado, así que reintentamos el mismo candidato (con una transacción nueva) antes de darlo por conflicto.
// Devuelve { cita, lista } o { error } (error de validación de los servicios, ya en forma { status, cuerpo }).
const insertarCita = async ({ idsServicios, barberoId, cliente, correo, telefono, fecha, hora, consentimientoEn }) => {
  for (let intento = 1; intento <= MAX_REINTENTOS_DEADLOCK; intento += 1) {
    const conexion = await pool.connect();
    let fallaRollback = false;
    try {
      await conexion.query('BEGIN');

      // Se vuelve a leer con bloqueo: lo que se guarda es lo vigente en este instante, no lo de la validación previa.
      const servicios = await cargarServicios(conexion, idsServicios, { bloquear: true });
      if (servicios.error) {
        await conexion.query('ROLLBACK');
        return { error: servicios.error };
      }
      const { lista, duracion, precio } = servicios;
      if (!intervaloDentroDeHorario(hora, duracion)) {
        await conexion.query('ROLLBACK');
        return { error: errorFueraDeHorario(lista.length) };
      }

      const { rows } = await conexion.query(
        `INSERT INTO citas
           (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, consentimiento_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado`,
        [cliente, correo, telefono, lista[0].id, barberoId, fecha, hora, duracion, precio, consentimientoEn]
      );
      const cita = rows[0];

      await conexion.query(
        `INSERT INTO cita_servicios (cita_id, servicio_id, orden, nombre, duracion_min, precio)
         SELECT $1, * FROM unnest($2::int[], $3::int[], $4::text[], $5::int[], $6::int[])`,
        [
          cita.id,
          lista.map((servicio) => servicio.id),
          lista.map((servicio) => servicio.orden),
          lista.map((servicio) => servicio.nombre),
          lista.map((servicio) => servicio.duracion_min),
          lista.map((servicio) => servicio.precio),
        ]
      );

      await conexion.query('COMMIT');
      return { cita, lista };
    } catch (err) {
      try {
        await conexion.query('ROLLBACK');
      } catch {
        fallaRollback = true; // la conexión quedó inutilizable: se destruye en vez de devolverla al pool
      }
      if (err.code === CODIGO_DEADLOCK && intento < MAX_REINTENTOS_DEADLOCK) {
        continue;
      }
      if (err.code === CODIGO_DEADLOCK) {
        err.code = '23P01'; // reintentos agotados: se trata como el conflicto real que probablemente es
      }
      throw err;
    } finally {
      conexion.release(fallaRollback || undefined);
    }
  }
  return undefined;
};

// Barberos activos cuyo intervalo completo está libre para esa fecha/hora/duración,
// ordenados por menos citas ese día (solo pendientes y completadas) y desempate por id.
const elegirCandidatosAutomaticos = async ({ fecha, hora, duracionMin }) => {
  const { rows } = await pool.query(
    `SELECT b.id,
            COUNT(c.id) AS citas_hoy
     FROM barberos b
     LEFT JOIN citas c ON c.barbero_id = b.id AND c.fecha = $1 AND c.estado <> 'cancelada'
     WHERE b.activo = true
       AND NOT EXISTS (
         SELECT 1 FROM citas c2
         WHERE c2.barbero_id = b.id
           AND c2.estado <> 'cancelada'
           AND c2.rango && TSRANGE(
             ($1::date + $2::time),
             ($1::date + $2::time) + MAKE_INTERVAL(mins => $3::int),
             '[)'
           )
       )
     GROUP BY b.id
     ORDER BY citas_hoy ASC, b.id ASC`,
    [fecha, hora, duracionMin]
  );
  return rows.map((row) => row.id);
};

export const crearCita = async (req, res, next) => {
  try {
    // Cualquier total, precio o duración que mande el cliente se ignora: solo se leen estos campos.
    const { cliente, correo, telefono, barbero_id, fecha, hora, consentimiento } = req.body;

    if (!cliente || typeof cliente !== 'string' || cliente.trim().length === 0) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
    }
    if (!correo || typeof correo !== 'string' || !REGEX_CORREO.test(correo)) {
      return res.status(400).json({ error: 'El correo no es válido' });
    }

    const telefonoNormalizado = normalizarTelefono(telefono);
    if (!esTelefonoValido(telefonoNormalizado)) {
      return res.status(400).json({ error: 'El teléfono debe ser un celular colombiano válido (10 dígitos, inicia en 3)' });
    }

    if (consentimiento !== true) {
      return res.status(400).json({ error: 'Debes aceptar el tratamiento de datos personales para agendar' });
    }

    const pedidos = leerServiciosDelCuerpo(req.body);
    if (pedidos.error) return res.status(pedidos.error.status).json(pedidos.error.cuerpo);
    const idsServicios = pedidos.ids;

    const hayBarberoEspecifico = barbero_id !== undefined && barbero_id !== null && barbero_id !== '';
    let barberoIdEspecifico = null;
    if (hayBarberoEspecifico) {
      barberoIdEspecifico = Number(barbero_id);
      if (!Number.isInteger(barberoIdEspecifico)) {
        return res.status(400).json({ error: 'El barbero debe ser un id numérico' });
      }
    }

    if (!esFechaValida(fecha)) {
      return res.status(400).json({ error: 'La fecha debe tener el formato AAAA-MM-DD' });
    }
    if (esFechaAnterior(fecha)) {
      return res.status(400).json({ error: 'No se pueden agendar citas en fechas pasadas' });
    }
    if (!esHoraValida(hora)) {
      return res.status(400).json({ error: 'La hora no es válida' });
    }

    // Validación previa (sin bloqueo) para responder rápido y buscar barbero con la duración total. La transacción de
    // insertarCita vuelve a validar con bloqueo, así que esto no es la barrera final.
    const servicios = await cargarServicios(pool, idsServicios);
    if (servicios.error) return res.status(servicios.error.status).json(servicios.error.cuerpo);
    const duracionMin = servicios.duracion;

    if (!intervaloDentroDeHorario(hora, duracionMin)) {
      const { status, cuerpo } = errorFueraDeHorario(idsServicios.length);
      return res.status(status).json(cuerpo);
    }

    let candidatos;
    if (hayBarberoEspecifico) {
      const { rows: barberos } = await pool.query(
        'SELECT id FROM barberos WHERE id = $1 AND activo = true',
        [barberoIdEspecifico]
      );
      if (barberos.length === 0) {
        return res.status(400).json({ error: 'El barbero seleccionado no existe o no está activo' });
      }
      candidatos = [barberoIdEspecifico];
    } else {
      candidatos = await elegirCandidatosAutomaticos({ fecha, hora, duracionMin });
      if (candidatos.length === 0) {
        return res.status(409).json({ error: 'No hay barberos disponibles en ese horario' });
      }
    }

    const consentimientoEn = new Date();

    for (const candidatoId of candidatos) {
      try {
        const resultado = await insertarCita({
          idsServicios,
          barberoId: candidatoId,
          cliente: cliente.trim(),
          correo,
          telefono: telefonoNormalizado,
          fecha,
          hora,
          consentimientoEn,
        });
        if (resultado.error) return res.status(resultado.error.status).json(resultado.error.cuerpo);

        const { cita, lista } = resultado;
        const { rows: barbero } = await pool.query('SELECT nombre FROM barberos WHERE id = $1', [candidatoId]);

        return res.status(201).json({
          ...cita,
          servicio_nombre: lista.map((servicio) => servicio.nombre).join(' + '),
          servicios: lista.map(({ id, nombre, duracion_min, precio }) => ({ id, nombre, duracion_min, precio })),
          barbero_nombre: barbero[0].nombre,
        });
      } catch (err) {
        if (CODIGOS_CONFLICTO.includes(err.code)) {
          if (hayBarberoEspecifico) {
            return res.status(409).json({ error: 'Ese horario ya está reservado para este barbero, elige otro' });
          }
          continue; // intenta con el siguiente barbero libre
        }
        throw err;
      }
    }

    return res.status(409).json({ error: 'No hay barberos disponibles en ese horario, intenta con otra hora' });
  } catch (err) {
    next(err);
  }
};

export const listarCitas = async (req, res, next) => {
  try {
    const { rol, barbero_id: barberoToken } = req.usuario;
    const { estado, barbero, fecha } = req.query;

    const condiciones = [];
    const valores = [];

    if (rol === 'barbero') {
      valores.push(barberoToken);
      condiciones.push(`c.barbero_id = $${valores.length}`);
    } else if (rol === 'admin' && barbero) {
      const barberoId = Number(barbero);
      if (!Number.isInteger(barberoId)) {
        return res.status(400).json({ error: 'El filtro barbero debe ser un id numérico' });
      }
      valores.push(barberoId);
      condiciones.push(`c.barbero_id = $${valores.length}`);
    }

    if (estado) {
      if (!ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({ error: 'Estado de filtro inválido' });
      }
      valores.push(estado);
      condiciones.push(`c.estado = $${valores.length}`);
    }

    if (fecha) {
      if (!esFechaValida(fecha)) {
        return res.status(400).json({ error: 'La fecha debe tener el formato AAAA-MM-DD' });
      }
      valores.push(fecha);
      condiciones.push(`c.fecha = $${valores.length}`);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT c.id, c.cliente, c.correo, c.telefono, c.fecha, c.hora, c.estado,
              c.duracion_min, c.precio, c.creada_en, c.servicio_id, c.barbero_id,
              ${COLUMNAS_SERVICIOS}, b.nombre AS barbero_nombre
       FROM citas c
       ${unirServiciosDeCita()}
       JOIN barberos b ON b.id = c.barbero_id
       ${where}
       ORDER BY c.fecha, c.hora`,
      valores
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
};

export const actualizarCita = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { estado, barbero_id } = req.body;
    const { rol, barbero_id: barberoToken } = req.usuario;

    const citaId = Number(id);
    if (!Number.isInteger(citaId)) {
      return res.status(400).json({ error: 'Id de cita inválido' });
    }

    if (estado === undefined && barbero_id === undefined) {
      return res.status(400).json({ error: 'Debes enviar al menos estado o barbero_id' });
    }

    if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    // Completar y cancelar es exclusivo de los barberos (cada uno cierra sus citas); el admin solo reasigna.
    if (estado !== undefined && rol === 'admin') {
      return res.status(403).json({
        error: 'Solo el barbero a cargo puede completar o cancelar una cita. El administrador solo puede reasignarla.',
        codigo: 'SOLO_BARBERO',
      });
    }

    if (barbero_id !== undefined && rol !== 'admin') {
      return res.status(403).json({ error: 'Solo un administrador puede reasignar el barbero' });
    }

    const { rows: citas } = await pool.query('SELECT id, barbero_id, fecha::text AS fecha FROM citas WHERE id = $1', [citaId]);
    const cita = citas[0];

    if (!cita) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    if (rol === 'barbero' && cita.barbero_id !== barberoToken) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    // Una cita solo se puede completar el día en que ocurre o después (hora de Bogotá).
    // Completar citas futuras inflaría los ingresos del dashboard.
    if (estado === 'completada' && cita.fecha > hoyISO()) {
      return res.status(400).json({
        error: 'No se puede completar una cita de una fecha futura',
        codigo: 'CITA_FUTURA',
      });
    }

    let nuevoBarberoId = cita.barbero_id;
    if (barbero_id !== undefined) {
      nuevoBarberoId = Number(barbero_id);
      if (!Number.isInteger(nuevoBarberoId)) {
        return res.status(400).json({ error: 'El barbero_id debe ser un id numérico' });
      }
      const { rows: barberos } = await pool.query(
        'SELECT id FROM barberos WHERE id = $1 AND activo = true',
        [nuevoBarberoId]
      );
      if (barberos.length === 0) {
        return res.status(400).json({ error: 'El barbero seleccionado no existe o no está activo' });
      }
    }

    try {
      const { rows } = await pool.query(
        `UPDATE citas
         SET estado = COALESCE($1, estado), barbero_id = $2
         WHERE id = $3
         RETURNING id, cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado`,
        [estado ?? null, nuevoBarberoId, citaId]
      );

      res.json({ ...rows[0], ...(await serviciosDeCita(pool, citaId)) });
    } catch (err) {
      if (CODIGOS_CONFLICTO.includes(err.code) || err.code === CODIGO_DEADLOCK) {
        return res.status(409).json({ error: 'Ese barbero ya tiene una cita que se cruza con ese horario' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};
