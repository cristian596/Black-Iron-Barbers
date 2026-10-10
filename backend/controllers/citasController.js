import { randomUUID } from 'node:crypto';
import { pool } from '../db/connection.js';
import {
  esFechaValida,
  esHoraValida,
  esFechaAnterior,
  intervaloDentroDeHorario,
  hoyISO,
  minutosDesdeMedianoche,
} from '../utils/fechas.js';
import { normalizarTelefono, esTelefonoValido } from '../utils/telefono.js';
import { leerServiciosDelCuerpo, cargarServicios } from '../utils/serviciosCita.js';
import { COLUMNAS_SERVICIOS, COLUMNAS_RESERVA, unirServiciosDeCita, serviciosDeCita } from '../db/citaServicios.js';
import {
  CODIGO_PROFESIONAL_INCOMPATIBLE,
  errorAsesoriaGratisYaUsada,
  errorProfesionalIncompatible,
  esAsesoriaGratis,
  esAsesoriaGratisYaUsada,
  esConflictoDeHorario,
  esErrorAreaProfesional,
} from '../utils/areas.js';
import { identidadAsesoria } from '../utils/identidadAsesoria.js';
import { notificarCitasCreadas, notificarCancelacion, notificarCambioProfesional } from '../utils/notificaciones.js';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ESTADOS_VALIDOS = ['pendiente', 'completada', 'cancelada'];
// Conflicto de horario = 23P01 (solapamiento) o 23505 (doble reserva exacta) de las restricciones de citas. Se decide con
// esConflictoDeHorario (utils/areas.js), que distingue por err.constraint: las restricciones de asesoria_gratis_usos y el
// error BI001 del emparejamiento de áreas NO son "horario ocupado".
const CODIGO_DEADLOCK = '40P01';
// completada y cancelada son finales: no cambian de estado (409 TRANSICION_INVALIDA, con el estado actual y el pedido).
const ESTADOS_FINALES = ['completada', 'cancelada'];
const errorTransicionInvalida = (actual, pedido) => ({
  error: pedido === undefined ? `Una cita ${actual} no se puede reasignar` : `Una cita ${actual} no puede pasar a ${pedido}`,
  codigo: 'TRANSICION_INVALIDA',
  estado_actual: actual,
});
const MAX_REINTENTOS_DEADLOCK = 3;

const errorFueraDeHorario = (cantidadServicios) => ({
  status: 400,
  cuerpo: {
    error:
      cantidadServicios === 1
        ? 'El servicio no cabe dentro del horario de atención a esa hora'
        : 'Los servicios no caben dentro del horario de atención a esa hora',
    codigo: 'FUERA_DE_HORARIO',
  },
});

// Una reserva = UNA transacción: bloquea los servicios (FOR SHARE, ordenados por id) y, por cada grupo (asesoría primero,
// corte después), inserta la cita con la suma de duración y precio de SUS líneas y esas líneas con el snapshot. En una
// reserva combinada el corte empieza justo cuando termina la asesoría. Si algo falla, ROLLBACK completo: no quedan citas
// ni líneas huérfanas (tampoco la primera cita si falla la segunda).
//
// Dos inserciones concurrentes que chocan contra la misma restricción EXCLUDE (índice GiST)
// pueden terminar en deadlock en vez de un conflicto limpio (comportamiento documentado de
// Postgres para EXCLUDE). Un deadlock aborta la transacción sin indicar si el hueco está
// realmente ocupado, así que reintentamos el mismo candidato (con una transacción nueva) antes de darlo por conflicto.
//
// Si la reserva incluye la asesoría GRATIS, tras insertar su cita se registra el uso en asesoria_gratis_usos (correo y
// teléfono normalizados, `identidad`) dentro de la MISMA transacción: la UNIQUE de la base decide quién la gana aunque
// dos reservas de la misma persona lleguen a la vez. Si choca, el 23505 (constraint asesoria_gratis_usos_*_key) deshace
// todo, también el corte de una combinada, y NO es un conflicto de horario: no se reintenta con otro candidato.
//
// Si falla, el error lleva `etapa` (qué parte de la transacción estaba en curso: 'asesoria', 'barberia', 'gratis' o
// 'commit'), que permite avanzar SOLO al siguiente candidato del profesional que falló, sin probar todas las combinaciones.
// `segmentos`: [{ clave: 'asesoria' | 'barberia', profesionalId }] en el orden en que se atienden.
// Devuelve { citas: [{ cita, lista }] } o { error } (error de validación de los servicios, ya en forma { status, cuerpo }).
const insertarReserva = async ({ idsServicios, segmentos, reservaId, identidad, cliente, correo, telefono, fecha, hora, consentimientoEn }) => {
  for (let intento = 1; intento <= MAX_REINTENTOS_DEADLOCK; intento += 1) {
    const conexion = await pool.connect();
    let fallaRollback = false;
    let etapa = 'servicios';
    try {
      await conexion.query('BEGIN');

      // Se vuelve a leer con bloqueo: lo que se guarda es lo vigente en este instante, no lo de la validación previa.
      const servicios = await cargarServicios(conexion, idsServicios, { bloquear: true });
      if (servicios.error) {
        await conexion.query('ROLLBACK');
        return { error: servicios.error };
      }
      if (!intervaloDentroDeHorario(hora, servicios.duracion)) {
        await conexion.query('ROLLBACK');
        return { error: errorFueraDeHorario(servicios.lista.length) };
      }
      const gruposActuales = ['asesoria', 'barberia'].filter((clave) => servicios[clave]);
      if (gruposActuales.length !== segmentos.length || segmentos.some(({ clave }) => !servicios[clave])) {
        await conexion.query('ROLLBACK');
        return { error: { status: 409, cuerpo: { error: 'Los servicios cambiaron mientras reservabas, intenta de nuevo' } } };
      }

      const citas = [];
      let inicioMin = minutosDesdeMedianoche(hora);
      for (const { clave, profesionalId } of segmentos) {
        const grupo = servicios[clave];
        etapa = clave;
        const { rows } = await conexion.query(
          `INSERT INTO citas
             (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, consentimiento_en, reserva_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado, reserva_id`,
          [cliente, correo, telefono, grupo.lista[0].id, profesionalId, fecha, horaDesdeMinutos(inicioMin), grupo.duracion, grupo.precio, consentimientoEn, reservaId]
        );
        const cita = rows[0];

        await conexion.query(
          `INSERT INTO cita_servicios (cita_id, servicio_id, orden, nombre, duracion_min, precio)
           SELECT $1, * FROM unnest($2::int[], $3::int[], $4::text[], $5::int[], $6::int[])`,
          [
            cita.id,
            grupo.lista.map((servicio) => servicio.id),
            grupo.lista.map((servicio) => servicio.orden),
            grupo.lista.map((servicio) => servicio.nombre),
            grupo.lista.map((servicio) => servicio.duracion_min),
            grupo.lista.map((servicio) => servicio.precio),
          ]
        );
        if (grupo.lista.some(esAsesoriaGratis)) {
          etapa = 'gratis';
          await conexion.query(
            'INSERT INTO asesoria_gratis_usos (cita_id, correo_norm, telefono_norm) VALUES ($1, $2, $3)',
            [cita.id, identidad.correo_norm, identidad.telefono_norm]
          );
        }
        citas.push({ cita, lista: grupo.lista });
        inicioMin += grupo.duracion; // la siguiente cita (el corte) empieza cuando termina esta
      }

      etapa = 'commit'; // aquí salta el trigger diferido de emparejamiento profesional/servicio
      await conexion.query('COMMIT');
      return { citas };
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
      err.etapa = etapa;
      throw err;
    } finally {
      conexion.release(fallaRollback || undefined);
    }
  }
  return undefined;
};

// Profesionales activos DEL ÁREA indicada con el intervalo completo libre para esa fecha/hora/duración, ordenados por
// menos citas ese día (solo pendientes y completadas) y desempate por id. El área separa los pools: "cualquier barbero"
// nunca incluye a un asesor y "cualquier asesor" nunca a un barbero.
const elegirCandidatosAutomaticos = async ({ fecha, hora, duracionMin, area }) => {
  const { rows } = await pool.query(
    `SELECT b.id,
            COUNT(c.id) AS citas_hoy
     FROM barberos b
     LEFT JOIN citas c ON c.barbero_id = b.id AND c.fecha = $1 AND c.estado <> 'cancelada'
     WHERE b.activo = true
       AND b.area = $4
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
    [fecha, hora, duracionMin, area]
  );
  return rows.map((row) => row.id);
};

const horaDesdeMinutos = (minutos) =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

// Id opcional del cuerpo (barbero_id / asesor_id): vacío = no vino. Devuelve { id } (null si no vino) o { error }.
const leerIdProfesional = (valor, etiqueta) => {
  if (valor === undefined || valor === null || valor === '') return { id: null };
  const id = Number(valor);
  if (!Number.isInteger(id)) return { error: { status: 400, cuerpo: { error: `El ${etiqueta} debe ser un id numérico` } } };
  return { id };
};

const TEXTOS_AREA = {
  barberia: {
    campo: 'barbero_id',
    sustantivo: 'barbero',
    plural: 'barberos',
    incompatible: 'Ese profesional no atiende cortes ni servicios de barbería',
    sinServicios: 'Esta reserva no incluye servicios de barbería',
  },
  asesoria: {
    campo: 'asesor_id',
    sustantivo: 'asesor',
    plural: 'asesores',
    incompatible: 'Ese profesional no atiende asesorías',
    sinServicios: 'Esta reserva no incluye una asesoría',
  },
};

export const crearCita = async (req, res, next) => {
  try {
    // Cualquier total, precio, duración o área que mande el cliente se ignora: solo se leen estos campos.
    const { cliente, correo, telefono, barbero_id, asesor_id, fecha, hora, consentimiento } = req.body;

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

    // Identidad para el límite de la asesoría gratis (el correo ya pasó la validación de formato).
    const identidad = identidadAsesoria(correo, telefonoNormalizado);
    if (!identidad) return res.status(400).json({ error: 'El correo no es válido' });

    const lecturaBarbero = leerIdProfesional(barbero_id, 'barbero');
    if (lecturaBarbero.error) return res.status(lecturaBarbero.error.status).json(lecturaBarbero.error.cuerpo);
    const lecturaAsesor = leerIdProfesional(asesor_id, 'asesor');
    if (lecturaAsesor.error) return res.status(lecturaAsesor.error.status).json(lecturaAsesor.error.cuerpo);
    // Profesional elegido por el cliente en cada área (null = asignación automática dentro del pool de esa área).
    const elegidos = { barberia: lecturaBarbero.id, asesoria: lecturaAsesor.id };

    if (!esFechaValida(fecha)) {
      return res.status(400).json({ error: 'La fecha debe tener el formato AAAA-MM-DD' });
    }
    if (esFechaAnterior(fecha)) {
      return res.status(400).json({ error: 'No se pueden agendar citas en fechas pasadas' });
    }
    if (!esHoraValida(hora)) {
      return res.status(400).json({ error: 'La hora no es válida' });
    }

    // Validación previa (sin bloqueo) para responder rápido y buscar profesional con las duraciones. La transacción de
    // insertarReserva vuelve a validar con bloqueo, así que esto no es la barrera final. El área de cada servicio sale
    // de la base: el cliente no declara si es asesoría o corte.
    const servicios = await cargarServicios(pool, idsServicios);
    if (servicios.error) return res.status(servicios.error.status).json(servicios.error.cuerpo);

    // Una cita por grupo, la asesoría primero.
    const segmentos = ['asesoria', 'barberia'].filter((clave) => servicios[clave]).map((clave) => ({ clave, grupo: servicios[clave] }));
    const combinada = segmentos.length === 2;

    if (!intervaloDentroDeHorario(hora, servicios.duracion)) {
      const { status, cuerpo } = errorFueraDeHorario(idsServicios.length);
      return res.status(status).json(cuerpo);
    }

    // Cada profesional elegido debe existir, estar activo y ser del área de SUS servicios.
    const elegidosIds = Object.values(elegidos).filter((id) => id !== null);
    const encontrados =
      elegidosIds.length > 0
        ? (await pool.query('SELECT id, area FROM barberos WHERE id = ANY($1::int[]) AND activo = true', [elegidosIds])).rows
        : [];
    for (const area of ['barberia', 'asesoria']) {
      const id = elegidos[area];
      if (id === null) continue;
      const textos = TEXTOS_AREA[area];
      if (!servicios[area]) {
        const { status, cuerpo } = errorProfesionalIncompatible(textos.campo, textos.sinServicios);
        return res.status(status).json(cuerpo);
      }
      const profesional = encontrados.find((fila) => fila.id === id);
      if (!profesional) {
        return res.status(400).json({ error: `El ${textos.sustantivo} seleccionado no existe o no está activo` });
      }
      if (profesional.area !== area) {
        const { status, cuerpo } = errorProfesionalIncompatible(textos.campo, textos.incompatible);
        return res.status(status).json(cuerpo);
      }
    }

    // Candidatos por área: el elegido, o el pool libre de esa área (el corte de una combinada se busca desde que termina
    // la asesoría).
    const candidatos = {};
    let desplazamientoMin = 0;
    for (const { clave, grupo } of segmentos) {
      if (elegidos[clave] !== null) {
        candidatos[clave] = [elegidos[clave]];
      } else {
        candidatos[clave] = await elegirCandidatosAutomaticos({
          fecha,
          hora: horaDesdeMinutos(minutosDesdeMedianoche(hora) + desplazamientoMin),
          duracionMin: grupo.duracion,
          area: clave,
        });
        if (candidatos[clave].length === 0) {
          return res.status(409).json({ error: `No hay ${TEXTOS_AREA[clave].plural} disponibles en ese horario` });
        }
      }
      desplazamientoMin += grupo.duracion;
    }

    const consentimientoEn = new Date();
    const reservaId = combinada ? randomUUID() : null; // solo las reservas combinadas comparten reserva_id
    const indices = { barberia: 0, asesoria: 0 };

    for (;;) {
      try {
        const resultado = await insertarReserva({
          idsServicios,
          segmentos: segmentos.map(({ clave }) => ({ clave, profesionalId: candidatos[clave][indices[clave]] })),
          reservaId,
          identidad,
          cliente: cliente.trim(),
          correo,
          telefono: telefonoNormalizado,
          fecha,
          hora,
          consentimientoEn,
        });
        if (resultado.error) return res.status(resultado.error.status).json(resultado.error.cuerpo);

        const { rows: nombres } = await pool.query('SELECT id, nombre FROM barberos WHERE id = ANY($1::int[])', [
          resultado.citas.map(({ cita }) => cita.barbero_id),
        ]);
        const armar = ({ cita, lista }) => ({
          ...cita,
          servicio_nombre: lista.map((servicio) => servicio.nombre).join(' + '),
          servicios: lista.map(({ id, nombre, duracion_min, precio }) => ({ id, nombre, duracion_min, precio })),
          barbero_nombre: nombres.find((fila) => fila.id === cita.barbero_id).nombre,
        });

        // Correos DESPUÉS del commit y sin await: no retrasan ni cambian la respuesta (utils/notificaciones.js no lanza).
        const idsCreadas = resultado.citas.map(({ cita }) => cita.id);
        if (combinada) {
          res.status(201).json({ reserva_id: reservaId, citas: resultado.citas.map(armar) });
          notificarCitasCreadas(idsCreadas);
          return undefined;
        }
        const plana = armar(resultado.citas[0]);
        delete plana.reserva_id; // una cita suelta conserva la forma de siempre (sin reserva_id)
        res.status(201).json(plana);
        notificarCitasCreadas(idsCreadas);
        return undefined;
      } catch (err) {
        // La persona ya usó su asesoría gratis: 409 sin más datos (ni qué campo coincidió) y sin probar otro candidato.
        if (esAsesoriaGratisYaUsada(err)) {
          const { status, cuerpo } = errorAsesoriaGratisYaUsada(servicios.asesoria.lista.find(esAsesoriaGratis).id);
          return res.status(status).json(cuerpo);
        }
        // Última barrera: el trigger de la base rechazó el emparejamiento profesional/servicio al COMMIT.
        if (esErrorAreaProfesional(err)) {
          const campo = combinada ? 'profesional' : TEXTOS_AREA[segmentos[0].clave].campo;
          const { status, cuerpo } = errorProfesionalIncompatible(campo);
          return res.status(status).json(cuerpo);
        }
        if (esConflictoDeHorario(err)) {
          // El profesional que chocó es el de la etapa que falló; el otro conserva su candidato.
          const clave = segmentos.some((segmento) => segmento.clave === err.etapa) ? err.etapa : segmentos[segmentos.length - 1].clave;
          const textos = TEXTOS_AREA[clave];
          if (elegidos[clave] !== null) {
            return res.status(409).json({ error: `Ese horario ya está reservado para este ${textos.sustantivo}, elige otro` });
          }
          indices[clave] += 1; // intenta con el siguiente libre de ESE pool
          if (indices[clave] >= candidatos[clave].length) {
            return res.status(409).json({ error: `No hay ${textos.plural} disponibles en ese horario, intenta con otra hora` });
          }
          continue;
        }
        throw err;
      }
    }
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
              ${COLUMNAS_SERVICIOS}, ${COLUMNAS_RESERVA}, b.nombre AS barbero_nombre
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

    const { rows: citas } = await pool.query('SELECT id, barbero_id, estado, fecha::text AS fecha FROM citas WHERE id = $1', [citaId]);
    const cita = citas[0];

    if (!cita) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    if (rol === 'barbero' && cita.barbero_id !== barberoToken) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    // Estados finales: una cita completada o cancelada no vuelve a cambiar de estado (ni se reabre una cancelada: su
    // hueco pudo ser tomado y, si era una asesoría gratis, el derecho ya se liberó). Repetir el mismo estado es inocuo.
    if (estado !== undefined && estado !== cita.estado && ESTADOS_FINALES.includes(cita.estado)) {
      return res.status(409).json(errorTransicionInvalida(cita.estado, estado));
    }

    // Tampoco se reasigna una cita en estado final (cambiar de profesional no tiene sentido y movería citas del historial).
    if (barbero_id !== undefined && ESTADOS_FINALES.includes(cita.estado) && Number(barbero_id) !== cita.barbero_id) {
      return res.status(409).json(errorTransicionInvalida(cita.estado, undefined));
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
        'SELECT id, area FROM barberos WHERE id = $1 AND activo = true',
        [nuevoBarberoId]
      );
      if (barberos.length === 0) {
        return res.status(400).json({ error: 'El barbero seleccionado no existe o no está activo' });
      }
      // El nuevo profesional debe ser del área de TODOS los servicios de la cita (cortes con barberos, asesorías con
      // asesores). 400 con código estable (igual que al reservar con un profesional de otra área).
      if (nuevoBarberoId !== cita.barbero_id) {
        const { rows: incompatibles } = await pool.query(
          `SELECT 1 FROM cita_servicios cs JOIN servicios s ON s.id = cs.servicio_id
           WHERE cs.cita_id = $1 AND s.area <> $2 LIMIT 1`,
          [citaId, barberos[0].area]
        );
        if (incompatibles.length > 0) {
          return res.status(400).json({
            error: 'Ese profesional no atiende el tipo de servicio de esta cita. Elige a alguien de la misma área.',
            codigo: CODIGO_PROFESIONAL_INCOMPATIBLE,
            campo: 'barbero_id',
          });
        }
      }
    }

    try {
      // Una sola sentencia (atómica): el UPDATE y, si se cancela, la liberación de la asesoría gratis de ESA cita (cancelar
      // el corte hermano no toca la fila de la asesoría). El UPDATE repite la regla de estados finales en su WHERE: si otra
      // petición cerró la cita entre la lectura y aquí, no actualiza nada (y tampoco libera nada).
      const { rows } = await pool.query(
        `WITH actualizada AS (
           UPDATE citas
           SET estado = COALESCE($1, estado), barbero_id = $2
           WHERE id = $3 AND ($1::text IS NULL OR estado = 'pendiente' OR estado = $1::text)
             AND (NOT $4::boolean OR estado = 'pendiente')
           RETURNING id, cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado
         ), liberada AS (
           DELETE FROM asesoria_gratis_usos
           WHERE $1::text = 'cancelada' AND cita_id IN (SELECT id FROM actualizada)
         )
         SELECT * FROM actualizada`,
        [estado ?? null, nuevoBarberoId, citaId, nuevoBarberoId !== cita.barbero_id]
      );
      if (rows.length === 0) {
        return res.status(409).json(errorTransicionInvalida(cita.estado, estado));
      }

      res.json({ ...rows[0], ...(await serviciosDeCita(pool, citaId)) });

      // Correos DESPUÉS del commit y sin await. Completar no notifica; repetir 'cancelada' tampoco.
      if (estado === 'cancelada' && cita.estado !== 'cancelada') notificarCancelacion(citaId);
      else if (nuevoBarberoId !== cita.barbero_id) notificarCambioProfesional(citaId, cita.barbero_id);
    } catch (err) {
      // Última barrera (carrera con un cambio de área o de servicios): el trigger de la base rechazó la reasignación.
      if (esErrorAreaProfesional(err)) {
        return res.status(400).json({
          error: 'Ese profesional no atiende el tipo de servicio de esta cita. Elige a alguien de la misma área.',
          codigo: CODIGO_PROFESIONAL_INCOMPATIBLE,
          campo: 'barbero_id',
        });
      }
      if (esConflictoDeHorario(err) || err.code === CODIGO_DEADLOCK) {
        return res.status(409).json({ error: 'Ese barbero ya tiene una cita que se cruza con ese horario' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};
