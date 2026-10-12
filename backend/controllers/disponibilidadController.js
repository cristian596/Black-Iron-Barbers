import { pool } from '../db/connection.js';
import { leerIdEstricto, ID_MAXIMO_INT } from '../utils/parametrosQuery.js';
import {
  esFechaValida,
  esFechaHoy,
  generarHorasDisponibles,
  horaActualBogota,
  intervaloDentroDeHorario,
  minutosDesdeMedianoche,
} from '../utils/fechas.js';
import { cargarServicios, leerServiciosCsv } from '../utils/serviciosCita.js';
import { AREA_ASESORIA, AREA_BARBERIA, errorProfesionalIncompatible } from '../utils/areas.js';

// Profesionales que pueden atender la reserva, en UNA consulta: todos los activos de las áreas que hacen falta (el pool
// de "cualquier barbero/asesor") más, si se pidió uno concreto, ese aunque sea de otra área (para distinguir
// "no existe" de "no es de esa área"). Los asesores (area 'asesoria') nunca entran al pool de cortes ni al revés.
const obtenerProfesionales = async (areas, idsPedidos) => {
  const { rows } = await pool.query(
    'SELECT id, area FROM barberos WHERE activo = true AND (area = ANY($1::text[]) OR id = ANY($2::int[])) ORDER BY id',
    [areas, idsPedidos]
  );
  return rows;
};

const obtenerCitasOcupadas = async (profesionalIds, fecha) => {
  if (profesionalIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT barbero_id, TO_CHAR(hora, 'HH24:MI') AS hora, duracion_min
     FROM citas
     WHERE barbero_id = ANY($1) AND fecha = $2 AND estado <> 'cancelada'`,
    [profesionalIds, fecha]
  );
  return rows;
};

const seSolapan = (inicioA, finA, inicioB, finB) => inicioA < finB && inicioB < finA;

// ¿Está libre el profesional en [inicioMin, inicioMin + duracionMin)? El inicio va en minutos para poder desplazarlo:
// en una reserva combinada el corte no empieza a la hora elegida sino cuando termina la asesoría.
const estaLibre = (profesionalId, inicioMin, duracionMin, ocupadas) => {
  const fin = inicioMin + duracionMin;
  return !ocupadas.some(
    (cita) =>
      cita.barbero_id === profesionalId &&
      seSolapan(inicioMin, fin, minutosDesdeMedianoche(cita.hora), minutosDesdeMedianoche(cita.hora) + cita.duracion_min)
  );
};

// Id opcional de la consulta (barbero= / asesor=): undefined si no vino, { error } si no es un entero, { id } si sí.
const leerIdOpcional = (valor, etiqueta) => {
  if (valor === undefined || valor === '') return { id: undefined };
  const id = leerIdEstricto(valor);
  if (!Number.isInteger(id)) return { error: { status: 400, cuerpo: { error: `El ${etiqueta} debe ser un id numérico` } } };
  return { id };
};

export const obtenerDisponibilidad = async (req, res, next) => {
  try {
    const { fecha, servicio, servicios: serviciosCsv } = req.query;

    if (!fecha || (!servicio && !serviciosCsv)) {
      return res.status(400).json({ error: 'Los parámetros servicio y fecha son obligatorios' });
    }
    if (servicio !== undefined && serviciosCsv !== undefined) {
      return res.status(400).json({
        error: 'Envía servicios o servicio, no los dos a la vez',
        codigo: 'DATOS_INVALIDOS',
        campo: 'servicios',
      });
    }

    if (!esFechaValida(fecha)) {
      return res.status(400).json({ error: 'La fecha debe tener el formato AAAA-MM-DD' });
    }

    let idsServicios;
    if (serviciosCsv !== undefined) {
      // Varios servicios (1 a 3, sin repetidos): se atienden seguidos como un solo bloque.
      const lectura = leerServiciosCsv(serviciosCsv);
      if (lectura.error) return res.status(lectura.error.status).json(lectura.error.cuerpo);
      idsServicios = lectura.ids;
    } else {
      // Formato anterior `servicio=<id>`: mismas respuestas de siempre (404 si no existe, 400 si está inactivo).
      if (typeof servicio !== 'string' || !/^\d{1,15}$/.test(servicio)) {
        return res.status(400).json({ error: 'El servicio debe ser un id numérico' });
      }
      const servicioId = Number(servicio);
      if (servicioId > ID_MAXIMO_INT) return res.status(404).json({ error: 'Servicio no encontrado' });
      const { rows: existentes } = await pool.query('SELECT activo FROM servicios WHERE id = $1', [servicioId]);
      if (existentes.length === 0) {
        return res.status(404).json({ error: 'Servicio no encontrado' });
      }
      idsServicios = [servicioId];
    }

    const cargados = await cargarServicios(pool, idsServicios);
    if (cargados.error) return res.status(cargados.error.status).json(cargados.error.cuerpo);
    const { asesoria, barberia } = cargados;
    // Reserva encadenada: la asesoría (si hay) va primero y el corte empieza justo cuando termina. Las horas devueltas
    // son las de INICIO de la reserva (el inicio de la asesoría, o del corte si no hay asesoría).
    const duracionAsesoria = asesoria?.duracion ?? 0;
    const duracionBarberia = barberia?.duracion ?? 0;
    const duracionTotal = duracionAsesoria + duracionBarberia;

    const lectura = leerIdOpcional(req.query.barbero, 'barbero');
    if (lectura.error) return res.status(lectura.error.status).json(lectura.error.cuerpo);
    const lecturaAsesor = leerIdOpcional(req.query.asesor, 'asesor');
    if (lecturaAsesor.error) return res.status(lecturaAsesor.error.status).json(lecturaAsesor.error.cuerpo);
    const barberoId = lectura.id;
    const asesorId = lecturaAsesor.id;

    // Un profesional concreto solo vale si la reserva tiene servicios de su área.
    if (barberoId !== undefined && !barberia) {
      const { status, cuerpo } = errorProfesionalIncompatible('barbero', 'Esta reserva no incluye servicios de barbería');
      return res.status(status).json(cuerpo);
    }
    if (asesorId !== undefined && !asesoria) {
      const { status, cuerpo } = errorProfesionalIncompatible('asesor', 'Esta reserva no incluye una asesoría');
      return res.status(status).json(cuerpo);
    }

    const areas = [barberia && AREA_BARBERIA, asesoria && AREA_ASESORIA].filter(Boolean);
    const pedidos = [barberoId, asesorId].filter((id) => id !== undefined);
    const profesionales = await obtenerProfesionales(areas, pedidos);
    const porId = new Map(profesionales.map((p) => [p.id, p]));

    // Cada profesional pedido debe existir, estar activo y ser de su área (404 / 400 PROFESIONAL_INCOMPATIBLE).
    const comprobar = (id, campo, areaEsperada, noEncontrado, mensajeIncompatible) => {
      if (id === undefined) return null;
      const profesional = porId.get(id);
      if (!profesional) return { status: 404, cuerpo: { error: noEncontrado } };
      if (profesional.area !== areaEsperada) return errorProfesionalIncompatible(campo, mensajeIncompatible);
      return null;
    };
    const falloProfesional =
      comprobar(barberoId, 'barbero', AREA_BARBERIA, 'Barbero no encontrado o inactivo', 'Ese profesional no atiende cortes ni servicios de barbería') ??
      comprobar(asesorId, 'asesor', AREA_ASESORIA, 'Asesor no encontrado o inactivo', 'Ese profesional no atiende asesorías');
    if (falloProfesional) return res.status(falloProfesional.status).json(falloProfesional.cuerpo);

    let grid = generarHorasDisponibles().filter((hora) => intervaloDentroDeHorario(hora, duracionTotal));
    if (esFechaHoy(fecha)) {
      const minutosActuales = horaActualBogota();
      grid = grid.filter((hora) => minutosDesdeMedianoche(hora) > minutosActuales);
    }

    const poolDe = (area, concreto) =>
      concreto !== undefined ? [concreto] : profesionales.filter((p) => p.area === area).map((p) => p.id);
    const asesores = asesoria ? poolDe(AREA_ASESORIA, asesorId) : [];
    const barberos = barberia ? poolDe(AREA_BARBERIA, barberoId) : [];

    const ocupadas = await obtenerCitasOcupadas([...asesores, ...barberos], fecha);
    const horas = grid.filter((hora) => {
      const inicio = minutosDesdeMedianoche(hora);
      const asesorLibre = !asesoria || asesores.some((id) => estaLibre(id, inicio, duracionAsesoria, ocupadas));
      // El corte empieza cuando termina la asesoría (desplazamiento del inicio).
      return asesorLibre && (!barberia || barberos.some((id) => estaLibre(id, inicio + duracionAsesoria, duracionBarberia, ocupadas)));
    });

    // Forma de siempre ({ barbero_id, fecha, horas}); asesor_id solo cuando la reserva incluye una asesoría.
    res.json({
      barbero_id: barberoId ?? null,
      ...(asesoria ? { asesor_id: asesorId ?? null } : {}),
      fecha,
      horas,
    });
  } catch (err) {
    next(err);
  }
};
